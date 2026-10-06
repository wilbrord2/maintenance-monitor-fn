'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorState } from '@/components/feedback/error-state';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { PageHeader } from '@/components/layout/page-header';
import { LogStatusBadge } from '@/components/status/log-status-badge';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { OperationalStatusBadge } from '@/components/status/operational-status-badge';
import { OperationalImpactBadge } from '@/components/status/part-status-badge';
import { StateTransition } from '@/components/status/state-transition';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { ErrorCode } from '@/constants/error-codes';
import { isLogStatus } from '@/constants/log-status';
import { isOperationalImpact } from '@/constants/machine-part';
import { isMachineState, MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { MAX_PAGE_SIZE } from '@/constants/pagination';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { useMachineParts } from '@/features/machine-parts/api/queries';
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
import { MachineState, type StateTransitionRules } from '@/types/machine';
import { LogStatus, type MachineLog } from '@/types/machine-log';
import { OperationalImpact } from '@/types/machine-part';
import { useCreateMachineLog } from '../api/mutations';
import {
  FaultSection,
  mustStayOpen,
  OperationalImpactField,
  resultingStateOptions,
  StateSection,
  TimingSection,
  WorkSection,
} from './machine-log-form-sections';
import { MachinePicker } from './machine-picker';
import { PartPicker, WHOLE_MACHINE_LABEL } from './part-picker';

const stateLabel = (state: MachineState) => MACHINE_STATE_CONFIG[state].label;

/** The success message: what happened to the subject and, when it moved, to the machine. */
function describeCreatedLog(log: MachineLog): string {
  const subject = log.machinePart ? `${log.machinePart.name} on ${log.machine.name}` : log.machine.name;
  const state = stateLabel(log.resultingState).toLowerCase();
  const subjectText = log.entryStatus === log.resultingState ? `${subject} remains ${state}.` : `${subject} is now ${state}.`;
  if (log.machineStatusBefore === log.machineStatusAfter) return subjectText;
  return `${subjectText} Machine status: ${stateLabel(log.machineStatusBefore)} → ${stateLabel(log.machineStatusAfter)}.`;
}

interface CreateFormProps {
  rules: StateTransitionRules;
  initialMachineId?: number;
  initialPartId?: number;
}

function CreateMachineLogForm({ rules, initialMachineId, initialPartId }: CreateFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const create = useCreateMachineLog();
  const [schema] = useState(() => createMachineLogFormSchema({ mode: 'create', rules, isLatestLog: true }));
  const [defaultValues] = useState(() =>
    createLogFormDefaults({ machineId: initialMachineId, machinePartId: initialPartId, now: new Date() }),
  );

  const form = useForm<MachineLogFormInput, unknown, MachineLogFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
  });
  const { setValue, getValues } = form;
  const [machineIdValue, partIdValue, resultingValue, logStatusValue, impactValue] = useWatch({
    control: form.control,
    name: ['machineId', 'machinePartId', 'resultingState', 'logStatus', 'operationalImpact'],
  });

  const machineId = parseIdParam(machineIdValue) ?? 0;
  const machineQuery = useMachine(machineId);
  const machine = machineQuery.data;
  // Only active parts can receive logs; the API refuses the others with MACHINE_PART_INACTIVE.
  const partsQuery = useMachineParts(machineId, { page: 1, limit: MAX_PAGE_SIZE, isActive: true, sortBy: 'partCode', sortOrder: 'asc' });
  const partsLoaded = partsQuery.isSuccess && !partsQuery.isPlaceholderData;
  const parts = partsLoaded ? partsQuery.data.items.filter((part) => part.isActive) : [];
  const selectedPart = parts.find((part) => String(part.id) === partIdValue) ?? null;

  // The current state is the subject's own: the part's status, or the machine's system status.
  // Never the machine's `status`, which is derived from both.
  const current: MachineState | null = selectedPart ? selectedPart.status : partIdValue ? null : (machine?.systemStatus ?? null);
  const subjectKey = selectedPart ? `part:${selectedPart.id}` : machine && !partIdValue ? `machine:${machine.id}` : null;
  const subjectNoun = partIdValue ? 'part' : 'machine';

  const resulting = isMachineState(resultingValue) ? resultingValue : null;
  const closed = logStatusValue === LogStatus.CLOSED;
  const keepOpen = mustStayOpen(rules, resulting, true);
  const returnsToActive = resulting === MachineState.ACTIVE;

  // Detect the subject's state changing (for example through a live update) while the form is open.
  const [observed, setObserved] = useState<{ key: string; state: MachineState } | null>(null);
  const [changedFrom, setChangedFrom] = useState<MachineState | null>(null);
  if (subjectKey && current && (!observed || observed.key !== subjectKey || observed.state !== current)) {
    setChangedFrom(observed && observed.key === subjectKey ? observed.state : null);
    setObserved({ key: subjectKey, state: current });
  }

  // A part that is not among the machine's active parts (another machine, or taken out of use) is dropped.
  const partMissing = partsLoaded && partIdValue !== '' && selectedPart === null;
  useEffect(() => {
    if (partMissing) setValue('machinePartId', '', { shouldValidate: true });
  }, [partMissing, setValue]);

  // The entry state always mirrors the subject's current state; drop a new state it no longer allows.
  useEffect(() => {
    if (!current) {
      setValue('entryStatus', '');
      return;
    }
    setValue('entryStatus', current, { shouldValidate: getValues('entryStatus') !== '' });
    const chosen = getValues('resultingState');
    if (isMachineState(chosen) && !getAllowedResultingStates(rules, current).includes(chosen)) {
      setValue('resultingState', '', { shouldValidate: true });
    }
  }, [current, rules, setValue, getValues]);

  // The impact defaults from the part's criticality and is never kept for a whole-machine event.
  const selectedPartId = selectedPart?.id;
  const selectedPartCritical = selectedPart?.isCritical;
  useEffect(() => {
    if (selectedPartId === undefined) setValue('operationalImpact', '');
    else setValue('operationalImpact', selectedPartCritical ? OperationalImpact.BLOCKING : OperationalImpact.NON_BLOCKING);
  }, [selectedPartId, selectedPartCritical, setValue]);
  useEffect(() => {
    if (returnsToActive && getValues('machinePartId')) setValue('operationalImpact', OperationalImpact.NON_BLOCKING, { shouldValidate: true });
  }, [returnsToActive, setValue, getValues]);

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

  const reloadSubject = () => {
    void machineQuery.refetch();
    void partsQuery.refetch();
  };

  const conflictError =
    isApiError(create.error) && create.error.hasCode(ErrorCode.MACHINE_STATE_CONFLICT, ErrorCode.MACHINE_PART_STATE_CONFLICT)
      ? create.error
      : null;

  const onSubmit = (values: MachineLogFormValues) => {
    create.mutate(toCreateMachineLogRequest(values), {
      onSuccess: ({ data }) => {
        notify.success('Activity recorded', describeCreatedLog(data));
        router.push(ROUTES.log(data.id));
      },
      onError: (error) => {
        if (!isApiError(error)) return;
        // The machine or part changed since it was loaded: reload it so the form shows the current state.
        if (error.hasCode(ErrorCode.MACHINE_STATE_CONFLICT, ErrorCode.MACHINE_PART_STATE_CONFLICT)) {
          reloadSubject();
          return;
        }
        // Deactivated meanwhile: reload so it drops out of the pickers.
        if (error.hasCode(ErrorCode.MACHINE_INACTIVE)) {
          void machineQuery.refetch();
          void queryClient.invalidateQueries({ queryKey: queryKeys.machines.lists() });
          return;
        }
        if (error.hasCode(ErrorCode.MACHINE_PART_INACTIVE)) {
          void partsQuery.refetch();
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
          <CardHeader title="Machine and part" description="Only active machines and parts can receive new logs" />
          <CardContent className="flex flex-col gap-4">
            <MachinePicker control={form.control} selectedMachine={machine} />
            {machine ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-line bg-sunken px-3 py-2.5" aria-live="polite">
                <span className="text-xs font-semibold text-ink-secondary">Machine status</span>
                <MachineStateBadge state={machine.status} size="sm" />
                <OperationalStatusBadge status={machine.operationalStatus} size="sm" />
                <span className="text-xs text-muted">updated {formatRelativeTime(machine.updatedAt)}</span>
                {machineQuery.isFetching ? <span className="text-xs text-muted">· refreshing…</span> : null}
              </div>
            ) : machineQuery.isFetching ? (
              <Skeleton className="h-11 w-full" />
            ) : null}
            {machine && !machine.isActive ? (
              <Alert tone="critical">This machine is deactivated and can&apos;t receive new logs. Choose another machine.</Alert>
            ) : null}
            {machine && machine.isActive ? (
              partsQuery.isPending || partsQuery.isPlaceholderData ? (
                <Skeleton className="h-16 w-full" />
              ) : parts.length > 0 ? (
                <PartPicker control={form.control} parts={parts} />
              ) : null
            ) : null}
            {changedFrom && current ? (
              <Alert tone="warning" title={`${subjectNoun === 'part' ? 'Part' : 'Machine'} state changed while you were editing`}>
                {selectedPart?.name ?? machine?.name} changed from {stateLabel(changedFrom)} to {stateLabel(current)}. The current
                state was updated — review the new state before saving.
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <FaultSection control={form.control} />

        <StateSection
          control={form.control}
          entry={current}
          entryLabel="Current state"
          entryHint={
            selectedPart
              ? `The current status of ${selectedPart.name}.`
              : "The machine's own system state, without its parts."
          }
          description={
            selectedPart
              ? "The new state becomes the part's status. The server then works out the machine's status."
              : "The new state becomes the machine's system state. The server then works out the machine's status."
          }
          resultingOptions={resultingStateOptions(rules, current)}
          resultingDisabled={!current}
          resultingHint={current ? `Only states that can follow ${stateLabel(current)} are listed.` : undefined}
          closedDisabled={keepOpen}
          logStatusHint={
            keepOpen && resulting
              ? `The log stays open while the ${subjectNoun} is ${stateLabel(resulting).toLowerCase()}.`
              : 'Close the log when the work is complete.'
          }
        >
          {selectedPart ? (
            <OperationalImpactField control={form.control} returnsToActive={returnsToActive} isCritical={selectedPart.isCritical} />
          ) : null}
        </StateSection>

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
            {machine ? (
              <div>
                <p className="text-xs text-muted">Logged against</p>
                <p className="mt-0.5 font-semibold text-ink">
                  {selectedPart ? `${selectedPart.partCode} – ${selectedPart.name}` : WHOLE_MACHINE_LABEL}
                </p>
              </div>
            ) : null}
            <div>
              <p className="text-xs text-muted">State change</p>
              <div className="mt-1">
                {current && resulting ? (
                  <StateTransition from={current} to={resulting} />
                ) : (
                  <span className="text-muted">Choose a machine and new state</span>
                )}
              </div>
            </div>
            {selectedPart && (returnsToActive || isOperationalImpact(impactValue)) ? (
              <div>
                <p className="text-xs text-muted">Operational impact</p>
                <div className="mt-1">
                  <OperationalImpactBadge
                    impact={returnsToActive || !isOperationalImpact(impactValue) ? OperationalImpact.NON_BLOCKING : impactValue}
                    size="sm"
                  />
                </div>
              </div>
            ) : null}
            {isLogStatus(logStatusValue) ? (
              <div>
                <p className="text-xs text-muted">Log</p>
                <div className="mt-1">
                  <LogStatusBadge status={logStatusValue} size="sm" />
                </div>
              </div>
            ) : null}

            {conflictError ? (
              <Alert
                tone="warning"
                title={conflictError.hasCode(ErrorCode.MACHINE_PART_STATE_CONFLICT) ? 'Part updated by another user' : 'Machine updated by another user'}
                action={
                  <Button variant="secondary" size="sm" icon={RefreshCw} loading={machineQuery.isFetching || partsQuery.isFetching} onClick={() => {
                    create.reset();
                    reloadSubject();
                  }}>
                    Reload
                  </Button>
                }
              >
                {getErrorMessage(conflictError)}
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
  const searchParams = useSearchParams();
  const initialMachineId = parseIdParam(searchParams.get('machineId'));
  const initialPartId = parseIdParam(searchParams.get('partId'));
  const rules = useStateTransitionRules();

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Machine Logs', href: ROUTES.logs }, { label: 'Record activity' }]}
        title="Record maintenance activity"
        description="Log a fault, repair, test or inspection for a whole machine or one of its parts. The server updates the machine's status from it."
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
        <CreateMachineLogForm rules={rules.data} initialMachineId={initialMachineId} initialPartId={initialPartId} />
      )}
    </>
  );
}
