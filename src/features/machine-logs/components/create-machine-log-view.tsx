'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorState } from '@/components/feedback/error-state';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { PageHeader } from '@/components/layout/page-header';
import { LogStatusBadge } from '@/components/status/log-status-badge';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { StateTransition } from '@/components/status/state-transition';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { ErrorCode } from '@/constants/error-codes';
import { isLogStatus } from '@/constants/log-status';
import { isMachineState, MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { ROUTES } from '@/constants/routes';
import { useMachine, useStateTransitionRules } from '@/features/machines/api/queries';
import { getErrorMessage } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
import { getAllowedResultingStates } from '@/lib/machine-state/transitions';
import { notify } from '@/lib/notify';
import { formatRelativeTime } from '@/lib/utils/date';
import { parseIdParam } from '@/lib/utils/url-params';
import {
  createLogFormDefaults,
  createMachineLogFormSchema,
  MACHINE_LOG_FORM_FIELDS,
  type MachineLogFormInput,
  type MachineLogFormValues,
  toCreateMachineLogRequest,
} from '@/lib/validation/machine-log';
import { type MachineState, type StateTransitionRules } from '@/types/machine';
import { LogStatus } from '@/types/machine-log';
import { useCreateMachineLog } from '../api/mutations';
import {
  FaultSection,
  mustStayOpen,
  resultingStateOptions,
  StateSection,
  TimingSection,
  WorkSection,
} from './machine-log-form-sections';
import { MachinePicker } from './machine-picker';

function CreateMachineLogForm({ rules, initialMachineId }: { rules: StateTransitionRules; initialMachineId?: number }) {
  const router = useRouter();
  const create = useCreateMachineLog();
  const [schema] = useState(() => createMachineLogFormSchema({ mode: 'create', rules, isLatestLog: true }));
  const [defaultValues] = useState(() => createLogFormDefaults({ machineId: initialMachineId, now: new Date() }));

  const form = useForm<MachineLogFormInput, unknown, MachineLogFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
  });
  const { setValue, getValues } = form;
  const [machineIdValue, resultingValue, logStatusValue] = useWatch({
    control: form.control,
    name: ['machineId', 'resultingState', 'logStatus'],
  });

  const machineQuery = useMachine(parseIdParam(machineIdValue) ?? 0);
  const machine = machineQuery.data;
  const resulting = isMachineState(resultingValue) ? resultingValue : null;
  const closed = logStatusValue === LogStatus.CLOSED;
  const keepOpen = mustStayOpen(rules, resulting, true);

  // Detect the machine's state changing (for example through a live update) while the form is open.
  const [observed, setObserved] = useState<{ id: number; status: MachineState } | null>(null);
  const [changedFrom, setChangedFrom] = useState<MachineState | null>(null);
  if (machine && (!observed || observed.id !== machine.id || observed.status !== machine.status)) {
    setChangedFrom(observed && observed.id === machine.id ? observed.status : null);
    setObserved({ id: machine.id, status: machine.status });
  }

  // The entry state always mirrors the machine's current state; drop a resulting state it no longer allows.
  useEffect(() => {
    if (!machine) {
      setValue('entryStatus', '');
      return;
    }
    setValue('entryStatus', machine.status, { shouldValidate: getValues('entryStatus') !== '' });
    const current = getValues('resultingState');
    if (isMachineState(current) && !getAllowedResultingStates(rules, machine.status).includes(current)) {
      setValue('resultingState', '', { shouldValidate: true });
    }
  }, [machine, rules, setValue, getValues]);

  // Closing a log needs an end time; open work has none. Some states require the log to stay open.
  useEffect(() => {
    if (keepOpen && logStatusValue === LogStatus.CLOSED) setValue('logStatus', LogStatus.OPEN, { shouldValidate: true });
  }, [keepOpen, logStatusValue, setValue]);
  useEffect(() => {
    if (logStatusValue === LogStatus.CLOSED && !getValues('endedAt')) {
      setValue('endedAt', createLogFormDefaults({ now: new Date() }).startedAt);
    } else if (logStatusValue === LogStatus.OPEN && getValues('endedAt')) {
      setValue('endedAt', '');
    }
  }, [logStatusValue, setValue, getValues]);

  const conflict = isApiError(create.error) && create.error.hasCode(ErrorCode.MACHINE_STATE_CONFLICT);

  const onSubmit = (values: MachineLogFormValues) => {
    create.mutate(toCreateMachineLogRequest(values), {
      onSuccess: ({ data }) => {
        const stateLabel = MACHINE_STATE_CONFIG[data.resultingState].label.toLowerCase();
        notify.success(
          'Activity recorded',
          data.entryStatus === data.resultingState ? `${data.machine.name} remains ${stateLabel}.` : `${data.machine.name} is now ${stateLabel}.`,
        );
        router.push(ROUTES.log(data.id));
      },
      onError: (error) => {
        if (isApiError(error) && error.hasCode(ErrorCode.MACHINE_STATE_CONFLICT, ErrorCode.MACHINE_INACTIVE)) {
          void machineQuery.refetch();
          return;
        }
        applyServerFieldErrors(error, form.setError, MACHINE_LOG_FORM_FIELDS);
      },
    });
  };

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader title="Machine" description="Only active machines can receive new logs" />
          <CardContent className="flex flex-col gap-4">
            <MachinePicker control={form.control} selectedMachine={machine} />
            {machine ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-line bg-sunken px-3 py-2.5" aria-live="polite">
                <span className="text-xs font-semibold text-ink-secondary">Current machine state</span>
                <MachineStateBadge state={machine.status} />
                <span className="text-xs text-muted">updated {formatRelativeTime(machine.updatedAt)}</span>
                {machineQuery.isFetching ? <span className="text-xs text-muted">· refreshing…</span> : null}
              </div>
            ) : machineQuery.isFetching ? (
              <Skeleton className="h-11 w-full" />
            ) : null}
            {machine && !machine.isActive ? (
              <Alert tone="critical">This machine is deactivated and can&apos;t receive new logs. Choose another machine.</Alert>
            ) : null}
            {changedFrom && machine ? (
              <Alert tone="warning" title="Machine state changed while you were editing">
                {machine.name} changed from {MACHINE_STATE_CONFIG[changedFrom].label} to {MACHINE_STATE_CONFIG[machine.status].label}. The
                entry state was updated — review the resulting state before saving.
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <FaultSection control={form.control} />

        <StateSection
          control={form.control}
          entry={machine?.status ?? null}
          entryLabel="Entry state"
          entryHint="Set automatically from the machine's current state."
          resultingOptions={resultingStateOptions(rules, machine?.status ?? null)}
          resultingDisabled={!machine}
          resultingHint={machine ? `Only states that can follow ${MACHINE_STATE_CONFIG[machine.status].label} are listed.` : undefined}
          closedDisabled={keepOpen}
          logStatusHint={
            keepOpen && resulting
              ? `The log stays open while the machine is ${MACHINE_STATE_CONFIG[resulting].label.toLowerCase()}.`
              : 'Close the log when the work is complete.'
          }
        />

        <WorkSection control={form.control} />

        <TimingSection
          control={form.control}
          closed={closed}
          downtimeHint={closed ? 'Leave blank to calculate from the start and end times. Enter 0 if the machine never stopped.' : 'Leave blank while work is ongoing, or enter 0 if the machine kept running.'}
        />
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
        <Card>
          <CardHeader title="Summary" />
          <CardContent className="flex flex-col gap-3 text-[13px]">
            <div>
              <p className="text-xs text-muted">Machine</p>
              <p className="mt-0.5 font-semibold text-ink">{machine ? machine.name : 'Not selected'}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Status change</p>
              <div className="mt-1">
                {machine && resulting ? (
                  <StateTransition from={machine.status} to={resulting} />
                ) : (
                  <span className="text-muted">Choose a machine and resulting state</span>
                )}
              </div>
            </div>
            {isLogStatus(logStatusValue) ? (
              <div>
                <p className="text-xs text-muted">Log</p>
                <div className="mt-1">
                  <LogStatusBadge status={logStatusValue} size="sm" />
                </div>
              </div>
            ) : null}

            {conflict ? (
              <Alert
                tone="warning"
                title="Machine updated by another user"
                action={
                  <Button variant="secondary" size="sm" icon={RefreshCw} loading={machineQuery.isFetching} onClick={() => {
                    create.reset();
                    void machineQuery.refetch();
                  }}>
                    Reload
                  </Button>
                }
              >
                {getErrorMessage(create.error)}
              </Alert>
            ) : create.error ? (
              <Alert tone="critical">{getErrorMessage(create.error)}</Alert>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
              <Button type="submit" size="lg" loading={create.isPending} disabled={Boolean(machine && !machine.isActive)} className="w-full">
                Save log
              </Button>
              <Button variant="secondary" onClick={() => router.back()} disabled={create.isPending} className="w-full">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}

export function CreateMachineLogView() {
  const initialMachineId = parseIdParam(useSearchParams().get('machineId'));
  const rules = useStateTransitionRules();

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Machine Logs', href: ROUTES.logs }, { label: 'Record activity' }]}
        title="Record maintenance activity"
        description="Log a fault, repair, test or inspection. The machine's status is updated from the resulting state."
      />
      {rules.isPending ? (
        <LoadingRegion label="Loading form" className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-56" />
          </div>
          <Skeleton className="h-64" />
        </LoadingRegion>
      ) : rules.isError ? (
        <Card>
          <ErrorState error={rules.error} onRetry={() => void rules.refetch()} isRetrying={rules.isFetching} />
        </Card>
      ) : (
        <CreateMachineLogForm rules={rules.data} initialMachineId={initialMachineId} />
      )}
    </>
  );
}
