import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { roomCode } = params;

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', roomCode)
      .maybeSingle();

    if (roomError || !room) {
      return new Response(JSON.stringify({ error: 'Room not found' }), { status: 404 });
    }

    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id);

    if (playersError) throw playersError;

    return new Response(
      JSON.stringify({
        roomId: room.id,
        roomCode: room.room_code,
        hostId: room.host_id,
        song: room.song_file
          ? {
              title: room.song_title,
              album: room.song_album,
              artist: room.song_artist,
              file: room.song_file,
            }
          : null,
        players: players || [],
        started: room.started,
        playTime: room.play_time,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error fetching room:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch room' }), { status: 500 });
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { roomCode } = params;
    const { userId, username } = await request.json();

    if (!userId || !username) {
      return new Response(JSON.stringify({ error: 'userId and username required' }), {
        status: 400,
      });
    }

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_code', roomCode)
      .maybeSingle();

    if (roomError || !room) {
      return new Response(JSON.stringify({ error: 'Room not found' }), { status: 404 });
    }

    // Add player to room
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        room_id: room.id,
        user_id: userId,
        username,
        is_host: false,
      })
      .select()
      .maybeSingle();

    if (playerError) throw playerError;

    return new Response(JSON.stringify({ roomId: room.id, player }), { status: 201 });
  } catch (err) {
    console.error('Error joining room:', err);
    return new Response(JSON.stringify({ error: 'Failed to join room' }), { status: 500 });
  }
};
