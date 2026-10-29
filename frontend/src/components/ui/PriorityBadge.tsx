interface PriorityBadgeProps { priority: number; }

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const configs: Record<number, { label: string; className: string }> = {
    1: { label: 'P1 — Info',     className: 'bg-blue-500/10   text-blue-400   border-blue-500/20'   },
    2: { label: 'P2 — Low',      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    3: { label: 'P3 — Medium',   className: 'bg-amber-500/10  text-amber-400  border-amber-500/20'  },
    4: { label: 'P4 — High',     className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    5: { label: 'P5 — Critical', className: 'bg-red-500/10    text-red-400    border-red-500/20 animate-pulse' },
  };
  const c = configs[priority] ?? configs[3];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono border ${c.className}`}>
      {c.label}
    </span>
  );
}
