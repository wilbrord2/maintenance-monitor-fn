import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/error-messages';

/** The only place the app talks to the toast library: concise, consistent notifications. */
export const notify = {
  success(title: string, description?: string) {
    toast.success(title, { description });
  },
  info(title: string, description?: string) {
    toast.info(title, { description });
  },
  error(error: unknown, title = "Couldn't complete the action", overrides?: Readonly<Record<string, string>>) {
    toast.error(title, { description: getErrorMessage(error, overrides) });
  },
};
