import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderOpen, Search, FilePlus, ArrowRight,
  Activity, ScrollText, AlertCircle, CheckCircle,
  Scale, Gavel, Archive,
} from 'lucide-react';
import { useContract } from '../hooks/useContract';
import { StatCard } from '../components/ui/StatCard';
import { CaseStatusBadge } from '../components/ui/CaseStatusBadge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { CaseStatus } from '../types';
import type { CaseRecord, AuditEvent } from '../types';

export function Dashboard() {
  const { getAllCases, getAuditEvents, contract } = useContract();
  const [cases,  setCases]  = useState<CaseRecord[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!contract) { setLoading(false); return; }
      setLoading(true);
      try {
        const [cList, eList] = await Promise.all([getAllCases(), getAuditEvents()]);
        if (!mounted) return;
        setCases(cList);
        setEvents(eList);
      } catch (err) { console.error('Dashboard load error:', err); }
      finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [contract, getAllCases, getAuditEvents]);

  const stats = useMemo(() => ({
    total:        cases.length,
    registered:   cases.filter(c => c.status === CaseStatus.Registered).length,
    investigating: cases.filter(c => c.status === CaseStatus.UnderInvestigation).length,
    charges:      cases.filter(c => c.status === CaseStatus.ChargesFiled).length,
    inCourt:      cases.filter(c => c.status === CaseStatus.InCourt).length,
    closed:       cases.filter(c => c.status === CaseStatus.Closed).length,
    archived:     cases.filter(c => c.status === CaseStatus.Archived).length,
  }), [cases]);

  const activeCases = useMemo(() =>
    cases.filter(c => c.status !== CaseStatus.Archived && c.status !== CaseStatus.Closed),
    [cases]
  );

  if (loading) return <LoadingSpinner label="Loading CaseLedger registry..." size="lg" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-cyber-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-cyber-text-primary">
              Case Management Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px]
                             font-mono bg-cyber-teal/10 text-cyber-teal border border-cyber-teal/20">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-teal animate-pulse" />
              LEDGER LIVE
            </span>
          </div>
          <p className="mt-1 text-sm text-cyber-text-secondary">
            Blockchain-based criminal case record management and audit system.
            All records shown are fictional demo data only.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link to="/verify" className="btn-secondary text-xs flex items-center gap-1.5">
            <Search className="w-4 h-4 text-cyber-teal" />
            Verify Record
          </Link>
          <Link to="/file" className="btn-primary text-xs flex items-center gap-1.5">
            <FilePlus className="w-4 h-4" />
            File New Case
          </Link>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300/90 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
        <span>
          <strong>Academic Prototype.</strong> This system is not suitable for storing or processing
          real criminal records. All case references and identities shown are entirely fictional.
          Blockchain status values represent administrative case progress only and do not constitute
          a finding of guilt or legal determination of any kind.
        </span>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard title="Total Cases"        value={stats.total}        icon={FolderOpen}   color="teal"   subtitle="All registered records" />
        <StatCard title="Under Investigation" value={stats.investigating} icon={Search}       color="amber"  subtitle="Active investigations" />
        <StatCard title="Charges Filed"      value={stats.charges}      icon={AlertCircle}  color="red"    subtitle="Awaiting court" />
        <StatCard title="In Court"           value={stats.inCourt}      icon={Gavel}        color="purple" subtitle="Active proceedings" />
        <StatCard title="Registered"         value={stats.registered}   icon={Scale}        color="blue"   subtitle="Awaiting investigation" />
        <StatCard title="Closed"             value={stats.closed}       icon={CheckCircle}  color="green"  subtitle="Concluded cases" />
        <StatCard title="Archived"           value={stats.archived}     icon={Archive}      color="teal"   subtitle="Archived records" />
        <StatCard title="Audit Events"       value={events.length}      icon={ScrollText}   color="teal"   subtitle="On-chain log entries" />
      </div>

      {/* Bottom Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active cases table */}
        <div className="card lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cyber-border">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-cyber-teal" />
              <h2 className="text-base font-semibold text-cyber-text-primary">Active Cases</h2>
            </div>
            <Link to="/cases" className="text-xs text-cyber-teal hover:underline flex items-center gap-1">
              All Cases ({cases.length}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {activeCases.length === 0 ? (
            <p className="text-center py-10 text-cyber-text-muted text-sm">No active cases on-chain.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-cyber-text-muted border-b border-cyber-border">
                    <th className="pb-2.5 font-medium">Case Ref</th>
                    <th className="pb-2.5 font-medium">Category</th>
                    <th className="pb-2.5 font-medium">Status</th>
                    <th className="pb-2.5 font-medium">Filed</th>
                    <th className="pb-2.5 font-medium text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyber-border">
                  {activeCases.slice(0, 6).map((c) => (
                    <tr key={c.caseId} className="hover:bg-cyber-surface/50 transition-colors">
                      <td className="py-2.5">
                        <Link to={`/cases/${encodeURIComponent(c.caseId)}`}
                          className="font-mono text-sm font-semibold text-cyber-teal hover:underline">
                          {c.caseRef}
                        </Link>
                      </td>
                      <td className="py-2.5 text-xs text-cyber-text-secondary">{c.category}</td>
                      <td className="py-2.5"><CaseStatusBadge status={c.status} size="sm" /></td>
                      <td className="py-2.5 text-xs text-cyber-text-muted">{c.filingDate}</td>
                      <td className="py-2.5 text-right">
                        <Link to={`/cases/${encodeURIComponent(c.caseId)}`}
                          className="text-xs text-cyber-teal hover:underline">View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Audit feed */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cyber-border">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyber-teal" />
              <h2 className="text-base font-semibold text-cyber-text-primary">Audit Stream</h2>
            </div>
            <Link to="/audit" className="text-xs text-cyber-teal hover:underline">Full Trail</Link>
          </div>

          {events.length === 0 ? (
            <p className="text-center py-10 text-cyber-text-muted text-sm">No audit events yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {events.slice(0, 8).map((evt, idx) => (
                <div key={`${evt.transactionHash}-${idx}`}
                  className="p-3 bg-cyber-surface rounded-lg border border-cyber-border text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-cyber-text-primary">{evt.type}</span>
                    <span className="font-mono text-[10px] text-cyber-text-muted">#{evt.blockNumber}</span>
                  </div>
                  <p className="text-cyber-text-secondary truncate">{evt.details}</p>
                  <div className="flex items-center justify-between text-[10px] text-cyber-text-muted font-mono">
                    <span>by {evt.actor.slice(0, 6)}...{evt.actor.slice(-4)}</span>
                    <span className="text-cyber-teal">{evt.transactionHash.slice(0, 10)}...</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
