'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { DetailList } from '@/components/data/detail-list';
import { ErrorState } from '@/components/feedback/error-state';
import { NotFoundState } from '@/components/feedback/not-found-state';
import { applyServerFieldErrors } from '@/components/forms/server-errors';
import { PageHeader } from '@/components/layout/page-header';
import { LogSubjectBadge } from '@/components/status/log-subject';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { OperationalStatusBadge } from '@/components/status/operational-status-badge';
import { OperationalImpactBadge } from '@/components/status/part-status-badge';
import { StateTransition } from '@/components/status/state-transition';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { ErrorCode } from '@/constants/error-codes';
import { isMachineState, MACHINE_STATE_CONFIG } from '@/constants/machine-state';
import { ROUTES } from '@/constants/routes';
import { useMachinePart, useMachinePartHistory } from '@/features/machine-parts/api/queries';
import { useMachine, useMachineHistoryPage, useStateTransitionRules } from '@/features/machines/api/queries';
import { getErrorMessage } from '@/lib/api/error-messages';
import { isApiError } from '@/lib/api/errors';
import { notify } from '@/lib/notify';
import { formatDateTime } from '@/lib/utils/date';
import {
  createMachineLogFormSchema,
  hasLogChanges,
  logToFormInput,
  MACHINE_LOG_FORM_FIELDS,
  type MachineLogFormInput,
  type MachineLogFormValues,
  toUpdateMachineLogRequest,
} from '@/lib/validation/machine-log';
import { type Machine, MachineState, type StateTransitionRules } from '@/types/machine';
import { LogScope, LogStatus, type MachineLog, type UpdateMachineLogRequest } from '@/types/machine-log';
import { OperationalImpact } from '@/types/machine-part';
import { useUpdateMachineLog } from '../api/mutations';
import { useMachineLog } from '../api/queries';
import {
  FaultSection,
  mustStayOpen,
  OperationalImpactField,
  resultingStateOptions,
  StateSection,
  TimingSection,
  WorkSection,
} from './machine-log-form-sections';

interface EditFormProps {
  /** The latest version from the server; may become newer than the version being edited. */
  log: MachineLog;
  machine: Machine;
  /** The subject's current state: the part's status, or the machine's system status. */
  subjectState: MachineState;
  rules: StateTransitionRules;
  /** Whether this is the most recent log of its subject (the part, or the machine system). */
  isLatestLog: boolean;
  onRefreshLog(): void;
}

