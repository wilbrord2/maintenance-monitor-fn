'use client';

import { useState } from 'react';
import { FormSelect } from '@/components/forms/form-select';
import { SearchInput } from '@/components/ui/search-input';
import { MAX_PAGE_SIZE } from '@/constants/pagination';
import { useMachines } from '@/features/machines/api/queries';
import { type Machine } from '@/types/machine';
import { type LogFormControl } from './machine-log-form-sections';

/**
 * Machine choice for a new log. Lists active machines (the API refuses logs for deactivated ones)
 * and adds a server-side search when the fleet exceeds one page.
 */
export function MachinePicker({ control, selectedMachine }: { control: LogFormControl; selectedMachine: Machine | undefined }) {
  const [search, setSearch] = useState('');
  const machines = useMachines({ page: 1, limit: MAX_PAGE_SIZE, isActive: true, sortBy: 'name', sortOrder: 'asc', search: search || undefined });
  const needsSearch = (machines.data?.meta.totalItems ?? 0) > MAX_PAGE_SIZE || search !== '';

  const options = (machines.data?.items ?? []).map((machine) => ({
    value: String(machine.id),
    label: `${machine.name} · ${machine.serialNumber}`,
  }));
  if (selectedMachine && !options.some((option) => option.value === String(selectedMachine.id))) {
    options.unshift({
      value: String(selectedMachine.id),
      label: `${selectedMachine.name} · ${selectedMachine.serialNumber}${selectedMachine.isActive ? '' : ' (deactivated)'}`,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {needsSearch ? (
        <SearchInput
          label="Find a machine"
          placeholder="Filter machines by name or serial number"
          value={search}
          onChange={setSearch}
          isSearching={machines.isFetching}
        />
      ) : null}
      <FormSelect
        control={control}
        name="machineId"
        label="Machine"
        required
        placeholder={machines.isPending ? 'Loading machines…' : options.length === 0 ? 'No active machines found' : 'Choose a machine'}
        options={options}
        disabled={machines.isPending}
      />
    </div>
  );
}
