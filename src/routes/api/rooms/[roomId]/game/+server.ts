import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const PATCH: RequestHandler = async ({ params, request }) => {
  try {
    const { roomId } = params;
    const { started } = await request.json();

    const { data, error } = await supabase
      .from('rooms')
      .update({ started })
      .eq('id', roomId)
      .select()
      .maybeSingle();

    if (error) throw error;

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    console.error('Error starting game:', err);
    return new Response(JSON.stringify({ error: 'Failed to start game' }), { status: 500 });
  }
};
