import { describe, it, expect } from 'vitest';
import { useImageError } from '../useImageError';

describe('useImageError', () => {
  it('handleImageError 隐藏目标图片', () => {
    const { handleImageError } = useImageError();

    const img = document.createElement('img');
    img.style.display = 'block';
    document.body.appendChild(img);

    handleImageError({ target: img } as unknown as Event);
    expect(img.style.display).toBe('none');
  });
});
