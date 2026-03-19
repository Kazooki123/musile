<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { roomState, isHost, userId } from '$lib/stores';
  import type { Song, Guess } from '$lib/types';
  import { supabase } from '$lib/supabaseClient';

  const roomCode = $page.params.roomId;

  let connectionStatus = 'Loading...';
  let audioElement: HTMLAudioElement;
  let file: File | undefined = undefined;
  let song: Omit<Song, 'file'> = { title: '', album: '', artist: '' };
  let guess: Omit<Guess, 'user'> = { title: '', album: '', artist: '' };
  let uploadedFileName = '';
  let uploading = false;
  let isAudioPlaying = false;
  let roomId = '';
  let username = '';
  let pollInterval: number;

  let fallbackFiles: { name: string; url: string }[] = [];
  let showFallback = false;
  let loadingFallback = false;
  let uploadError = '';

  onMount(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomCode}`);
      if (!res.ok) {
        connectionStatus = 'Room not found';
        setTimeout(() => goto('/'), 2000);
        return;
      }

      const data = await res.json();
      roomId = data.roomId;
      $roomState = {
        roomId: data.roomId,
        host: data.hostId,
        players: data.players.map((p: any) => p.username),
        song: data.song,
        guesses: [],
        started: data.started,
        playTime: data.playTime,
        song_file_path: data.song_file_path,
      };

      $isHost = data.hostId === $userId;
      connectionStatus = 'Connected';

      pollInterval = window.setInterval(pollRoomData, 1000);
    } catch (err) {
      console.error('Error loading room:', err);
      connectionStatus = 'Connection Error';
    }
  });

  async function pollRoomData() {
    if (!roomId) return;

    try {
      const roomRes = await fetch(`/api/rooms/${roomCode}`);
      if (!roomRes.ok) return;
      const roomData = await roomRes.json();

      const guessRes = await fetch(`/api/guesses?roomId=${roomId}`);
      const guesses = guessRes.ok ? await guessRes.json() : [];

      $roomState = {
        roomId: roomData.roomId,
        host: roomData.hostId,
        players: roomData.players.map((p: any) => p.username),
        song: roomData.song,
        guesses: guesses.map((g: any) => ({
          user: g.player_name,
          title: g.song_title,
          album: g.song_album,
          artist: g.song_artist,
        })),
        started: roomData.started,
        playTime: roomData.playTime,
        song_file_path: roomData.song_file_path,
      };
    } catch (err) {
      console.error('Error polling room:', err);
    }
  }

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  async function loadFallbackFiles() {
    loadingFallback = true;
    fallbackFiles = [];

    try {
      const { data, error } = await supabase.storage
        .from('songs')
        .list('', {
          limit: 50,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'webm'];
      const audioFiles = (data ?? []).filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        return audioExtensions.includes(ext);
      });

      fallbackFiles = audioFiles.map((f) => {
        const { data: urlData } = supabase.storage.from('songs').getPublicUrl(f.name);
        return { name: f.name, url: urlData.publicUrl };
      });

      showFallback = true;
    } catch (e) {
      console.error('Failed to list bucket files:', e);
      uploadError = 'Could not list existing files either. Check your bucket permissions.';
    } finally {
      loadingFallback = false;
    }
  }

  async function selectFallbackFile(fileName: string, publicUrl: string) {
    if (!song.title || !song.album || !song.artist) {
      uploadError = 'Please fill in the song title, album, and artist before selecting a file.';
      return;
    }

    uploading = true;
    uploadError = '';

    try {
      const { error: dbError } = await supabase
        .from('rooms')
        .update({
          song_file_path: fileName,
          song_title: song.title,
          song_album: song.album,
          song_artist: song.artist,
          play_time_seconds: Math.floor(Math.random() * 6) + 5,
        })
        .eq('code', roomCode);

      if (dbError) throw dbError;

      showFallback = false;
      uploadError = '';
      console.log('Used existing file:', publicUrl);
      await pollRoomData();
    } catch (e) {
      console.error('Failed to save existing file to room:', e);
      uploadError = 'Failed to save the selected file to the room.';
    } finally {
      uploading = false;
    }
  }

  async function uploadSong() {
    if (!file || uploading) return;

    uploading = true;
    uploadError = '';
    showFallback = false;
    fallbackFiles = [];

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'mp3';
      const uuid = crypto.randomUUID();
      const fileName = `${uuid}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('songs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || `audio/${fileExt}`,
        });

      if (error) {
        console.error('Upload error:', error);
        uploadError = `Upload failed: ${error.message}. Checking for existing files in your bucket…`;

        await loadFallbackFiles();
        return;
      }

      const { data: urlData } = supabase.storage.from('songs').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      const { error: dbError } = await supabase
        .from('rooms')
        .update({
          song_file_path: fileName,
          song_title: song.title,
          song_album: song.album,
          song_artist: song.artist,
          play_time_seconds: Math.floor(Math.random() * 6) + 5,
        })
        .eq('code', roomCode);

      if (dbError) throw dbError;

      uploadedFileName = fileName;
      uploadError = '';
      console.log('Song uploaded & saved:', publicUrl);
      await pollRoomData();
    } catch (e: any) {
      console.error('Upload failed:', e);
      uploadError = `Something went wrong: ${e?.message ?? e}. Checking for existing files…`;
      await loadFallbackFiles();
    } finally {
      uploading = false;
    }
  }

  async function startGame() {
    if (!roomId) return;

    try {
      const res = await fetch(`/api/rooms/${roomId}/game`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ started: true }),
      });

      if (res.ok) {
        await pollRoomData();
        setTimeout(() => playAudio($roomState?.playTime || 30), 500);
      }
    } catch (err) {
      console.error('Error starting game:', err);
    }
  }

  function playAudio(playTime: number) {
    if (!$roomState?.song_file_path) return;

    const { data } = supabase.storage
      .from('songs')
      .getPublicUrl($roomState.song_file_path);

    const audioUrl = data.publicUrl;
    isAudioPlaying = true;

    const audio = new Audio(audioUrl);
    audio.play().catch((e) => {
      console.error('Audio play failed:', e);
      isAudioPlaying = false;
    });

    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      isAudioPlaying = false;
    }, playTime * 1000);
  }

  async function submitGuess() {
    if (!roomId || !$userId) return;

    try {
      const res = await fetch('/api/guesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          userId: $userId,
          username: username || `User_${$userId.slice(0, 6)}`,
          songTitle: guess.title,
          songAlbum: guess.album,
          songArtist: guess.artist,
        }),
      });

      if (res.ok) {
        guess = { title: '', album: '', artist: '' };
        await pollRoomData();
      }
    } catch (err) {
      console.error('Error submitting guess:', err);
    }
  }

  function calculateScore(g: Guess) {
    if (!$roomState?.song) return 0;
    let score = 0;
    if (g.title.toLowerCase() === $roomState.song.title.toLowerCase()) score += 1;
    if (g.album.toLowerCase() === $roomState.song.album.toLowerCase()) score += 1;
    if (g.artist.toLowerCase() === $roomState.song.artist.toLowerCase()) score += 1;
    return score;
  }
