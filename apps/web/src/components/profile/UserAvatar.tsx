'use client';

import Image from 'next/image';

import { WEATHER_AVATAR_KEYS, weatherAvatarSrc } from '@leanmgmt/shared-schemas';

export interface UserAvatarProps {
  avatarKey?: string | null;
  /** Piksel — layout için */
  size?: number;
  className?: string;
}

/** Weather preset avatar — dekoratif illustration */
export function UserAvatar({ avatarKey, size = 40, className }: UserAvatarProps) {
  const key =
    avatarKey && (WEATHER_AVATAR_KEYS as readonly string[]).includes(avatarKey)
      ? avatarKey
      : WEATHER_AVATAR_KEYS[0];
  const src = weatherAvatarSrc(key);

  return (
    <span
      className={
        'relative inline-block shrink-0 overflow-hidden rounded-full bg-[var(--color-neutral-100)] ' +
        (className ?? '')
      }
      style={{ width: size, height: size }}
    >
      <Image src={src} alt="" width={size} height={size} className="object-cover" unoptimized />
    </span>
  );
}
