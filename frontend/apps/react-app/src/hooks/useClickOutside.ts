import { useEffect, type RefObject } from 'react';

export const useClickOutside = (
  ref: RefObject<HTMLElement | null>,
  callback: () => void,
) => {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () =>
      document.removeEventListener('pointerdown', handleClickOutside);
  }, [ref, callback]);
};
