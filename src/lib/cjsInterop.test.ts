import { describe, expect, it } from 'vitest';
import { resolveCjsDefault } from './cjsInterop';

const fn = () => 'ok';

describe('resolveCjsDefault', () => {
  it('returns a plain function', () => {
    expect(resolveCjsDefault<typeof fn>(fn)()).toBe('ok');
  });
  it('unwraps a single default wrapper', () => {
    expect(resolveCjsDefault<typeof fn>({ default: fn })()).toBe('ok');
  });
  it('unwraps a double default wrapper', () => {
    expect(resolveCjsDefault<typeof fn>({ default: { default: fn } })()).toBe('ok');
  });
  it('throws when no function is found', () => {
    expect(() => resolveCjsDefault({ default: {} })).toThrow(TypeError);
  });
});
