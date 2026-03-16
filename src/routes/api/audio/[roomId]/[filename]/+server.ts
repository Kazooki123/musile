import type { RequestHandler } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const filePath = path.join(process.cwd(), 'static/uploads', params.filename);

    const file = await fs.readFile(filePath);
    return new Response(file, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
  }
};
