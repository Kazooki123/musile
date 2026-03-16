export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          room_code: string;
          host_id: string;
          song_title: string | null;
          song_album: string | null;
          song_artist: string | null;
          song_file: string | null;
          started: boolean;
          play_time: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_code: string;
          host_id: string;
          song_title?: string | null;
          song_album?: string | null;
          song_artist?: string | null;
          song_file?: string | null;
          started?: boolean;
          play_time?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_code?: string;
          host_id?: string;
          song_title?: string | null;
          song_album?: string | null;
          song_artist?: string | null;
          song_file?: string | null;
          started?: boolean;
          play_time?: number;
          created_at?: string;
        };
      };
      players: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          username: string;
          is_host: boolean;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          username: string;
          is_host?: boolean;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          username?: string;
          is_host?: boolean;
          joined_at?: string;
        };
      };
      guesses: {
        Row: {
          id: string;
          room_id: string;
          player_id: string;
          player_name: string;
          song_title: string;
          song_album: string;
          song_artist: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          player_id: string;
          player_name: string;
          song_title: string;
          song_album: string;
          song_artist: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          player_id?: string;
          player_name?: string;
          song_title?: string;
          song_album?: string;
          song_artist?: string;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
};
