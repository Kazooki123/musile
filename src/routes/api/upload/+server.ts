import type { RequestHandler } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

const uploadDir = path.join(process.cwd(), 'static/uploads');
await fs.mkdir(uploadDir, { recursive: true });

export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const audio = formData.get('audio') as File;

    if (!audio) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), { status: 400 });
    }

    const filename = `${Date.now()}_${audio.name}`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, Buffer.from(await audio.arrayBuffer()));

    return new Response(JSON.stringify({ filename }), { status: 201 });
  } catch (err) {
    console.error('Error uploading audio:', err);
    return new Response(JSON.stringify({ error: 'Failed to upload audio' }), { status: 500 });
  }
};

