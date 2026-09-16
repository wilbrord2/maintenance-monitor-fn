'use client';

import { ArrowRight, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { MachineStateBadge } from '@/components/status/machine-state-badge';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/constants/routes';
import { useMachines } from '@/features/machines/api/queries';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils/cn';
import { type Machine } from '@/types/machine';

const RESULT_LIMIT = 6;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Header search for machines by name or serial number. Press "/" to focus. */
export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [term, setTerm] = useState('');
  const [committed, setCommitted] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const commit = useDebouncedCallback((value: string) => setCommitted(value.trim()), 250);

  const query = useMachines({ search: committed, limit: RESULT_LIMIT, page: 1 }, { enabled: committed.length > 0 });
  const results: Machine[] = committed ? (query.data?.items ?? []) : [];
  const trimmed = term.trim();
  const showPanel = open && trimmed.length > 0;
  const waiting = trimmed !== committed || query.isFetching;

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const close = () => {
    commit.cancel();
    setTerm('');
    setCommitted('');
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const openMachine = (machine: Machine) => {
    router.push(ROUTES.machine(machine.id));
    close();
  };

  const searchAll = () => {
    if (!trimmed) return;
    router.push(`${ROUTES.machines}?search=${encodeURIComponent(trimmed)}`);
    close();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const active = results[activeIndex];
      if (active) openMachine(active);
      else searchAll();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  return (
    <div
      className="relative w-full max-w-md"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search machines by name or serial number"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        placeholder="Search machines…"
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        icon={Search}
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
          commit(event.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="bg-sunken"
        trailing={
          <kbd className="mr-1.5 hidden rounded-sm border border-line bg-panel px-1.5 font-mono text-[10px] text-muted md:inline" aria-hidden>
            /
          </kbd>
        }
      />

      {showPanel ? (
        <div className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-lg border border-line bg-panel shadow-overlay animate-pop-in">
          <ul id={listId} role="listbox" aria-label="Matching machines" aria-busy={waiting}>
            {results.map((machine, index) => (
              <li
                key={machine.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => openMachine(machine)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn('flex cursor-pointer items-center justify-between gap-3 px-3 py-2', index === activeIndex && 'bg-hover')}
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{machine.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted">{machine.serialNumber}</p>
                </div>
                <MachineStateBadge state={machine.status} size="sm" />
              </li>
            ))}
          </ul>
          {results.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-muted" aria-live="polite">
              {waiting ? 'Searching…' : query.isError ? "Search isn't available right now." : `No machines match “${trimmed}”.`}
            </p>
          ) : null}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={searchAll}
            className="flex w-full items-center justify-between gap-2 border-t border-line bg-sunken px-3 py-2 text-left text-xs font-medium text-ink-secondary hover:bg-hover"
          >
            <span className="truncate">Show all results for “{trimmed}”</span>
            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
