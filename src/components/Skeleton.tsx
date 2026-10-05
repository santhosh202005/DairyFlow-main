import React from 'react';

export function StatCardSkeleton() {
  return (
    <div className="bento-card relative overflow-hidden bg-white border border-slate-100 p-5 rounded-2xl animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="w-12 h-4 rounded bg-slate-100" />
      </div>
      <div className="w-24 h-7 rounded-lg bg-slate-100 mb-2" />
      <div className="w-32 h-3.5 rounded bg-slate-50" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b border-slate-50 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-slate-100 rounded w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full bg-white rounded-2xl overflow-hidden border border-slate-100">
      <div className="bg-slate-50/70 p-4 border-b border-slate-100 flex gap-4">
        {Array.from({ length: Math.min(cols, 4) }).map((_, i) => (
          <div key={i} className="h-3.5 bg-slate-200 rounded w-20 animate-pulse" />
        ))}
      </div>
      <div className="divide-y divide-slate-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100" />
              <div className="space-y-1.5">
                <div className="w-28 h-4 bg-slate-100 rounded" />
                <div className="w-16 h-3 bg-slate-50 rounded" />
              </div>
            </div>
            <div className="w-20 h-4 bg-slate-100 rounded hidden sm:block" />
            <div className="w-16 h-4 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function BillingDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
            <div className="w-8 h-8 rounded-lg bg-slate-100" />
            <div className="w-16 h-5 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={4} cols={5} />
    </div>
  );
}