function EditMachineLogForm({ log: latestLog, machine, subjectState, rules, isLatestLog, onRefreshLog }: EditFormProps) {
  const router = useRouter();
  const update = useUpdateMachineLog();
  const [baseLog, setBaseLog] = useState(latestLog);
  const [initial, setInitial] = useState<MachineLogFormInput>(() => logToFormInput(latestLog));
  const [schema] = useState(() => createMachineLogFormSchema({ mode: 'edit', rules, isLatestLog }));
  const [pendingRequest, setPendingRequest] = useState<UpdateMachineLogRequest | null>(null);

  const form = useForm<MachineLogFormInput, unknown, MachineLogFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
    mode: 'onTouched',
  });
  const { setValue, getValues } = form;
  const [resultingValue, logStatusValue] = useWatch({ control: form.control, name: ['resultingState', 'logStatus'] });
  const resulting = isMachineState(resultingValue) ? resultingValue : null;
  const closed = logStatusValue === LogStatus.CLOSED;
  const keepOpen = mustStayOpen(rules, resulting, isLatestLog);
  const part = baseLog.scope === LogScope.PART ? baseLog.machinePart : null;
  const subjectNoun = part ? 'part' : 'machine';
  const subjectName = part ? part.name : machine.name;
  const returnsToActive = resulting === MachineState.ACTIVE;

  // The new state is editable only on the subject's most recent log, while the subject still reflects it.
  const canChangeResult = isLatestLog && subjectState === baseLog.resultingState;
  const newerVersionAvailable = latestLog.version > baseLog.version;
  const staleError = isApiError(update.error) && update.error.hasCode(ErrorCode.STALE_VERSION);
  const statusWillChange = resulting !== null && resulting !== baseLog.resultingState;

  useEffect(() => {
    if (keepOpen && logStatusValue === LogStatus.CLOSED) setValue('logStatus', LogStatus.OPEN, { shouldValidate: true, shouldDirty: true });
  }, [keepOpen, logStatusValue, setValue]);
  // A part back in service is always non-blocking.
  useEffect(() => {
    if (returnsToActive && part) setValue('operationalImpact', OperationalImpact.NON_BLOCKING, { shouldValidate: true, shouldDirty: true });
  }, [returnsToActive, part, setValue]);
  useEffect(() => {
    if (logStatusValue === LogStatus.CLOSED && !getValues('endedAt')) {
      setValue('endedAt', logToFormInput({ ...baseLog, endedAt: new Date().toISOString() }).endedAt, { shouldDirty: true });
    } else if (logStatusValue === LogStatus.OPEN && getValues('endedAt')) {
      setValue('endedAt', '', { shouldDirty: true });
    }
  }, [logStatusValue, baseLog, setValue, getValues]);

  const loadLatestVersion = () => {
    const next = logToFormInput(latestLog);
    setBaseLog(latestLog);
    setInitial(next);
    form.reset(next);
    update.reset();
  };

  const save = (body: UpdateMachineLogRequest) => {
    update.mutate(
      { id: baseLog.id, body },
      {
        onSuccess: ({ data }) => {
          setPendingRequest(null);
          notify.success(
            'Log updated',
            body.resultingState
              ? `${data.machinePart?.name ?? data.machine.name} is now ${MACHINE_STATE_CONFIG[data.resultingState].label.toLowerCase()}.`
              : undefined,
          );
          router.push(ROUTES.log(data.id));
        },
        onError: (error) => {
          setPendingRequest(null);
          // Someone else changed the log or its subject: reload so the form reflects it. The error stays visible.
          if (
            isApiError(error) &&
            error.hasCode(
              ErrorCode.STALE_VERSION,
              ErrorCode.RESULTING_STATE_IMMUTABLE,
              ErrorCode.MACHINE_STATE_CONFLICT,
              ErrorCode.MACHINE_PART_STATE_CONFLICT,
            )
          ) {
            onRefreshLog();
            return;
          }
          applyServerFieldErrors(error, form.setError, MACHINE_LOG_FORM_FIELDS);
        },
      },
    );
  };

  const onSubmit = (values: MachineLogFormValues) => {
    const request = toUpdateMachineLogRequest(values, initial, baseLog.version);
    if (!hasLogChanges(request)) {
      notify.info('No changes to save');
      return;
    }
    // Changing the new state changes the subject (and possibly the machine's status) for everyone: confirm first.
    if (request.resultingState) setPendingRequest(request);
    else save(request);
  };

  return (
    <>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {newerVersionAvailable ? (
            <Alert
              tone="warning"
              title="This log was updated by someone else"
              action={
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={loadLatestVersion}>
                  Load latest version
                </Button>
              }
            >
              A newer version was saved {formatDateTime(latestLog.updatedAt)}. Load it before saving — your unsaved changes will be discarded.
            </Alert>
          ) : staleError ? (
            <Alert tone="warning" title="Checking for the latest version…">
              {getErrorMessage(update.error)}
            </Alert>
          ) : null}

          <Card>
            <CardHeader title="Log record" description="Recorded details that can't be edited" />
            <CardContent>
              <DetailList
                items={[
                  {
                    label: 'Machine',
                    value: (
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={ROUTES.machine(machine.id)} className="font-semibold hover:underline">
                          {machine.name}
                        </Link>
                        <span className="text-xs text-muted">now</span>
                        <MachineStateBadge state={machine.status} size="sm" />
                        <OperationalStatusBadge status={machine.operationalStatus} size="sm" />
                      </span>
                    ),
                  },
                  {
                    label: 'Logged against',
                    value: part ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <Link href={ROUTES.machinePart(machine.id, part.id)} className="hover:underline">
                          <LogSubjectBadge log={baseLog} />
                        </Link>
                        <span className="text-xs text-muted">now</span>
                        <MachineStateBadge state={subjectState} size="sm" />
                      </span>
                    ) : (
                      <LogSubjectBadge log={baseLog} />
                    ),
                  },
                  { label: 'Technician', value: `${baseLog.technician.fullName}${baseLog.technician.position ? ` · ${baseLog.technician.position}` : ''}` },
                  { label: 'Recorded', value: formatDateTime(baseLog.createdAt) },
                  { label: 'Last updated', value: formatDateTime(baseLog.updatedAt) },
                  { label: 'State before', value: <MachineStateBadge state={baseLog.entryStatus} size="sm" /> },
                  { label: 'Recorded new state', value: <MachineStateBadge state={baseLog.resultingState} size="sm" /> },
                  ...(part && baseLog.operationalImpact
                    ? [{ label: 'Recorded impact', value: <OperationalImpactBadge impact={baseLog.operationalImpact} size="sm" /> }]
                    : []),
                ]}
              />
            </CardContent>
          </Card>

          <FaultSection control={form.control} />

          <StateSection
            control={form.control}
            entry={baseLog.entryStatus}
            entryLabel="State before"
            entryHint="Recorded when the log was created and can't be changed."
            description={
              part
                ? "The new state is the part's status after this event. The server then works out the machine's status."
                : "The new state is the machine's system state after this event. The server then works out the machine's status."
            }
            resultingOptions={
              canChangeResult
                ? resultingStateOptions(rules, baseLog.entryStatus)
                : [{ value: baseLog.resultingState, label: MACHINE_STATE_CONFIG[baseLog.resultingState].label }]
            }
            resultingDisabled={!canChangeResult}
            resultingHint={
              canChangeResult
                ? `Only states that can follow ${MACHINE_STATE_CONFIG[baseLog.entryStatus].label} are listed.`
                : isLatestLog
                  ? `The ${subjectNoun}'s state has changed since this log, so its new state can't be edited.`
                  : `Only the most recent log of this ${subjectNoun} can change its new state.`
            }
            closedDisabled={keepOpen}
            logStatusHint={
              keepOpen && resulting
                ? `The log stays open while the ${subjectNoun} is ${MACHINE_STATE_CONFIG[resulting].label.toLowerCase()}.`
                : undefined
            }
          >
            {part ? <OperationalImpactField control={form.control} returnsToActive={returnsToActive} isCritical={part.isCritical} /> : null}
            {statusWillChange && resulting ? (
              <Alert tone="warning" title={`Saving will change the ${subjectNoun}'s state`}>
                <span className="flex flex-wrap items-center gap-2">
                  {subjectName}: <StateTransition from={baseLog.resultingState} to={resulting} />
                </span>
                <span className="mt-1 block text-xs">The server then works out the machine&apos;s status again.</span>
              </Alert>
            ) : null}
          </StateSection>

          <WorkSection control={form.control} />

          <TimingSection
            control={form.control}
            closed={closed}
            downtimeHint="Leave unchanged to keep the recorded value; it's recalculated automatically when the timing changes."
          />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <Card>
            <CardHeader title="Save changes" />
            <CardContent className="flex flex-col gap-3">
              {update.error && !staleError ? <Alert tone="critical">{getErrorMessage(update.error)}</Alert> : null}
              <p className="text-xs text-muted">Only the fields you change are saved. Changes are recorded in the audit trail.</p>
              <Button type="submit" size="lg" loading={update.isPending && pendingRequest === null} disabled={newerVersionAvailable} className="w-full">
                Save changes
              </Button>
              <Button variant="secondary" onClick={() => router.push(ROUTES.log(baseLog.id))} disabled={update.isPending} className="w-full">
                Cancel
              </Button>
            </CardContent>
          </Card>
        </aside>
      </form>

      <ConfirmDialog
        open={pendingRequest !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRequest(null);
        }}
        title={`Change the ${subjectNoun}'s state?`}
        description={`Saving this log changes the state of ${subjectName} for everyone monitoring the fleet, and may change the status of ${machine.name}.`}
        confirmLabel="Save and change state"
        loading={update.isPending}
        onConfirm={() => {
          if (pendingRequest) save(pendingRequest);
        }}
      >
        {pendingRequest?.resultingState ? (
          <StateTransition from={baseLog.resultingState} to={pendingRequest.resultingState} size="md" />
        ) : null}
      </ConfirmDialog>
    </>
  );
}

