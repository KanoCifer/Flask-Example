import { greet } from './lib/impl';

/** Public entry point — the only thing outsiders import. */
export const hello = (name: string): string => greet(name);
