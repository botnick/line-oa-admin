import { redirect } from 'next/navigation';

/**
 * Root page — redirects to /inbox (or /setup on first run).
 * Setup check will be handled by middleware in production.
 */
export default function HomePage() {
  redirect('/inbox');
}
