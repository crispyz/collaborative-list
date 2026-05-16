#!/usr/bin/env bash
# End-to-end smoke test for the @collab/api HTTP surface.
# Assumes the API is reachable at $API_URL (default http://localhost:4000)
# and Postgres has been migrated (`npm run db:migrate`).
#
# Usage: npm run test:api
#        API_URL=http://staging.example.com bash apps/api/scripts/smoke-test.sh

set -uo pipefail

BASE="${API_URL:-http://localhost:4000}"
FAIL=0
PASS=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

# assert_eq <name> <actual> <expected>
assert_eq() {
  if [ "$2" = "$3" ]; then pass "$1"
  else fail "$1 (expected '$3', got '$2')"
  fi
}

# expect_status <method> <url> [<expected-code>] [<-H header>...] [<-d body>]
# Usage: expect_status POST "$BASE/lists" 400 -H 'content-type: application/json' -d '{"name":""}'
expect_status() {
  local method="$1" url="$2" expected="$3"
  shift 3
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "$url" "$@")
  if [ "$code" = "$expected" ]; then pass "$method $url → $expected"
  else fail "$method $url → $code (expected $expected)"
  fi
}

# expect_json_field <description> <url> <jq-selector> <expected>
expect_json_field() {
  local desc="$1" url="$2" sel="$3" expected="$4"
  local actual
  actual=$(curl -s "$url" | jq -r "$sel")
  assert_eq "$desc" "$actual" "$expected"
}

require() { command -v "$1" >/dev/null || { echo "missing required tool: $1"; exit 2; } }
require curl
require jq

echo
echo "═══ HEALTH ═══"
expect_json_field "GET /health → ok=true" "$BASE/health" '.ok' 'true'

echo
echo "═══ LIST CREATION ═══"
LIST=$(curl -s -X POST "$BASE/lists" -H 'content-type: application/json' -d '{"name":"Smoke test"}')
ID=$(echo "$LIST" | jq -r '.list.id')
TOK=$(echo "$LIST" | jq -r '.ownerToken')
NAME=$(echo "$LIST" | jq -r '.list.name')
ISFROZEN=$(echo "$LIST" | jq -r '.list.isFrozen')
assert_eq "POST /lists returns list.name" "$NAME" "Smoke test"
assert_eq "POST /lists returns isFrozen=false" "$ISFROZEN" "false"
[ "${#TOK}" = 64 ] && pass "ownerToken is 64 hex chars" || fail "ownerToken length ${#TOK} (expected 64)"
expect_status POST "$BASE/lists" 400 -H 'content-type: application/json' -d '{"name":""}'
expect_status POST "$BASE/lists" 400 -H 'content-type: application/json' -d '{}'

echo
echo "═══ LIST READ ═══"
expect_json_field "GET /lists/:id returns name" "$BASE/lists/$ID" '.list.name' 'Smoke test'
expect_json_field "GET /lists/:id returns empty todos" "$BASE/lists/$ID" '.todos | length' '0'
expect_json_field "GET /lists/:id strips ownerToken" "$BASE/lists/$ID" '.list.ownerToken // "absent"' 'absent'
expect_status GET "$BASE/lists/not-a-uuid" 400
expect_status GET "$BASE/lists/00000000-0000-0000-0000-000000000000" 404

echo
echo "═══ TODO CRUD ═══"
T1=$(curl -s -X POST "$BASE/lists/$ID/todos" -H 'content-type: application/json' -d '{"title":"Milk","priceCents":299}')
TID1=$(echo "$T1" | jq -r '.id')
assert_eq "first todo position is 0" "$(echo "$T1" | jq -r '.position')" '0'
assert_eq "first todo priceCents is 299" "$(echo "$T1" | jq -r '.priceCents')" '299'

T2=$(curl -s -X POST "$BASE/lists/$ID/todos" -H 'content-type: application/json' -d '{"title":"Bread"}')
TID2=$(echo "$T2" | jq -r '.id')
assert_eq "second todo position is 1" "$(echo "$T2" | jq -r '.position')" '1'
assert_eq "second todo priceCents is null" "$(echo "$T2" | jq -r '.priceCents')" 'null'

