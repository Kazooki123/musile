import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), { status: 400 });
    }

    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomId = uuidv4();

    const { data, error } = await supabase.from('rooms').insert({
      id: roomId,
      room_code: roomCode,
      host_id: userId,
      started: false,
      play_time: Math.floor(Math.random() * 6) + 5,
    }).select().maybeSingle();

    if (error) throw error;

    // Adds a host as a player
    await supabase.from('players').insert({
      room_id: roomId,
      user_id: userId,
      username: `Host_${roomCode.slice(0, 4)}`,
      is_host: true,
    });

    return new Response(JSON.stringify({ roomId, roomCode }), { status: 201 });
  } catch (err) {
    console.error('Error creating room:', err);
    return new Response(JSON.stringify({ error: 'Failed to create room' }), { status: 500 });
  }
};
