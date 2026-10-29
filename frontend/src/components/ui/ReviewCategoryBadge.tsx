import { ShieldCheck, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { ReviewCategory } from '../../types';

interface ReviewCategoryBadgeProps { category: ReviewCategory; }

const configs = {
  [ReviewCategory.IntegrityVerification]: { label: 'Integrity Verified', Icon: ShieldCheck,  className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  [ReviewCategory.RecordReview]:          { label: 'Record Review',      Icon: FileText,     className: 'bg-cyan-500/10   text-cyan-400   border-cyan-500/20'   },
  [ReviewCategory.OfficialApproval]:      { label: 'Official Approval',  Icon: CheckCircle2, className: 'bg-blue-500/10   text-blue-400   border-blue-500/20'   },
  [ReviewCategory.RecordDispute]:         { label: 'Record Dispute',     Icon: AlertCircle,  className: 'bg-amber-500/10  text-amber-400  border-amber-500/20'  },
};

export function ReviewCategoryBadge({ category }: ReviewCategoryBadgeProps) {
  const { label, Icon, className } = configs[category] ?? configs[ReviewCategory.RecordReview];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border ${className}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {label}
    </span>
  );
}
