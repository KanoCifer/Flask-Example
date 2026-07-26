import { create } from 'zustand';

interface deviceState {
  isMobile: boolean;
}

export const useDeviceStore = create<deviceState>(() => ({
  isMobile: window.matchMedia('(max-width: 768px)').matches,
}));
