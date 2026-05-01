import { describe, expect, it } from 'vitest';

import { UpdateMyAvatarSchema, WEATHER_AVATAR_KEYS, weatherAvatarSrc } from './profile.schemas.js';

describe('profile.schemas', () => {
  it('rejects unknown avatar key', () => {
    const r = UpdateMyAvatarSchema.safeParse({ avatarKey: 'invalid/key' });
    expect(r.success).toBe(false);
  });

  it('accepts known avatar key', () => {
    const key = WEATHER_AVATAR_KEYS[0];
    const r = UpdateMyAvatarSchema.safeParse({ avatarKey: key });
    expect(r.success).toBe(true);
  });

  it('weatherAvatarSrc builds public path', () => {
    expect(weatherAvatarSrc('day/rainy/1')).toBe('/avatars/weather/day/rainy/1.svg');
  });
});
