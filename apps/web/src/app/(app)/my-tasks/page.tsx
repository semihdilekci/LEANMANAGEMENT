import { redirect } from 'next/navigation';

export default function MyTasksRedirectPage() {
  redirect('/tasks?tab=pending');
}
