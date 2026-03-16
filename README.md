# Musile - A Music Guesser Multiplayer Game

Made with **Supabase**, it's a **beta**, on-development website game where the host has to upload a song (.mp3/.m4a/.ogg/.flac, etc) and input the song's title, album title, and the artist's name into it.

Players (also known as the **guessers**) have to guess the song after 5 seconds of hearing the music, there are points, ranks and leaderboards to see who can guess more correctly :>

> [!NOTE]
> For `.flac` files, make sure they're not above +50MB or even +20MB is enough due to Supabase's limitations on blob storage, for now Musile uploads the song locally and plays it using fetch. But later as the project grew I'll add it to make it upload to Supabase storage (I recommend to use a .mp3 file for now)

## Setup

Prerequisites:

- Bun.js
- Supabase project (if you want to test this and report a bug or error)
- A Supabase CLI (if again you want to help the project)

Run:

```bash
bun run build
```

Then:

```bash
bun run preview
```

OR

```bash
bun run dev
```

API required (for beta testers or contributors):

```bash
VITE_SUPABASE_URL=XXXXXXXXXXXXXXXXXXXXXX
VITE_SUPABASE_ANON_KEY=XXXXXXXXXXXXXXXXXXXXXX
SUPABASE_DB_PASSWORD=XXXXXXXXX <- Optional though 
```

**"Bu- but Star! How am I supposed to make the SQL in the Supabase SQL Editor to setup the tables!?"**

Here:

```sql
-- rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(8) UNIQUE NOT NULL,
  host_id UUID NOT NULL,
  song_title VARCHAR(255),
  song_album VARCHAR(255),
  song_artist VARCHAR(255),
  song_file VARCHAR(255),
  started BOOLEAN DEFAULT false,
  play_time INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- players table
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  username VARCHAR(255) NOT NULL,
  is_host BOOLEAN DEFAULT false,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- guesses table
CREATE TABLE public.guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  song_title VARCHAR(255) NOT NULL,
  song_album VARCHAR(255) NOT NULL,
  song_artist VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance (OPTIONAL)
CREATE INDEX idx_rooms_room_code ON rooms(room_code);
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_guesses_room_id ON guesses(room_id);
```

## LICENSE

This project is under the license of **GNU AGPL (Affero General Public License)**

That's all it :3 Thank you for your support!!!
