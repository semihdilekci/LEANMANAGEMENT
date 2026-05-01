import { z } from 'zod';

/**
 * Weather klasöründen kopyalanan statik avatar görselleri — DB'de relative key olarak saklanır.
 * URL: `/avatars/weather/${key}.svg`
 */
export const WEATHER_AVATAR_KEYS = [
  'day/rainy/1',
  'day/rainy/2',
  'day/rainy/3',
  'day/rainy/4',
  'evening/clear/1',
  'evening/hot/1',
  'morning/bright',
  'morning/clear/1',
  'morning/clear/2',
  'morning/cloudy',
  'morning/cold/cloudy/2',
  'morning/cold/snow/1',
  'morning/foggy/1',
  'morning/foggy/2',
  'morning/haze/2',
  'morning/hot/1',
  'morning/windy',
  'night/clear/1',
  'night/cloudy',
  'night/cold/clear/1',
  'night/cold/snow',
  'night/foggy',
  'night/hot/clear/2',
  'night/windy',
] as const;

export type WeatherAvatarKey = (typeof WEATHER_AVATAR_KEYS)[number];

const weatherAvatarKeyEnum = z.enum(
  WEATHER_AVATAR_KEYS as unknown as [WeatherAvatarKey, ...WeatherAvatarKey[]],
);

export function weatherAvatarSrc(key: string): string {
  return `/avatars/weather/${key}.svg`;
}

export const UpdateMyAvatarSchema = z
  .object({
    avatarKey: weatherAvatarKeyEnum,
  })
  .strict();

export type UpdateMyAvatarInput = z.infer<typeof UpdateMyAvatarSchema>;
