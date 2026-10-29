import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, FilePlus, Calendar, User, ArrowUpDown, ExternalLink } from 'lucide-react';
import { useContract } from '../hooks/useContract';
import { CaseStatusBadge } from '../components/ui/CaseStatusBadge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { CaseStatus } from '../types';
import type { CaseRecord } from '../types';

const STATUS_LABELS: Record<CaseStatus, string> = {
  [CaseStatus.Registered]:         'Registered',
  [CaseStatus.UnderInvestigation]: 'Under Investigation',
  [CaseStatus.ChargesFiled]:       'Charges Filed',
  [CaseStatus.InCourt]:            'In Court',
  [CaseStatus.Closed]:             'Closed',
  [CaseStatus.Archived]:           'Archived',
};

export function CaseList() {
  const { getAllCases, contract } = useContract();
  const [cases,   setCases]  = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CaseStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'ref'>('newest');

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!contract) { setLoading(false); return; }
      setLoading(true);
      try {
        const list = await getAllCases();
        if (mounted) setCases(list);
      } catch (err) { console.error(err); }
      finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [contract, getAllCases]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(cases.map(c => c.category)));
    return cats.sort();
  }, [cases]);

  const filtered = useMemo(() => {
    let list = [...cases];
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter);
    if (categoryFilter !== 'all') list = list.filter(c => c.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.caseRef.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.filedBy.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'newest') return b.filingDate.localeCompare(a.filingDate);
      if (sortBy === 'oldest') return a.filingDate.localeCompare(b.filingDate);
      return a.caseRef.localeCompare(b.caseRef);
    });
    return list;
  }, [cases, statusFilter, categoryFilter, search, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-cyber-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cyber-text-primary">Case Registry</h1>
          <p className="mt-1 text-sm text-cyber-text-secondary">
            Immutable on-chain index of registered case records. All entries are fictional demo data.
          </p>
        </div>
        <Link to="/file" className="btn-primary text-xs flex items-center gap-1.5 self-start sm:self-auto">
          <FilePlus className="w-4 h-4" /> File New Case
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-cyber-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search case reference, category, officer address..."
              className="input-field pl-10 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-cyber-text-muted" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-xs text-cyber-text-primary focus:outline-none focus:border-cyber-teal">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="ref">Reference A–Z</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-cyber-border/60">
          <span className="text-xs text-cyber-text-muted flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          <button onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-cyber-teal text-cyber-bg font-semibold'
                : 'bg-cyber-surface text-cyber-text-secondary hover:text-cyber-text-primary border border-cyber-border'
            }`}>All ({cases.length})</button>
          {Object.values(CaseStatus).filter(v => typeof v === 'number').map(s => (
            <button key={s} onClick={() => setStatusFilter(s as CaseStatus)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-cyber-teal/20 text-cyber-teal border border-cyber-teal/40'
                  : 'bg-cyber-surface text-cyber-text-secondary hover:text-cyber-text-primary border border-cyber-border'
              }`}>
              {STATUS_LABELS[s as CaseStatus]} ({cases.filter(c => c.status === s).length})
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-cyber-text-muted">Category:</span>
            <button onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-cyber-teal text-cyber-bg font-semibold'
                  : 'bg-cyber-surface text-cyber-text-secondary border border-cyber-border'
              }`}>All</button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === cat
                    ? 'bg-cyber-teal/20 text-cyber-teal border border-cyber-teal/40'
                    : 'bg-cyber-surface text-cyber-text-secondary border border-cyber-border'
                }`}>{cat}</button>
            ))}
          </div>
        )}
      </div>

      {loading ? <LoadingSpinner label="Querying case registry..." /> :
       filtered.length === 0 ? (
        <EmptyState
          title="No cases match your criteria"
          description="Try clearing filters or file a new case record."
          actionText="Reset Filters"
          onAction={() => { setSearch(''); setStatusFilter('all'); setCategoryFilter('all'); }}
        />
       ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(c => (
            <div key={c.caseId} className="card hover:border-cyber-border-light transition-all duration-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Link to={`/cases/${encodeURIComponent(c.caseId)}`}
                    className="font-mono text-lg font-bold text-cyber-teal hover:underline">
                    {c.caseRef}
                  </Link>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyber-surface border border-cyber-border text-cyber-text-secondary">
                    {c.category}
                  </span>
                  <CaseStatusBadge status={c.status} size="sm" />
                </div>
                <p className="text-xs text-cyber-text-secondary line-clamp-1">{c.description || 'No description.'}</p>
                <div className="flex items-center gap-4 text-xs text-cyber-text-muted flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {c.filingDate}</span>
                  <span className="flex items-center gap-1 font-mono"><User className="w-3.5 h-3.5" /> {c.filedBy.slice(0,6)}...{c.filedBy.slice(-4)}</span>
                  <span>{c.relatedCases.length} related case(s)</span>
                </div>
              </div>
              <Link to={`/cases/${encodeURIComponent(c.caseId)}`}
                className="btn-primary text-xs flex items-center gap-1.5 self-start md:self-center flex-shrink-0">
                Details <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
       )}
    </div>
  );
}
