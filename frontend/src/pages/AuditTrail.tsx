import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ScrollText, Search, Copy, Check, RefreshCw,
  FilePlus, FileText, ChevronRight, ShieldCheck,
  AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useContract } from '../hooks/useContract';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import type { AuditEvent } from '../types';

const EVENT_STYLES: Record<string, string> = {
  'Case Registered':     'bg-cyber-teal/10  text-cyber-teal  border-cyber-teal/20',
  'Metadata Updated':    'bg-blue-500/10    text-blue-400    border-blue-500/20',
  'Status Changed':      'bg-purple-500/10  text-purple-400  border-purple-500/20',
  'Case Reviewed':       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Update Reported':     'bg-amber-500/10   text-amber-400   border-amber-500/20',
  'Update Acknowledged': 'bg-cyan-500/10    text-cyan-400    border-cyan-500/20',
};

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case 'Case Registered':     return <FilePlus      className="w-4 h-4 text-cyber-teal"  />;
    case 'Metadata Updated':    return <FileText      className="w-4 h-4 text-blue-400"    />;
    case 'Status Changed':      return <ChevronRight  className="w-4 h-4 text-purple-400"  />;
    case 'Case Reviewed':       return <ShieldCheck   className="w-4 h-4 text-emerald-400" />;
    case 'Update Reported':     return <AlertCircle   className="w-4 h-4 text-amber-400"   />;
    case 'Update Acknowledged': return <CheckCircle2  className="w-4 h-4 text-cyan-400"    />;
    default:                    return <ScrollText    className="w-4 h-4 text-cyber-text-muted" />;
  }
}

const ALL_TYPES = [
  'Case Registered', 'Metadata Updated', 'Status Changed',
  'Case Reviewed', 'Update Reported', 'Update Acknowledged',
];

export function AuditTrail() {
  const { getAuditEvents, contract } = useContract();
  const [events,  setEvents]  = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [copiedTx,   setCopiedTx]   = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!contract) { setLoading(false); return; }
    setLoading(true);
    try {
      setEvents(await getAuditEvents());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [contract, getAuditEvents]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTx(id);
    setTimeout(() => setCopiedTx(null), 2000);
  };

  const filtered = useMemo(() => events.filter(evt => {
    if (typeFilter !== 'all' && evt.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        evt.type.toLowerCase().includes(q) ||
        evt.actor.toLowerCase().includes(q) ||
        evt.details.toLowerCase().includes(q) ||
        evt.caseId.toLowerCase().includes(q) ||
        evt.transactionHash.toLowerCase().includes(q)
      );
    }
    return true;
  }), [events, typeFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-cyber-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cyber-text-primary">Blockchain Audit Trail</h1>
          <p className="mt-1 text-sm text-cyber-text-secondary">
            Chronological, tamper-evident log of all on-chain case management events.
          </p>
        </div>
        <button onClick={fetchEvents}
          className="btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-cyber-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by event type, actor address, case ID, or transaction hash..."
              className="input-field pl-10 text-xs" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-xs
                       text-cyber-text-primary focus:outline-none focus:border-cyber-teal">
            <option value="all">All Event Types ({events.length})</option>
            {ALL_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <LoadingSpinner label="Querying on-chain event logs..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No audit events found"
          description={
            search || typeFilter !== 'all'
              ? 'Try broadening your search or clearing the type filter.'
              : 'No events have been emitted yet. Register a case to generate the first audit entry.'
          }
          icon={ScrollText}
          actionText={search || typeFilter !== 'all' ? 'Reset Filters' : undefined}
          onAction={() => { setSearch(''); setTypeFilter('all'); }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((evt, idx) => {
            const badgeClass = EVENT_STYLES[evt.type] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
            return (
              <div key={`${evt.transactionHash}-${idx}`}
                className="card p-4 hover:border-cyber-border-light transition-colors space-y-2.5">

                {/* Top row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2
                                pb-2 border-b border-cyber-border/50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded
                                     text-xs font-semibold border ${badgeClass}`}>
                      <EventIcon type={evt.type} />
                      {evt.type}
                    </span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyber-surface
                                     border border-cyber-border text-cyber-text-muted">
                      Block #{evt.blockNumber}
                    </span>
                  </div>
                  <div className="text-xs text-cyber-text-muted font-mono flex items-center gap-1.5">
                    <span>Actor:</span>
                    <span className="text-cyber-text-secondary">{evt.actor}</span>
                  </div>
                </div>

                {/* Details row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-cyber-text-muted uppercase text-[10px] block">Details:</span>
                    <span className="font-medium text-cyber-text-primary">{evt.details}</span>
                  </div>
                  <div className="font-mono text-xs text-cyber-text-muted">
                    <span className="text-[10px] uppercase block">Case ID:</span>
                    <span className="text-cyber-text-secondary truncate max-w-[200px] inline-block">
                      {evt.caseId?.slice(0, 18)}...
                    </span>
                  </div>
                </div>

                {/* Tx hash */}
                <div className="pt-2 border-t border-cyber-border/40 flex items-center
                                justify-between text-[11px] font-mono text-cyber-text-muted">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="uppercase text-[10px]">TxHash:</span>
                    <span className="text-cyber-teal truncate max-w-sm">{evt.transactionHash}</span>
                    <button onClick={() => copy(evt.transactionHash, `tx-${idx}`)}
                      className="hover:text-cyber-text-primary ml-1">
                      {copiedTx === `tx-${idx}`
                        ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                        : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider hidden sm:inline">CONFIRMED</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
