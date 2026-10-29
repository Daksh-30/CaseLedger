import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color?: 'teal' | 'green' | 'amber' | 'red' | 'blue' | 'purple';
  subtitle?: string;
  onClick?: () => void;
}

const colorMap = {
  teal: {
    bg: 'bg-cyber-teal/10',
    border: 'border-cyber-teal/30',
    text: 'text-cyber-teal',
    glow: 'hover:shadow-glow-teal',
  },
  green: {
    bg: 'bg-cyber-green/10',
    border: 'border-cyber-green/30',
    text: 'text-cyber-green',
    glow: 'hover:shadow-glow-green',
  },
  amber: {
    bg: 'bg-cyber-amber/10',
    border: 'border-cyber-amber/30',
    text: 'text-cyber-amber',
    glow: 'hover:shadow-glow-amber',
  },
  red: {
    bg: 'bg-cyber-red/10',
    border: 'border-cyber-red/30',
    text: 'text-cyber-red',
    glow: 'hover:shadow-glow-red',
  },
  blue: {
    bg: 'bg-cyber-blue/10',
    border: 'border-cyber-blue/30',
    text: 'text-cyber-blue',
    glow: '',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    glow: '',
  },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  color = 'teal',
  subtitle,
  onClick,
}: StatCardProps) {
  const styles = colorMap[color] || colorMap.teal;

  return (
    <div
      onClick={onClick}
      className={`card border ${styles.border} transition-all duration-200 ${styles.glow} ${
        onClick ? 'cursor-pointer hover:border-opacity-100' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-cyber-text-secondary">{title}</span>
        <div className={`p-2 rounded-lg ${styles.bg}`}>
          <Icon className={`w-5 h-5 ${styles.text}`} />
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold font-mono text-cyber-text-primary tracking-tight">
          {value}
        </span>
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-cyber-text-muted">{subtitle}</p>
      )}
    </div>
  );
}