/** Logs are compared by id: ids are strictly ordered, so the highest is the subject's latest. */
const RECENT_LOGS = { page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' } as const;

export function EditMachineLogView({ logId }: { logId: number }) {
  const logQuery = useMachineLog(logId);
  const rules = useStateTransitionRules();
  const machineId = logQuery.data?.machine.id ?? 0;
  const partId = logQuery.data?.machinePart?.id ?? 0;
  const isPartLog = logQuery.data?.scope === LogScope.PART;
  const machineQuery = useMachine(machineId);
  const partQuery = useMachinePart(machineId, partId, { enabled: isPartLog });
  // "Latest" is per subject: the part's own history, or the machine's whole-machine events.
  const recentPartLogs = useMachinePartHistory(isPartLog ? partId : 0, RECENT_LOGS);
  const recentMachineLogs = useMachineHistoryPage(logQuery.data && !isPartLog ? machineId : 0, { ...RECENT_LOGS, scope: LogScope.MACHINE });
  const recentLogs = isPartLog ? recentPartLogs : recentMachineLogs;
  const subjectQuery = isPartLog ? partQuery : machineQuery;

  const header = (
    <PageHeader
      breadcrumbs={[{ label: 'Machine Logs', href: ROUTES.logs }, { label: `Log #${logId}`, href: ROUTES.log(logId) }, { label: 'Edit' }]}
      title="Edit maintenance log"
      description={
        logQuery.data
          ? `${logQuery.data.machine.name}${logQuery.data.machinePart ? ` · ${logQuery.data.machinePart.name}` : ''} · ${logQuery.data.faultDescription}`
          : undefined
      }
    />
  );

  if (logQuery.isError && isApiError(logQuery.error) && logQuery.error.status === 404) {
    return (
      <>
        {header}
        <Card>
          <NotFoundState title="Log not found" description="This log doesn't exist or has been deleted." backHref={ROUTES.logs} backLabel="Back to logs" />
        </Card>
      </>
    );
  }

  const error = logQuery.error ?? rules.error ?? machineQuery.error ?? subjectQuery.error ?? recentLogs.error;
  if (error) {
    return (
      <>
        {header}
        <Card>
          <ErrorState
            error={error}
            onRetry={() => {
              void logQuery.refetch();
              void rules.refetch();
              void machineQuery.refetch();
              void subjectQuery.refetch();
              void recentLogs.refetch();
            }}
          />
        </Card>
      </>
    );
  }

  const subjectState = isPartLog ? partQuery.data?.status : machineQuery.data?.systemStatus;
  if (!logQuery.data || !rules.data || !machineQuery.data || !subjectState || !recentLogs.data) {
    return (
      <>
        {header}
        <LoadingRegion label="Loading log" className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Skeleton className="h-36" />
            <Skeleton className="h-56" />
          </div>
          <Skeleton className="h-40" />
        </LoadingRegion>
      </>
    );
  }

  const log = logQuery.data;
  const latestId = Math.max(...recentLogs.data.items.map((item) => item.id));
  return (
    <>
      {header}
      <EditMachineLogForm
        key={log.id}
        log={log}
        machine={machineQuery.data}
        subjectState={subjectState}
        rules={rules.data}
        isLatestLog={latestId === log.id}
        onRefreshLog={() => {
          void logQuery.refetch();
          void machineQuery.refetch();
          void subjectQuery.refetch();
          void recentLogs.refetch();
        }}
      />
    </>
  );
}
