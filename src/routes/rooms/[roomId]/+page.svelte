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
   
   onMount(async () => {
     try {
       // Fetch room data
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
       
       // Poll for updates
       pollInterval = window.setInterval(pollRoomData, 1000);
     } catch (err) {
       console.error('Error loading room:', err);
       connectionStatus = 'Connection Error';
     }
   });
   
   async function pollRoomData() {
     if (!roomId) return;
     
     try {
       // Fetch room data
       const roomRes = await fetch(`/api/rooms/${roomCode}`);
       if (!roomRes.ok) return;
       const roomData = await roomRes.json();
       
       // Fetch guesses
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
         song_file_path: roomData.song_file_path
       };
     } catch (err) {
       console.error('Error polling room:', err);
     }
   }
   
   onDestroy(() => {
     if (pollInterval) clearInterval(pollInterval);
   });
   
   async function uploadSong() {
     if (!file || uploading) return;
     
     uploading = true;
     
     try {
       const fileExt = file.name.split('.').pop() || 'mp3';
       const fileName = `\( {crypto.randomUUID()}. \){fileExt}`;

       const { data, error } = await supabase.storage
        .from('songs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

       if (error) throw error;

       const { data: urlData } = supabase.storage
        .from('songs')
        .getPublicUrl(fileName);

       const publicUrl = urlData.publicUrl;

       const { error: dbError } = await supabase
        .from('rooms')
        .update({
          song_file_path: fileName,
          song_title: song.title,
          song_album: song.album,
          song_artist: song.artist,
          play_time_seconds: Math.floor(Math.random() * 6) + 5
        })
        .eq('code', roomId);

       if (dbError) throw dbError;

       console.log('Songs uploaded & saved:', publicUrl);

       // playAudioPreview(publicUrl);
     } catch (e) {
       alert('Error uploading file!');
       console.error('Upload Failed!', e);
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

     const audio = new Audio(audioUrl);
     audio.play().catch(e => console.error('Audio play failed:', e));
     
     
     setTimeout(() => {
       audio.pause();
       audio.currentTime = 0;
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
              <input type="file" accept="audio/*" on:change={(e) => file = (e.target as HTMLInputElement).files?.[0]} class="file-input" />
              <input bind:value={song.title} placeholder="Correct Song Title" />
              <input bind:value={song.album} placeholder="Correct Album" />
              <input bind:value={song.artist} placeholder="Correct Artist Name" />
              <button class="upload-btn" on:click={uploadSong} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload Song'}
              </button>
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
    background: linear-gradient(135deg, #6F4E37 0%, #4B3A2A 100%);
    padding: 20px;
    font-family: 'Arial', sans-serif;
  }
  
  .room-header {
    text-align: center;
    color: #FFF5E1;
    margin-bottom: 30px;
  }
  
  .room-header h1 {
    font-size: 2.5rem;
    margin: 0;
    font-weight: bold;
  }
  
  .room-code {
    color: #D2B48C;
    font-weight: bold;
  }
  
  .player-count {
    margin: 10px 0 0 0;
    font-size: 1.1rem;
    color: #D2B48C;
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
    color: #6F4E37;
    margin-top: 0;
    border-bottom: 2px solid #D2B48C;
    padding-bottom: 10px;
  }
  
  .section-title {
    font-weight: bold;
    color: #4B3A2A;
    margin-bottom: 15px;
  }
  
  .song-preview {
    background: #FFF5E1;
    padding: 15px;
    border-radius: 8px;
    border-left: 4px solid #A67B5B;
  }
  
  .song-info {
    margin: 8px 0;
    color: #4B3A2A;
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
    background: #6F4E37;
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
    background: #A67B5B;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(107, 78, 55, 0.3);
  }
  
  .upload-btn:disabled {
    background: #999;
    cursor: not-allowed;
    transform: none;
  }
  
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
    border-left: 4px solid #A67B5B;
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
    color: #6F4E37;
    min-width: 40px;
  }
  
  .guess-details {
    flex: 1;
  }
  
  .player-name {
    margin: 0;
    font-weight: bold;
    color: #4B3A2A;
  }
  
  .guess-text {
    margin: 5px 0 0 0;
    font-size: 0.9rem;
    color: #666;
  }
  
  .score {
    font-weight: bold;
    color: #6F4E37;
  }
  
  .score-value {
    font-size: 1.1rem;
    color: #A67B5B;
  }
</style>
