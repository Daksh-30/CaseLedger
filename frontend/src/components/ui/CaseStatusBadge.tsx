import { FileText, Search, AlertTriangle, Gavel, CheckCircle, Archive } from 'lucide-react';
import { CaseStatus } from '../../types';

interface CaseStatusBadgeProps {
  status: CaseStatus;
  size?: 'sm' | 'md';
}

const config: Record<CaseStatus, { label: string; className: string; Icon: React.ElementType }> = {
  [CaseStatus.Registered]:         { label: 'Registered',          className: 'bg-sky-500/10    text-sky-400    border-sky-500/20',    Icon: FileText      },
  [CaseStatus.UnderInvestigation]: { label: 'Under Investigation', className: 'bg-amber-500/10  text-amber-400  border-amber-500/20',  Icon: Search        },
  [CaseStatus.ChargesFiled]:       { label: 'Charges Filed',       className: 'bg-orange-500/10 text-orange-400 border-orange-500/20', Icon: AlertTriangle },
  [CaseStatus.InCourt]:            { label: 'In Court',            className: 'bg-purple-500/10 text-purple-400 border-purple-500/20', Icon: Gavel         },
  [CaseStatus.Closed]:             { label: 'Closed',              className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', Icon: CheckCircle },
  [CaseStatus.Archived]:           { label: 'Archived',            className: 'bg-gray-500/10   text-gray-400   border-gray-500/20',   Icon: Archive       },
};

export function CaseStatusBadge({ status, size = 'md' }: CaseStatusBadgeProps) {
  const { label, className, Icon } = config[status] ?? config[CaseStatus.Registered];
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      <Icon className={`${iconSize} flex-shrink-0`} />
      {label}
    </span>
  );
}
