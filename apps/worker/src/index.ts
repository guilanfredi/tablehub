import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type CreateRoomResponse } from '@tablehub/shared';
import type { Env } from './env';

export { RoomDurableObject } from './room-do';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  return [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('');
}

function roomStub(env: Env, code: string) {
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/health') return json({ ok: true });

    if (path === '/api/rooms' && request.method === 'POST') {
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = randomCode();
        if (await roomStub(env, code).init(code)) return json({ code } satisfies CreateRoomResponse, 201);
      }
      return json({ error: 'Não foi possível abrir a mesa, tente de novo.' }, 503);
    }

    const roomMatch = path.match(/^\/api\/rooms\/([^/]+)$/);
    if (roomMatch && request.method === 'GET') {
      const code = normalizeRoomCode(roomMatch[1]);
      if (!isValidRoomCode(code)) return json({ exists: false });
      return json({ exists: await roomStub(env, code).exists() });
    }

    const wsMatch = path.match(/^\/ws\/([^/]+)$/);
    if (wsMatch) {
      const code = normalizeRoomCode(wsMatch[1]);
      if (!isValidRoomCode(code)) return new Response('Código inválido', { status: 400 });
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Esperado WebSocket', { status: 426 });
      return roomStub(env, code).fetch(request);
    }

    if (path.startsWith('/api/')) return json({ error: 'Não encontrado' }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
