import { describe, expect, it } from 'vitest';

import { WEATHER_AVATAR_KEYS } from '@leanmgmt/shared-schemas';

describe('UserAvatar preset keys', () => {
  it('manifest 24 görsel içerir', () => {
    expect(WEATHER_AVATAR_KEYS.length).toBe(24);
  });
});
