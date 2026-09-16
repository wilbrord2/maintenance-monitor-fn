'use client';

import { ChartColumn, ClipboardList, ClipboardPlus, Factory, Plus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { buildCreateLogUrl, ROUTES } from '@/constants/routes';
import { usePermissions } from '@/lib/permissions/use-permissions';

/** Role-specific shortcuts to the most common tasks. */
export function QuickActions() {
  const { isAdmin } = usePermissions();

  if (isAdmin) {
    return (
      <>
        <Link href={`${ROUTES.technicians}?create=1`} className={buttonVariants({ variant: 'secondary' })}>
          <UserPlus className="size-4" aria-hidden />
          Add technician
        </Link>
        <Link href={`${ROUTES.machines}?create=1`} className={buttonVariants({ variant: 'secondary' })}>
          <Plus className="size-4" aria-hidden />
          Add machine
        </Link>
        <Link href={ROUTES.logs} className={buttonVariants({ variant: 'secondary' })}>
          <ClipboardList className="size-4" aria-hidden />
          View logs
        </Link>
        <Link href={ROUTES.analytics} className={buttonVariants({ variant: 'primary' })}>
          <ChartColumn className="size-4" aria-hidden />
          View analytics
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href={ROUTES.machines} className={buttonVariants({ variant: 'secondary' })}>
        <Factory className="size-4" aria-hidden />
        View machines
      </Link>
      <Link href={ROUTES.logs} className={buttonVariants({ variant: 'secondary' })}>
        <ClipboardList className="size-4" aria-hidden />
        View logs
      </Link>
      <Link href={buildCreateLogUrl()} className={buttonVariants({ variant: 'primary' })}>
        <ClipboardPlus className="size-4" aria-hidden />
        Record maintenance
      </Link>
    </>
  );
}
