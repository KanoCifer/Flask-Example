import { describe, it, expect } from 'vitest';
import {
  truncateSummary,
  getFeedHost,
  getFeedProtocol,
  getSubscriptionTitle,
} from '../rss';

describe('truncateSummary', () => {
  it('returns empty for falsy', () => {
    expect(truncateSummary('')).toBe('');
  });
  it('strips html tags', () => {
    expect(truncateSummary('<p>hello</p>')).toBe('hello');
  });
  it('returns short text as-is', () => {
    expect(truncateSummary('short')).toBe('short');
  });
  it('truncates at maxLength with ...', () => {
    const long = 'a'.repeat(200);
    expect(truncateSummary(long)).toBe('a'.repeat(160) + '...');
  });
});

describe('getFeedHost', () => {
  it('extracts hostname', () => {
    expect(getFeedHost('https://sspai.com/feed')).toBe('sspai.com');
  });
  it('returns raw on invalid url', () => {
    expect(getFeedHost('not a url')).toBe('not a url');
  });
});

describe('getFeedProtocol', () => {
  it('returns HTTPS for https url', () => {
    expect(getFeedProtocol('https://x.com/feed')).toBe('HTTPS');
  });
  it('returns HTTP for http url', () => {
    expect(getFeedProtocol('http://x.com/feed')).toBe('HTTP');
  });
  it('returns URL for invalid', () => {
    expect(getFeedProtocol('invalid')).toBe('URL');
  });
});

describe('getSubscriptionTitle', () => {
  it('uses feedTitle when present', () => {
    expect(getSubscriptionTitle({ feedTitle: 'My Feed', rssUrl: 'https://x.com' })).toBe('My Feed');
  });
  it('falls back to feed_title', () => {
    expect(getSubscriptionTitle({ feed_title: 'Alt', rssUrl: 'https://x.com' })).toBe('Alt');
  });
  it('falls back to host when no title', () => {
    expect(getSubscriptionTitle({ rssUrl: 'https://sspai.com/feed' })).toBe('sspai.com');
  });
});