expect_status POST "$BASE/lists/$ID/todos" 400 -H 'content-type: application/json' -d '{"title":""}'
expect_status POST "$BASE/lists/$ID/todos" 400 -H 'content-type: application/json' -d '{"title":"x","priceCents":-1}'

PATCHED=$(curl -s -X PATCH "$BASE/lists/$ID/todos/$TID1" -H 'content-type: application/json' -d '{"isDone":true}')
assert_eq "PATCH isDone=true persists" "$(echo "$PATCHED" | jq -r '.isDone')" 'true'
assert_eq "PATCH leaves title unchanged" "$(echo "$PATCHED" | jq -r '.title')" 'Milk'
assert_eq "PATCH leaves priceCents unchanged" "$(echo "$PATCHED" | jq -r '.priceCents')" '299'

expect_status PATCH "$BASE/lists/$ID/todos/$TID1" 400 -H 'content-type: application/json' -d '{"isDone":"not a boolean"}'
expect_status PATCH "$BASE/lists/$ID/todos/00000000-0000-0000-0000-000000000000" 404 -H 'content-type: application/json' -d '{"isDone":true}'

echo
echo "═══ FREEZE / UNFREEZE ═══"
expect_status POST "$BASE/lists/$ID/freeze" 400 # no X-Owner-Token header
expect_status POST "$BASE/lists/$ID/freeze" 403 -H 'x-owner-token: definitely-wrong'

FROZEN=$(curl -s -X POST "$BASE/lists/$ID/freeze" -H "x-owner-token: $TOK")
assert_eq "freeze with valid token → isFrozen=true" "$(echo "$FROZEN" | jq -r '.isFrozen')" 'true'

echo "  — verifying frozen blocks non-owner mutations —"
expect_status POST "$BASE/lists/$ID/todos" 403 -H 'content-type: application/json' -d '{"title":"Should fail"}'
expect_status PATCH "$BASE/lists/$ID/todos/$TID2" 403 -H 'content-type: application/json' -d '{"title":"Should fail"}'
expect_status DELETE "$BASE/lists/$ID/todos/$TID2" 403

echo "  — verifying owner bypasses freeze —"
T3=$(curl -s -X POST "$BASE/lists/$ID/todos" -H 'content-type: application/json' -H "x-owner-token: $TOK" -d '{"title":"Owner bypass"}')
TID3=$(echo "$T3" | jq -r '.id')
assert_eq "owner can POST on frozen list" "$(echo "$T3" | jq -r '.title')" 'Owner bypass'
expect_status DELETE "$BASE/lists/$ID/todos/$TID3" 204 -H "x-owner-token: $TOK"

UNFROZEN=$(curl -s -X POST "$BASE/lists/$ID/unfreeze" -H "x-owner-token: $TOK")
assert_eq "unfreeze → isFrozen=false" "$(echo "$UNFROZEN" | jq -r '.isFrozen')" 'false'

echo
echo "═══ DELETE TODO ═══"
expect_status DELETE "$BASE/lists/$ID/todos/$TID1" 204
expect_status DELETE "$BASE/lists/$ID/todos/$TID1" 404 # already gone

echo
echo "═══ FINAL LIST STATE ═══"
expect_json_field "list has 1 todo left (Bread)" "$BASE/lists/$ID" '.todos | length' '1'
expect_json_field "remaining todo title" "$BASE/lists/$ID" '.todos[0].title' 'Bread'
expect_json_field "list is unfrozen at end" "$BASE/lists/$ID" '.list.isFrozen' 'false'

echo
echo "═══ DELETE LIST ═══"
expect_status DELETE "$BASE/lists/$ID" 400 # no X-Owner-Token header
expect_status DELETE "$BASE/lists/$ID" 403 -H 'x-owner-token: definitely-wrong'
expect_status DELETE "$BASE/lists/$ID" 204 -H "x-owner-token: $TOK"
expect_status GET "$BASE/lists/$ID" 404 # gone after delete; cascade dropped its todos too
expect_status DELETE "$BASE/lists/$ID" 404 -H "x-owner-token: $TOK" # idempotent: second delete returns 404

echo
echo "════════════════════════════════════════════"
if [ $FAIL = 0 ]; then
  echo "  ✓ $PASS tests passed"
  exit 0
else
  echo "  ✗ $FAIL of $((PASS+FAIL)) tests failed"
  exit 1
fi
