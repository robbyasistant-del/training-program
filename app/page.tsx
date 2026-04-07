import { redirect } from 'next/navigation';

/**
 * Home Page - Redirects to login
 */
export default function HomePage() {
  redirect('/login');
}
