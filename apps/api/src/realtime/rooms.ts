import type { RealtimeEvent } from '@collab/shared';
import type { WebSocket } from 'ws';

const rooms = new Map<string, Set<WebSocket>>();

export function subscribe(listId: string, ws: WebSocket): void {
  let room = rooms.get(listId);
  if (!room) {
    room = new Set();
    rooms.set(listId, room);
  }
  room.add(ws);
}

export function unsubscribe(listId: string, ws: WebSocket): void {
  const room = rooms.get(listId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) rooms.delete(listId);
}

export function unsubscribeAll(ws: WebSocket): void {
  for (const [listId, room] of rooms) {
    if (room.delete(ws) && room.size === 0) rooms.delete(listId);
  }
}

export function broadcast(listId: string, event: RealtimeEvent): void {
  const room = rooms.get(listId);
  if (!room) return;
  const payload = JSON.stringify(event);
  for (const ws of room) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}
