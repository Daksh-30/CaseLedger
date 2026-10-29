import { type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function ActionModal({
  isOpen,
  onClose,
  title,
  description,
  children,
}: ActionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg border-cyber-border-light bg-cyber-surface shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-cyber-text-muted hover:text-cyber-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-cyber-text-primary tracking-tight">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-cyber-text-secondary">{description}</p>
          )}
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}
