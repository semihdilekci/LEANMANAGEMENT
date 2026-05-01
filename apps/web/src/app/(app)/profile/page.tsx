import type { Metadata } from 'next';

import { ProfilePage } from '@/components/profile/ProfilePage';

export const metadata: Metadata = {
  title: 'Profilim',
};

export default function ProfileRoutePage() {
  return <ProfilePage />;
}
