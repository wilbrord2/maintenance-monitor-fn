import { Spinner } from '@/components/ui/spinner';

export default function AuthLoading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner className="size-5" />
    </div>
  );
}
