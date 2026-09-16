import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url({ message: 'must be an absolute URL, e.g. http://localhost:3000/api/v1' }),
  NEXT_PUBLIC_WS_URL: z.url({ message: 'must be an absolute URL, e.g. http://localhost:3000' }),
});

// Next.js only inlines NEXT_PUBLIC_* variables that are referenced literally.
const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
});

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration. Copy .env.example to .env.local and set:\n${z.prettifyError(parsed.error)}`,
  );
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/** Public, non-secret runtime configuration. */
export const env = {
  apiUrl: trimTrailingSlash(parsed.data.NEXT_PUBLIC_API_URL),
  wsUrl: trimTrailingSlash(parsed.data.NEXT_PUBLIC_WS_URL),
} as const;
