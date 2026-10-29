import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ label = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-cyber-teal">
      <Loader2 className={`${sizeMap[size]} animate-spin`} />
      {label && <p className="text-sm font-medium text-cyber-text-secondary">{label}</p>}
    </div>
  );
}
