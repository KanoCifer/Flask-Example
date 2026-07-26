import { create } from 'zustand';

interface VisitorCountState {
  count: number;
  connectionDelay: number;
  isConnected: boolean;
  sendPing: (() => void) | null;
  setCount: (count: number) => void;
  setConnectionDelay: (ms: number) => void;
  setConnected: (connected: boolean) => void;
  setSendPing: (fn: (() => void) | null) => void;
}

export const useVisitorCountStore = create<VisitorCountState>((set) => ({
  count: 0,
  connectionDelay: 0,
  isConnected: false,
  sendPing: null,
  setCount: (count) => set({ count }),
  setConnectionDelay: (ms) => set({ connectionDelay: ms }),
  setConnected: (connected) => set({ isConnected: connected }),
  setSendPing: (fn) => set({ sendPing: fn }),
}));
