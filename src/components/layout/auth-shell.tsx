import { type ReactNode } from 'react';
import { MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { MACHINE_STATES } from '@/types/machine';
import { BrandMark } from './brand-mark';

/** Layout for signed-out and onboarding screens: product context on large screens, the form everywhere. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden flex-col justify-between bg-sidebar px-10 py-10 text-sidebar-ink lg:flex xl:px-14">
        <BrandMark inverted />
        <div className="max-w-md">
          <p className="font-mono text-[11px] tracking-[0.18em] text-sidebar-muted uppercase">Fleet maintenance</p>
          <p className="mt-3 text-[28px] leading-tight font-semibold text-white">
            Know the state of every machine the moment it changes.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            Live status, maintenance history and downtime analytics for the people who keep the line running.
          </p>
        </div>
        <ul aria-label="Machine states" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-sidebar-line bg-sidebar-line">
          {MACHINE_STATES.map((state) => {
            const config = MACHINE_STATE_CONFIG[state];
            const Icon = config.icon;
            return (
              <li key={state} className="flex items-start gap-2.5 bg-sidebar px-3.5 py-3">
                <Icon className="mt-0.5 size-4 shrink-0" style={{ color: config.chartColor }} aria-hidden />
                <div>
                  <p className="text-[13px] font-semibold text-white">{config.label}</p>
                  <p className="text-xs text-sidebar-muted">{config.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="flex min-w-0 flex-col px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <BrandMark />
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-xs text-muted">Maintenance Monitor · Authorised personnel only</p>
      </main>
    </div>
  );
}

export function AuthHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
      {description ? <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{description}</p> : null}
    </div>
  );
}
