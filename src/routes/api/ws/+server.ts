import type { RequestHandler } from "@sveltejs/kit";
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const rooms: Record<string, {
  roomId: string;
  host: string;
  players: Set<string>;
  song?: { title: string; album: string; artist: string; file: string };
  guesses: Array<{ user: string; title: string; album: string; artist: string }>;
  started: boolean;
  playTime: number;
}> = {};

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const roomId = url.searchParams.get('roomId');
  
  if (!roomId || !rooms[roomId]) {
    ws.close(1008, 'Invalid room');
    return;
  }
  
  const clientId = uuidv4().slice(0, 8);
  ws['id'] = clientId;
  ws['roomId'] = roomId;
  
  rooms[roomId].players.add(clientId);
  
  ws.send(JSON.stringify({ type: 'state', data: rooms[roomId] }));
  broadcast(roomId, { type: 'state', data: rooms[roomId] });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'createRoom') {
        const newRoomId = uuidv4().slice(0, 8);
        rooms[newRoomId] = {
          roomId: newRoomId,
          host: clientId,
          players: new Set([clientId]),
          guesses: [],
          started: false,
          playTime: Math.floor(Math.random() * 6) + 5
        };
        ws['roomId'] = newRoomId;
        ws.send(JSON.stringify({ type: 'roomCreated', roomId: newRoomId }));
        broadcast(newRoomId, { type: 'state', data: rooms[newRoomId] });
      }
      
      else if (data.type === 'joinRoom') { }
      
      else if (data.type === 'uploadSong' && rooms[roomId].host === clientId) {
        rooms[roomId].song = data.song;
        broadcast(roomId, { type: 'state', data: rooms[roomId] });
      }
      
      else if (data.type === 'startGame' && rooms[roomId].host === clientId) {
        rooms[roomId].started = true;
        broadcast(roomId, { type: 'startPlayback', playTime: rooms[roomId].playTime });
      }
      
      else if (data.type === 'submitGuess') {
        if (rooms[roomId].host === clientId) return;
        rooms[roomId].guesses.push({
          user: clientId.slice(0, 6),
          ...data.guess
        });
        broadcast(roomId, { type: 'state', data: rooms[roomId] });
      }
    } catch (err) {
      console.error('Invalid message', err);
    }
  });
  
  ws.on('close', () => {
    if (roomId && rooms[roomId]) {
      rooms[roomId].players.delete(clientId);
      if (rooms[roomId].host === clientId || rooms[roomId].players.size === 0) {
        delete rooms[roomId];
      } else {
        broadcast(roomId, { type: 'state', data: rooms[roomId] });
      }
    }
  });
});

export const GET: RequestHandler = async ({ request }) => {
  const upgradeHeader = request.headers.get('upgrade');
  
  console.log('[WS Route] Incoming Request - Upgrade Header:', upgradeHeader);
  
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected Upgraded: websocket', { status: 426 });
  }
  
  return new Response(null, { status: 101 });
};

function broadcast(roomId: string, message: any) {
  const msg = JSON.stringify(message);
  for (const client of wss.clients) {
    const wsAny = client as any;
    if (wsAny.roomId === roomId && client.readyState === client.OPEN) {
      client.send(msg);
    }
  }
}
