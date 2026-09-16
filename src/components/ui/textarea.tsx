import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';
import { fieldControlClasses } from './input';

export function Textarea({ className, rows = 3, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      rows={rows}
      className={cn(fieldControlClasses, 'min-h-[4.5rem] resize-y px-3 py-2 leading-relaxed', className)}
      {...props}
    />
  );
}
