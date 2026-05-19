'use client';

import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
};

export function Skeleton({ className, rounded = 'md' }: Props) {
  const radius = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full'
  }[rounded];
  return <div className={cn('animate-pulse bg-slate-200', radius, className)} />;
}

export function SkeletonText({ widthClass = 'w-32' }: { widthClass?: string }) {
  return <Skeleton className={`h-4 ${widthClass}`} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('card flex flex-col gap-2', className)}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton rounded="full" className="w-10 h-10 shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}
