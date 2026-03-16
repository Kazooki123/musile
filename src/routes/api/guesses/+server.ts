import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { roomId, userId, username, songTitle, songAlbum, songArtist } = await request.json();

    if (!roomId || !userId || !username) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const { data: guess, error } = await supabase
      .from('guesses')
      .insert({
        room_id: roomId,
        player_id: userId,
        player_name: username,
        song_title: songTitle || '',
        song_album: songAlbum || '',
        song_artist: songArtist || '',
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    return new Response(JSON.stringify(guess), { status: 201 });
  } catch (err) {
    console.error('Error submitting guess:', err);
    return new Response(JSON.stringify({ error: 'Failed to submit guess' }), { status: 500 });
  }
};

export const GET: RequestHandler = async ({ url }) => {
  try {
    const roomId = url.searchParams.get('roomId');

    if (!roomId) {
      return new Response(JSON.stringify({ error: 'roomId required' }), { status: 400 });
    }

    const { data: guesses, error } = await supabase
      .from('guesses')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return new Response(JSON.stringify(guesses), { status: 200 });
  } catch (err) {
    console.error('Error fetching guesses:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch guesses' }), { status: 500 });
  }
};
