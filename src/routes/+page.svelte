<script lang="ts">
   import { goto } from '$app/navigation';
   import { userId, isHost } from '$lib/stores';
   import { onMount } from 'svelte';
   import { v4 as uuidv4 } from 'uuid';

   let status = 'Ready';
   let roomCode = '';
   let username = '';
   let error = '';
   let isLoading = false;
   
   onMount(() => {
     // Generate or restore user ID
     const stored = localStorage.getItem('userId');
     if (stored) {
       $userId = stored;
     } else {
       const newId = uuidv4();
       $userId = newId;
       localStorage.setItem('userId', newId);
     }
   });
   
   async function createRoom() {
     if (!$userId) {
       error = 'Failed to generate user ID';
       return;
     }
     
     isLoading = true;
     error = '';
     
     try {
       const res = await fetch('/api/rooms', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ userId: $userId }),
       });
       
       if (!res.ok) throw new Error('Failed to create room');
       
       const { roomId, roomCode: code } = await res.json();
       $isHost = true;
       goto(`/rooms/${code}`);
     } catch (err) {
       error = 'Failed to create room. Please try again.';
       console.error('Error creating room:', err);
     } finally {
       isLoading = false;
     }
   }
   
   async function joinRoom() {
     if (!roomCode.trim()) {
       error = 'Please enter a room code';
       return;
     }
     
     if (!username.trim()) {
       error = 'Please enter your username';
       return;
     }
     
     isLoading = true;
     error = '';
     
     try {
       const res = await fetch(`/api/rooms/${roomCode.toUpperCase()}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ userId: $userId, username }),
       });
       
       if (!res.ok) {
         if (res.status === 404) throw new Error('Room not found');
         throw new Error('Failed to join room');
       }
       
       $isHost = false;
       goto(`/rooms/${roomCode.toUpperCase()}`);
     } catch (err) {
       error = err instanceof Error ? err.message : 'Failed to join room';
       console.error('Error joining room:', err);
     } finally {
       isLoading = false;
     }
   }
</script>

<div class="container">
    <header class="header">
      <h1>🎵 Musile :3</h1>
      <p class="subtitle">Music Guesser Multiplayer!!</p>
      <p>Status: {status}</p>
    </header>
    
    <div class="content">
      <div class="section">
        <h2>Create New Game</h2>
        <button class="primary-btn" on:click={createRoom} disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Room'}
        </button>
      </div>
      
      <div class="divider">OR</div>
      
      <div class="section">
        <h2>Join Existing Game</h2>
        {#if error}
          <p class="error">{error}</p>
        {/if}
        <input 
          bind:value={roomCode} 
          placeholder="Enter Room Code" 
          on:focus={() => error = ''}
        />
        <input 
          bind:value={username} 
          placeholder="Your Name"
          on:focus={() => error = ''}
        />
        <button class="primary-btn" on:click={joinRoom} disabled={isLoading}>
          {isLoading ? 'Joining...' : 'Join Room!'}
        </button>
      </div>
    </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
  
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #6F4E37 0%, #4B3A2A 100%);
    padding: 20px;
  }
  
  .header {
    text-align: center;
    color: #FFF5E1;
    margin-bottom: 40px;
  }
  
  .header h1 {
    font-size: 3.5rem;
    margin: 0;
    font-weight: bold;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  .subtitle {
    font-size: 1.2rem;
    margin: 10px 0 0 0;
    color: #D2B48C;
  }
  
  .content {
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    padding: 40px;
    max-width: 450px;
    width: 100%;
  }
  
  .section {
    margin-bottom: 30px;
  }
  
  .section h2 {
    color: #6F4E37;
    margin-top: 0;
    font-size: 1.5rem;
  }
  
  .divider {
    text-align: center;
    color: #999;
    margin: 30px 0;
    font-weight: bold;
    position: relative;
  }
  
  .divider::before,
  .divider::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 45%;
    height: 1px;
    background: #ddd;
  }
  
  .divider::before {
    left: 0;
  }
  
  .divider::after {
    right: 0;
  }
  
  .error {
    color: #d32f2f;
    padding: 10px;
    background: #ffebee;
    border-radius: 4px;
    margin-bottom: 15px;
    font-size: 0.95rem;
  }
  
  :global(.primary-btn) {
    width: 100%;
    padding: 12px;
    background: #6F4E37;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s;
  }
  
  :global(.primary-btn:hover) {
    background: #A67B5B;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(107, 78, 55, 0.3);
  }
</style>