</script>

<div class="container">
  <header class="room-header">
    <h1>🎵 Room: <span class="room-code">{roomId}</span></h1>
    <p class="player-count">👥 {$roomState?.players.length || 0} Player{($roomState?.players.length || 0) !== 1 ? 's' : ''}</p>
  </header>

  <div class="content">
    {#if $isHost}
      <div class="host-section">
        <h2>Host Controls</h2>
        {#if !$roomState?.song}
          <div class="upload-section">
            <p class="section-title">Upload Song</p>
            <input
              type="file"
              accept="audio/*"
              on:change={(e) => (file = (e.target as HTMLInputElement).files?.[0])}
              class="file-input"
            />
            <input bind:value={song.title} placeholder="Correct Song Title" />
            <input bind:value={song.album} placeholder="Correct Album" />
            <input bind:value={song.artist} placeholder="Correct Artist Name" />
            <button class="upload-btn" on:click={uploadSong} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Song'}
            </button>

            {#if uploadError}
              <div class="error-box">
                <p>⚠️ {uploadError}</p>
              </div>
            {/if}

            {#if showFallback}
              <div class="fallback-section">
                <p class="section-title">📂 Files already in your bucket</p>

                {#if loadingFallback}
                  <p class="loading-text">Loading files…</p>
                {:else if fallbackFiles.length === 0}
                  <p class="empty-text">No audio files found in the bucket.</p>
                {:else}
                  <p class="fallback-hint">
                    Make sure song title, album & artist are filled in, then pick a file below:
                  </p>
                  <div class="fallback-list">
                    {#each fallbackFiles as f}
                      <div class="fallback-item">
                        <div class="fallback-info">
                          <span class="fallback-name">🎵 {f.name}</span>
                          <audio controls src={f.url} class="fallback-audio"></audio>
                        </div>
                        <button
                          class="select-btn"
                          on:click={() => selectFallbackFile(f.name, f.url)}
                          disabled={uploading}
                        >
                          Use This
                        </button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {:else}
          <div class="song-preview">
            <p class="section-title">Song Selected!!</p>
            <p class="song-info">🎵 {$roomState.song.title}</p>
            <p class="song-info">💿 {$roomState.song.album}</p>
            <p class="song-info">⭐ {$roomState.song.artist}</p>
            <button class="start-btn" on:click={startGame}>Start Guessing Game!</button>
          </div>
        {/if}
      </div>
    {/if}

    {#if $roomState?.started && !$isHost}
      <div class="guess-section">
        <h2>🎧 Guess!</h2>
        <p class="audio-status" class:playing={isAudioPlaying}>
          {isAudioPlaying ? '🔊 Audio is playing...' : '🔇 Audio ended'}
        </p>
        <input bind:value={guess.title} placeholder="Guess the Song Title" />
        <input bind:value={guess.album} placeholder="Guess the Album Name" />
        <input bind:value={guess.artist} placeholder="Guess the Artist Name" />
        <button class="submit-btn" on:click={submitGuess}>Submit Guess</button>
      </div>
    {/if}

    {#if $roomState?.guesses && $roomState.guesses.length > 0}
      <div class="guesses-section">
        <h2>⭐ Leaderboard</h2>
        <div class="guesses-list">
          {#each $roomState.guesses as g, idx}
            <div class="guess-item" class:winner={calculateScore(g) === 3}>
              <div class="guess-rank">#{idx + 1}</div>
              <div class="guess-details">
                <p class="player-name">{g.user}</p>
                <p class="guess-text">🎵 {g.title} • 💿 {g.album} • 🎤 {g.artist}</p>
              </div>
              <div class="score">Score: <span class="score-value">{calculateScore(g)}/3</span></div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #6f4e37 0%, #4b3a2a 100%);
    padding: 20px;
    font-family: 'Arial', sans-serif;
  }

  .room-header {
    text-align: center;
    color: #fff5e1;
    margin-bottom: 30px;
  }

  .room-header h1 {
    font-size: 2.5rem;
    margin: 0;
    font-weight: bold;
  }

  .room-code {
    color: #d2b48c;
    font-weight: bold;
  }

  .player-count {
    margin: 10px 0 0 0;
    font-size: 1.1rem;
    color: #d2b48c;
  }

  .content {
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    padding: 30px;
    max-width: 600px;
    width: 100%;
  }

  .host-section,
  .guess-section,
  .guesses-section {
    margin-bottom: 30px;
  }

  .host-section h2,
  .guess-section h2,
  .guesses-section h2 {
    color: #6f4e37;
    margin-top: 0;
    border-bottom: 2px solid #d2b48c;
    padding-bottom: 10px;
  }

  .section-title {
    font-weight: bold;
    color: #4b3a2a;
    margin-bottom: 15px;
  }

  .song-preview {
    background: #fff5e1;
    padding: 15px;
    border-radius: 8px;
    border-left: 4px solid #a67b5b;
  }

  .song-info {
    margin: 8px 0;
    color: #4b3a2a;
    font-weight: 500;
  }

  .file-input {
    display: block;
    margin-bottom: 15px;
  }

  .upload-btn,
  .start-btn,
  .submit-btn {
    width: 100%;
    padding: 12px;
    background: #6f4e37;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s;
    margin-top: 10px;
  }

  .upload-btn:hover,
  .start-btn:hover,
  .submit-btn:hover {
    background: #a67b5b;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(107, 78, 55, 0.3);
  }

  .upload-btn:disabled {
    background: #999;
    cursor: not-allowed;
    transform: none;
  }

  /* ── Err Box ── */
  .error-box {
    margin-top: 12px;
    padding: 12px 15px;
    background: #fff0f0;
    border: 1px solid #f5c6cb;
    border-radius: 6px;
    color: #842029;
    font-size: 0.9rem;
  }

  .error-box p {
    margin: 0;
  }

  .fallback-section {
    margin-top: 20px;
    padding: 15px;
    background: #f8f4ef;
    border-radius: 8px;
    border: 1px dashed #a67b5b;
  }

  .fallback-hint {
    font-size: 0.85rem;
    color: #666;
    margin-bottom: 12px;
  }

  .loading-text,
  .empty-text {
    color: #888;
    font-size: 0.9rem;
    text-align: center;
    padding: 10px 0;
  }

  .fallback-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .fallback-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px;
    background: white;
    border-radius: 6px;
    border: 1px solid #d2b48c;
  }

  .fallback-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .fallback-name {
    font-size: 0.8rem;
    color: #4b3a2a;
    word-break: break-all;
    font-weight: 600;
  }

  .fallback-audio {
    width: 100%;
    height: 32px;
  }

  .select-btn {
    padding: 8px 14px;
    background: #6f4e37;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    white-space: nowrap;
    font-size: 0.85rem;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .select-btn:hover {
    background: #a67b5b;
  }

  .select-btn:disabled {
    background: #999;
    cursor: not-allowed;
  }

  /* ── Audio status ── */
  .audio-status {
    padding: 10px;
    background: #fff3cd;
    border-radius: 4px;
    color: #856404;
    text-align: center;
    margin-bottom: 15px;
    font-weight: bold;
  }

  .audio-status.playing {
    background: #d4edda;
    color: #155724;
  }

  /* ── Leaderboard ── */
  .guesses-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .guess-item {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px;
    background: #f5f5f5;
    border-radius: 6px;
    border-left: 4px solid #a67b5b;
    transition: all 0.2s;
  }

  .guess-item.winner {
    background: #fff3cd;
    border-left-color: #ffc107;
    box-shadow: 0 2px 8px rgba(255, 193, 7, 0.2);
  }

  .guess-rank {
    font-weight: bold;
    font-size: 1.2rem;
    color: #6f4e37;
    min-width: 40px;
  }

  .guess-details {
    flex: 1;
  }

  .player-name {
    margin: 0;
    font-weight: bold;
    color: #4b3a2a;
  }

  .guess-text {
    margin: 5px 0 0 0;
    font-size: 0.9rem;
    color: #666;
  }

  .score {
    font-weight: bold;
    color: #6f4e37;
  }

  .score-value {
    font-size: 1.1rem;
    color: #a67b5b;
  }
</style>
