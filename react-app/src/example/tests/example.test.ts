import { describe, it, expect } from 'vitest';
import { greet } from '../index';

describe('example', () => {
  it('greets by name', () => {
    expect(greet('world')).toBe('Hello, world');
  });
});
