import { describe, it, expect } from 'vitest';
import { weatherIcon, formatDistance, formatDuration } from '../fishing';

describe('weatherIcon', () => {
  it('returns ☀️ for 晴', () => {
    expect(weatherIcon('晴')).toBe('☀️');
  });
  it('returns ⛅ for 多云', () => {
    expect(weatherIcon('多云')).toBe('⛅');
  });
  it('returns ☁️ for 阴', () => {
    expect(weatherIcon('阴')).toBe('☁️');
  });
  it('returns ⛈️ for 雷', () => {
    expect(weatherIcon('雷阵雨')).toBe('⛈️');
  });
  it('returns 🌧️ for 雨', () => {
    expect(weatherIcon('小雨')).toBe('🌧️');
  });
  it('returns ❄️ for 雪', () => {
    expect(weatherIcon('雪')).toBe('❄️');
  });
  it('returns 💨 for 风', () => {
    expect(weatherIcon('大风')).toBe('💨');
  });
  it('returns 🌫️ for 雾/霾', () => {
    expect(weatherIcon('雾霾')).toBe('🌫️');
  });
  it('returns 🌤️ default for empty', () => {
    expect(weatherIcon('')).toBe('🌤️');
  });
});

describe('formatDistance', () => {
  it('returns 米 under 1000', () => {
    expect(formatDistance(500)).toBe('500 米');
  });
  it('returns 公里 at/over 1000', () => {
    expect(formatDistance(1500)).toBe('1.5 公里');
  });
});

describe('formatDuration', () => {
  it('returns 分钟 under 3600', () => {
    expect(formatDuration(1800)).toBe('30 分钟');
  });
  it('returns 小时+分钟 at/over 3600', () => {
    expect(formatDuration(5400)).toBe('1 小时 30 分钟');
  });
});
