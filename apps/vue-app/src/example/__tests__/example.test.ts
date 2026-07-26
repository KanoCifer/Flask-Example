import { describe, expect, it } from 'vitest';
import { hello } from '../index';

describe('example', () => {
  it('greets through the entry point', () => {
    expect(hello('world')).toBe('hello, world');
  });
});
