import { writable } from 'svelte/store';
import type { RoomState } from './types';

export const roomState = writable<RoomState | null>(null);
export const userId = writable<string>('');
export const isHost = writable<boolean>(false);