import { describe, it, expect } from 'vitest';
import { stripHtml } from '../stripHtml';

describe('stripHtml', () => {
  it('removes simple HTML tags', () => {
    expect(stripHtml('<p>hello</p>')).toBe('hello');
  });

  it('removes nested HTML tags', () => {
    expect(stripHtml('<div><span>a</span><b>b</b></div>')).toBe('ab');
  });

  it('removes self-closing tags', () => {
    expect(stripHtml('hello<br/>world')).toBe('helloworld');
    expect(stripHtml('hello<img src="x"/>world')).toBe('helloworld');
  });

  it('trims leading and trailing whitespace', () => {
    expect(stripHtml('  <p>hi</p>  ')).toBe('hi');
    expect(stripHtml('\n<p>hi</p>\n')).toBe('hi');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('just plain text')).toBe('just plain text');
  });

  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  it('returns empty string for tag-only input', () => {
    expect(stripHtml('<p></p>')).toBe('');
    expect(stripHtml('<br/>')).toBe('');
  });

  it('preserves HTML entities (does not decode)', () => {
    expect(stripHtml('a &amp; b')).toBe('a &amp; b');
    expect(stripHtml('&lt;not-a-tag&gt;')).toBe('&lt;not-a-tag&gt;');
  });

  it('does not interpret script content as a tag', () => {
    expect(stripHtml('<script>alert(1)</script>')).toBe('alert(1)');
  });

  it('preserves internal whitespace (no normalization)', () => {
    expect(stripHtml('<p>a</p>  <p>b</p>')).toBe('a  b');
  });
});