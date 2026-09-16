'use client';

import { Search, X } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils/cn';
import { Input } from './input';
import { Spinner } from './spinner';

export interface SearchInputProps {
  id?: string;
  /** Committed search term (usually from the URL). */
  value: string;
  onChange(value: string): void;
  label: string;
  placeholder?: string;
  debounceMs?: number;
  /** Shows a spinner while results for the committed term are loading. */
  isSearching?: boolean;
  maxLength?: number;
  className?: string;
}

/** Debounced search: requests go out after typing pauses, not on every keystroke. */
export function SearchInput({
  id,
  value,
  onChange,
  label,
  placeholder = 'Search',
  debounceMs = 350,
  isSearching = false,
  maxLength = 100,
  className,
}: SearchInputProps) {
  const [draft, setDraft] = useState(value);
  const [committed, setCommitted] = useState(value);
  const commit = useDebouncedCallback((next: string) => onChange(next.trim()), debounceMs);

  // Follow external changes such as "Clear filters" or browser navigation.
  if (value !== committed) {
    setCommitted(value);
    setDraft(value);
  }

  const clear = () => {
    commit.cancel();
    setDraft('');
    if (value !== '') onChange('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && draft) {
      event.preventDefault();
      clear();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commit.cancel();
      if (draft.trim() !== value) onChange(draft.trim());
    }
  };

  return (
    <Input
      id={id}
      type="search"
      role="searchbox"
      aria-label={label}
      icon={Search}
      value={draft}
      maxLength={maxLength}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => {
        setDraft(event.target.value);
        commit(event.target.value);
      }}
      onKeyDown={handleKeyDown}
      wrapperClassName={cn('w-full', className)}
      className="[&::-webkit-search-cancel-button]:hidden"
      trailing={
        isSearching ? (
          <span className="inline-flex size-8 items-center justify-center">
            <Spinner label="Searching" className="size-3.5" />
          </span>
        ) : draft ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="inline-flex size-7 items-center justify-center rounded-sm text-muted hover:bg-hover hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null
      }
    />
  );
}
