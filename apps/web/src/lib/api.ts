import type { CreateRoomResponse } from '@tablehub/shared';

export async function createRoom(): Promise<string> {
  const r = await fetch('/api/rooms', { method: 'POST' });
  if (!r.ok) throw new Error('Não foi possível criar a sala.');
  return ((await r.json()) as CreateRoomResponse).code;
}

export async function roomExists(code: string): Promise<boolean> {
  const r = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
  if (!r.ok) return false;
  return Boolean(((await r.json()) as { exists: boolean }).exists);
}
