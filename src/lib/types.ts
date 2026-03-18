export interface Song {
  title: string;
  album: string;
  artist: string;
  file: string;
}

export interface Guess {
  user: string;
  title: string;
  album: string;
  artist: string;
}

export interface RoomState {
  roomId: string;
  host: string;
  players: string[];
  song?: Song;
  guesses: Guess[];
  started: boolean;
  playTime: number;
  song_file_path: string;
}