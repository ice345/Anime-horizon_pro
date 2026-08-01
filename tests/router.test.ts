import { describe, expect, it } from 'vitest';
import { getCanonicalPath, getPathForRoute, getRouteFromPath } from '../services/router';

describe('app routing boundary', () => {
  it('keeps the two supported paths canonical', () => {
    expect(getRouteFromPath('/')).toBe('guide');
    expect(getRouteFromPath('/archive')).toBe('record');
    expect(getPathForRoute('record')).toBe('/archive');
  });

  it('normalizes unknown and trailing paths to the guide entry', () => {
    expect(getCanonicalPath('/archive/')).toBe('/');
    expect(getCanonicalPath('/unknown')).toBe('/');
  });
});
