import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { SESSION_HINT_COOKIE } from '@/lib/auth-session-hint';

export default async function HomePage(): Promise<never> {
  const c = await cookies();
  const hint = c.get(SESSION_HINT_COOKIE)?.value === '1';
  if (hint) {
    redirect('/dashboard');
  }
  redirect('/login');
}
