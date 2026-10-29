import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  FilePlus,
  ShieldCheck,
  ScrollText,
  AlertCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Scale,
} from 'lucide-react';

const navItems = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard'        },
  { to: '/cases',   icon: FolderOpen,      label: 'Case Registry'    },
  { to: '/file',    icon: FilePlus,        label: 'File New Case'     },
  { to: '/verify',  icon: ShieldCheck,     label: 'Verify Record'    },
  { to: '/updates', icon: AlertCircle,     label: 'Case Updates'     },
  { to: '/audit',   icon: ScrollText,      label: 'Audit Trail'      },
  { to: '/admin',   icon: Settings,        label: 'Access Management'},
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`fixed left-0 top-0 h-screen bg-cyber-surface border-r border-cyber-border
                       flex flex-col transition-all duration-300 z-40
                       ${collapsed ? 'w-16' : 'w-64'}`}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-cyber-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyber-teal to-cyber-blue
                        flex items-center justify-center flex-shrink-0 shadow-glow-teal">
          <Scale className="w-5 h-5 text-cyber-bg" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-sm font-bold text-cyber-text-primary tracking-wide">CaseLedger</h1>
            <p className="text-[10px] text-cyber-text-muted">Criminal Record Registry</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                   ${isActive
                     ? 'bg-cyber-teal/10 text-cyber-teal border border-cyber-teal/20'
                     : 'text-cyber-text-secondary hover:bg-cyber-card hover:text-cyber-text-primary border border-transparent'
                   }`
                }
                title={label}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Academic disclaimer */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[9px] text-amber-400/70 leading-relaxed">
            ACADEMIC PROTOTYPE — Not for use with real criminal data
          </div>
        </div>
      )}

      <button
        onClick={onToggle}
        className="flex items-center justify-center h-12 border-t border-cyber-border
                   text-cyber-text-muted hover:text-cyber-text-primary transition-colors"
      >
        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>
    </aside>
  );
}
