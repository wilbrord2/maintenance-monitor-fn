import { notFound } from 'next/navigation';

/** Unknown dashboard paths render the in-app not-found page inside the shell. */
export default function UnknownDashboardPage() {
  notFound();
}
