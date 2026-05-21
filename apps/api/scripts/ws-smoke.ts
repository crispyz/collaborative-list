/**
 * WebSocket smoke test: connect, subscribe, run every mutation kind via HTTP,
 * assert the matching RealtimeEvent arrives over the socket.
 *
 * Run via: npm run test:ws
 * Assumes API is reachable at $API_URL (default http://localhost:4000).
 */

import type { ClientMessage, RealtimeEvent } from '@collab/shared';

const HTTP_URL = process.env.API_URL ?? 'http://localhost:4000';
const WS_URL = `${HTTP_URL.replace(/^http/, 'ws')}/ws`;
const STEP_TIMEOUT_MS = 3000;

let pass = 0;
let fail = 0;

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
  pass++;
}

function bad(msg: string): never {
  console.log(`  ✗ ${msg}`);
  fail++;
  throw new Error(msg);
}

async function httpJson<T>(
  method: string,
  path: string,
  body?: unknown,
  ownerToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (ownerToken) headers['x-owner-token'] = ownerToken;
  const res = await fetch(`${HTTP_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function makeQueue() {
  const events: RealtimeEvent[] = [];
  let waiter: ((ev: RealtimeEvent) => void) | null = null;
  function push(ev: RealtimeEvent) {
    if (waiter) {
      const w = waiter;
      waiter = null;
      w(ev);
    } else {
      events.push(ev);
    }
  }
  function next(): Promise<RealtimeEvent> {
    if (events.length > 0) return Promise.resolve(events.shift()!);
    return new Promise<RealtimeEvent>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiter = null;
        reject(new Error(`timeout waiting for event after ${STEP_TIMEOUT_MS}ms`));
      }, STEP_TIMEOUT_MS);
      waiter = (ev) => {
        clearTimeout(timer);
        resolve(ev);
      };
    });
  }
  return { push, next };
}

async function main() {
  console.log(`→ creating list...`);
  const { list, ownerToken } = await httpJson<{
    list: { id: string; name: string };
    ownerToken: string;
  }>('POST', '/lists', { name: 'ws-smoke' });
  const listId = list.id;
  ok(`list created (${listId.slice(0, 8)}…)`);

  console.log(`→ opening WS at ${WS_URL}`);
  const ws = new WebSocket(WS_URL);
  const queue = makeQueue();

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('WS open timeout')), 3000);
    ws.addEventListener('open', () => {
      clearTimeout(t);
      resolve();
    });
    ws.addEventListener('error', () => {
      clearTimeout(t);
      reject(new Error('WS error before open'));
    });
  });
  ok('WS handshake');

  ws.addEventListener('message', (e) => {
    if (typeof e.data !== 'string') return;
    try {
      queue.push(JSON.parse(e.data) as RealtimeEvent);
    } catch {
      /* ignore garbage */
    }
  });

  const sub: ClientMessage = { type: 'subscribe', listId };
  ws.send(JSON.stringify(sub));
  ok('subscribe sent');

  // 1. todo.created
  const t1 = await httpJson<{ id: string }>('POST', `/lists/${listId}/todos`, {
    title: 'Milk',
    priceCents: 299,
  });
  const ev1 = await queue.next();
  if (ev1.type !== 'todo.created' || ev1.listId !== listId || ev1.item.id !== t1.id) {
    bad(`expected todo.created for ${t1.id}, got ${JSON.stringify(ev1)}`);
  }
  ok('todo.created received with matching item');

  // 2. todo.updated
  await httpJson('PATCH', `/lists/${listId}/todos/${t1.id}`, { isDone: true });
  const ev2 = await queue.next();
  if (ev2.type !== 'todo.updated' || ev2.item.id !== t1.id || ev2.item.isDone !== true) {
    bad(`expected todo.updated isDone=true for ${t1.id}, got ${JSON.stringify(ev2)}`);
  }
  ok('todo.updated reflects isDone=true');

  // 3. create T2 (to have something to reorder with)
  const t2 = await httpJson<{ id: string }>('POST', `/lists/${listId}/todos`, { title: 'Bread' });
  const evCreatedT2 = await queue.next();
  if (evCreatedT2.type !== 'todo.created' || evCreatedT2.item.id !== t2.id) {
    bad(`expected todo.created for T2 ${t2.id}, got ${JSON.stringify(evCreatedT2)}`);
  }
  ok('second todo.created received');

  // 4. todo.reordered — swap T1 and T2
  await httpJson('POST', `/lists/${listId}/todos/reorder`, {
    items: [
      { id: t2.id, position: 0 },
      { id: t1.id, position: 1 },
    ],
  });
  const evReordered = await queue.next();
  if (
    evReordered.type !== 'todo.reordered' ||
    evReordered.items.length !== 2 ||
    evReordered.items[0]?.id !== t2.id ||
    evReordered.items[1]?.id !== t1.id
  ) {
    bad(`expected todo.reordered with [T2, T1], got ${JSON.stringify(evReordered)}`);
  }
  ok('todo.reordered carries the full new order');

  // 5. Create two subtasks of T1 (parentId set), then reorder them.
  const sub1 = await httpJson<{ id: string }>('POST', `/lists/${listId}/todos`, {
    title: 'Lettuce',
    parentId: t1.id,
    priceCents: 100,
  });
  const evSub1Created = await queue.next();
  if (
    evSub1Created.type !== 'todo.created' ||
    evSub1Created.item.id !== sub1.id ||
    evSub1Created.item.parentId !== t1.id
  ) {
    bad(`expected todo.created subtask of T1, got ${JSON.stringify(evSub1Created)}`);
  }
  ok('todo.created carries parentId for subtask');

  const sub2 = await httpJson<{ id: string }>('POST', `/lists/${listId}/todos`, {
    title: 'Tomato',
    parentId: t1.id,
    priceCents: 200,
  });
  const evSub2Created = await queue.next();
  if (
    evSub2Created.type !== 'todo.created' ||
    evSub2Created.item.id !== sub2.id ||
    evSub2Created.item.parentId !== t1.id
  ) {
    bad(`expected second todo.created subtask, got ${JSON.stringify(evSub2Created)}`);
  }
  ok('second subtask todo.created received');

  // Reorder the two subtasks (swap order).
  await httpJson('POST', `/lists/${listId}/todos/reorder`, {
    items: [
      { id: sub2.id, position: 0 },
      { id: sub1.id, position: 1 },
    ],
  });
  const evSubReordered = await queue.next();
  if (evSubReordered.type !== 'todo.reordered') {
    bad(`expected todo.reordered for subtasks, got ${JSON.stringify(evSubReordered)}`);
  }
  const subOrder = evSubReordered.items.filter((i) => i.parentId === t1.id);
  if (subOrder.length !== 2 || subOrder[0]?.id !== sub2.id || subOrder[1]?.id !== sub1.id) {
    bad(`subtasks not in expected order, got ${JSON.stringify(subOrder)}`);
  }
  ok('todo.reordered with subtasks scoped to parent');

  // 6. todo.deleted — deleting the parent cascades the two subtasks, so we
  //    receive three `todo.deleted` events (one per cascaded child + the parent).
  await httpJson('DELETE', `/lists/${listId}/todos/${t1.id}`);
  const deletedIds = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const ev = await queue.next();
    if (ev.type !== 'todo.deleted') {
      bad(`expected todo.deleted, got ${JSON.stringify(ev)}`);
    }
    deletedIds.add(ev.itemId);
  }
  const expectedDeleted = [t1.id, sub1.id, sub2.id];
  for (const id of expectedDeleted) {
    if (!deletedIds.has(id)) {
      bad(`missing todo.deleted for ${id} in cascade`);
    }
  }
  ok('todo.deleted cascades to parent + both subtasks');

  // 7. list.frozen
  await httpJson('POST', `/lists/${listId}/freeze`, undefined, ownerToken);
  const ev4 = await queue.next();
  if (ev4.type !== 'list.frozen' || ev4.listId !== listId) {
    bad(`expected list.frozen, got ${JSON.stringify(ev4)}`);
  }
  ok('list.frozen broadcast');

  // 5. list.unfrozen
  await httpJson('POST', `/lists/${listId}/unfreeze`, undefined, ownerToken);
  const ev5 = await queue.next();
  if (ev5.type !== 'list.unfrozen' || ev5.listId !== listId) {
    bad(`expected list.unfrozen, got ${JSON.stringify(ev5)}`);
  }
  ok('list.unfrozen broadcast');

  // 6. list.deleted (also serves as cleanup)
  await httpJson('DELETE', `/lists/${listId}`, undefined, ownerToken);
  const ev6 = await queue.next();
  if (ev6.type !== 'list.deleted' || ev6.listId !== listId) {
    bad(`expected list.deleted, got ${JSON.stringify(ev6)}`);
  }
  ok('list.deleted broadcast');

  ws.close();
}

main()
  .then(() => {
    console.log('\n════════════════════════════════════════════');
    console.log(`  ✓ ${pass} websocket assertions passed`);
    process.exit(0);
  })
  .catch((err) => {
    console.log('\n════════════════════════════════════════════');
    console.log(`  ✗ ${fail} failed (${pass} passed before failure)`);
    console.error(err.message);
    process.exit(1);
  });
