import type { LucideIcon } from 'lucide-react';
import { PackageOpen } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon: Icon = PackageOpen,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="card text-center py-12 flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center text-cyber-text-muted mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-cyber-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-cyber-text-muted max-w-sm">{description}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="mt-4 btn-secondary text-xs">
          {actionText}
        </button>
      )}
    </div>
  );
}
