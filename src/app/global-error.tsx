'use client';

import { useEffect } from 'react';
import './globals.css';

/** Last-resort boundary for errors in the root layout; replaces the whole document. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main role="alert" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          <h1 className="text-lg font-semibold text-ink">Something went wrong.</h1>
          <p className="mt-1 max-w-sm text-[13px] text-muted">Try refreshing the page.</p>
          <button
            type="button"
            onClick={retry}
            className="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-ink hover:bg-primary-hover"
          >
            Try again
          </button>
          {error.digest ? <p className="mt-4 font-mono text-[11px] text-muted">Reference: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
