import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, Filter, Check, Calendar, User,
  ExternalLink, ShieldAlert,
} from 'lucide-react';
import { useContract } from '../hooks/useContract';
import { useWeb3 } from '../contexts/Web3Context';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import type { CaseUpdate, CaseRecord } from '../types';

interface UpdateWithCase extends CaseUpdate { case?: CaseRecord; }

export function CaseUpdates() {
  const { getAllCases, getCaseUpdates, acknowledgeCaseUpdate, contract } = useContract();
  const { wallet } = useWeb3();

  const [updates,  setUpdates]  = useState<UpdateWithCase[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [statusFilter,   setStatusFilter]   = useState<'all' | 'pending' | 'acknowledged'>('all');
  const [priorityFilter, setPriorityFilter] = useState<number | 'all'>('all');

  const isOfficer  = wallet.roles.includes('officer')  || wallet.roles.includes('admin');
  const isReviewer = wallet.roles.includes('reviewer') || wallet.roles.includes('admin');

  const loadData = useCallback(async () => {
    if (!contract) { setLoading(false); return; }
    setLoading(true);
    try {
      const cases = await getAllCases();
      const all: UpdateWithCase[] = [];
      for (const c of cases) {
        const upds = await getCaseUpdates(c.caseId);
        for (const u of upds) all.push({ ...u, case: c });
      }
      all.sort((a, b) => Number(b.id - a.id));
      setUpdates(all);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [contract, getAllCases, getCaseUpdates]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => ({
    total:    updates.length,
    pending:  updates.filter(u => !u.acknowledged).length,
    acked:    updates.filter(u => u.acknowledged).length,
    critical: updates.filter(u => !u.acknowledged && u.priority >= 4).length,
  }), [updates]);

  const filtered = useMemo(() => updates.filter(u => {
    if (statusFilter === 'pending'      && u.acknowledged)  return false;
    if (statusFilter === 'acknowledged' && !u.acknowledged) return false;
    if (priorityFilter !== 'all'        && u.priority !== priorityFilter) return false;
    return true;
  }), [updates, statusFilter, priorityFilter]);

  const handleAck = async (u: UpdateWithCase) => {
    const ok = await acknowledgeCaseUpdate(Number(u.id), u.caseId);
    if (ok) await loadData();
  };

  const fmt = (ts: bigint) =>
    new Date(Number(ts) * 1000).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-cyber-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cyber-text-primary">Case Updates</h1>
          <p className="mt-1 text-sm text-cyber-text-secondary">
            Procedural developments and alerts reported against registered case records.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Updates"   value={stats.total}    icon={AlertCircle} color="teal"  subtitle="All recorded" />
        <StatCard title="Pending"         value={stats.pending}  icon={AlertCircle} color="amber" subtitle="Awaiting acknowledgement" />
        <StatCard title="Critical (P4–5)" value={stats.critical} icon={ShieldAlert} color="red"   subtitle="Immediate attention" />
        <StatCard title="Acknowledged"    value={stats.acked}    icon={Check}       color="green" subtitle="Processed" />
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-cyber-text-muted flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {(['all', 'pending', 'acknowledged'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 rounded-full font-medium transition-colors ${
                statusFilter === f
                  ? 'bg-cyber-teal text-cyber-bg font-semibold'
                  : 'bg-cyber-surface text-cyber-text-secondary border border-cyber-border'
              }`}>
              {f === 'all' ? `All (${updates.length})` :
               f === 'pending' ? `Pending (${stats.pending})` :
               `Acknowledged (${stats.acked})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-cyber-text-muted">Priority:</span>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-cyber-surface border border-cyber-border rounded-lg px-2.5 py-1.5 text-xs text-cyber-text-primary focus:outline-none focus:border-cyber-teal">
            <option value="all">All Priorities</option>
            <option value={5}>P5 — Critical</option>
            <option value={4}>P4 — High</option>
            <option value={3}>P3 — Medium</option>
            <option value={2}>P2 — Low</option>
            <option value={1}>P1 — Info</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? <LoadingSpinner label="Loading case updates from blockchain..." /> :
       filtered.length === 0 ? (
        <EmptyState
          title="No updates match your filters"
          description="All updates have been acknowledged, or no updates have been reported yet."
          icon={AlertCircle}
          actionText="Reset Filters"
          onAction={() => { setStatusFilter('all'); setPriorityFilter('all'); }}
        />
       ) : (
        <div className="space-y-4">
          {filtered.map(u => (
            <div key={u.id.toString()}
              className={`card p-5 space-y-3 transition-all ${
                u.acknowledged
                  ? 'border-cyber-border bg-cyber-card/70'
                  : 'border-cyber-amber/50 bg-amber-950/15 shadow-glow-amber'
              }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-cyber-border/60">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-cyber-text-primary">
                    Update #{u.id.toString()}
                  </span>
                  <PriorityBadge priority={u.priority} />
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    u.acknowledged
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>{u.acknowledged ? 'ACKNOWLEDGED' : 'PENDING'}</span>
                </div>
                {u.case && (
                  <Link to={`/cases/${encodeURIComponent(u.caseId)}`}
                    className="inline-flex items-center gap-1.5 text-xs text-cyber-teal hover:underline">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {u.case.caseRef} — {u.case.category}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              <p className="text-sm text-cyber-text-primary">{u.summary}</p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-cyber-text-muted border-t border-cyber-border/40">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1 font-mono">
                    <User className="w-3.5 h-3.5 text-cyber-teal" />
                    {u.reporter.slice(0,6)}...{u.reporter.slice(-4)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />{fmt(u.timestamp)}
                  </span>
                </div>
                {(isOfficer || isReviewer) && !u.acknowledged && (
                  <button onClick={() => handleAck(u)}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 self-end sm:self-auto">
                    <Check className="w-3.5 h-3.5" /> Acknowledge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
       )}
    </div>
  );
}
