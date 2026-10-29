import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Copy, Check, Calendar, User, Hash,
  AlertCircle, ShieldCheck, FileText, Layers,
  Plus, ChevronRight,
} from 'lucide-react';
import { useContract } from '../hooks/useContract';
import { useWeb3 } from '../contexts/Web3Context';
import { useFileHash } from '../hooks/useFileHash';
import { CaseStatusBadge } from '../components/ui/CaseStatusBadge';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import { ReviewCategoryBadge } from '../components/ui/ReviewCategoryBadge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ActionModal } from '../components/ui/ActionModal';
import { TransactionModal } from '../components/ui/TransactionModal';
import { CaseStatus, ReviewCategory } from '../types';
import type { CaseRecord, CaseReview, CaseUpdate } from '../types';

const STATUS_LABELS: Record<CaseStatus, string> = {
  [CaseStatus.Registered]:         'Registered',
  [CaseStatus.UnderInvestigation]: 'Under Investigation',
  [CaseStatus.ChargesFiled]:       'Charges Filed',
  [CaseStatus.InCourt]:            'In Court',
  [CaseStatus.Closed]:             'Closed',
  [CaseStatus.Archived]:           'Archived',
};

/** Returns the valid next statuses from a given current status */
function allowedTransitions(current: CaseStatus): CaseStatus[] {
  switch (current) {
    case CaseStatus.Registered:         return [CaseStatus.UnderInvestigation, CaseStatus.Closed, CaseStatus.Archived];
    case CaseStatus.UnderInvestigation: return [CaseStatus.ChargesFiled, CaseStatus.Closed, CaseStatus.Archived];
    case CaseStatus.ChargesFiled:       return [CaseStatus.InCourt, CaseStatus.Closed, CaseStatus.Archived];
    case CaseStatus.InCourt:            return [CaseStatus.Closed, CaseStatus.Archived];
    case CaseStatus.Closed:             return [CaseStatus.UnderInvestigation, CaseStatus.Archived];
    case CaseStatus.Archived:           return [];
  }
}

export function CaseDetail() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const {
    getCase, getRelatedCases, getCasesRelatedTo, getCaseReviews, getCaseUpdates,
    updateCaseStatus, updateCaseMetadata, recordCaseReview, reportCaseUpdate,
    acknowledgeCaseUpdate, txState, resetTxState, contract,
  } = useContract();
  const { wallet } = useWeb3();

  const [caseRec,    setCaseRec]    = useState<CaseRecord | null>(null);
  const [related,    setRelated]    = useState<string[]>([]);
  const [relatedTo,  setRelatedTo]  = useState<string[]>([]);
  const [reviews,    setReviews]    = useState<CaseReview[]>([]);
  const [updates,    setUpdates]    = useState<CaseUpdate[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [copiedKey,  setCopiedKey]  = useState<string | null>(null);

  // Modal state
  const [activeModal, setActiveModal] = useState<
    'status' | 'metadata' | 'review' | 'update' | null>(null);
  const [modalReason,     setModalReason]     = useState('');
  const [selectedStatus,  setSelectedStatus]  = useState<CaseStatus>(CaseStatus.UnderInvestigation);
  const [reviewCategory,  setReviewCategory]  = useState<ReviewCategory>(ReviewCategory.IntegrityVerification);
  const [updatePriority,  setUpdatePriority]  = useState(3);

  // Quick integrity check on this page
  const { hash: computedHash, isHashing, hashFile, reset: resetHash } = useFileHash();
  const [integrityResult, setIntegrityResult] = useState<'match' | 'mismatch' | null>(null);

  const isOfficer  = wallet.roles.includes('officer')  || wallet.roles.includes('admin');
  const isReviewer = wallet.roles.includes('reviewer') || wallet.roles.includes('admin');

  const loadData = useCallback(async () => {
    if (!id || !contract) { setLoading(false); return; }
    setLoading(true);
    try {
      const [rec, rel, relTo, revs, upds] = await Promise.all([
        getCase(id), getRelatedCases(id), getCasesRelatedTo(id),
        getCaseReviews(id), getCaseUpdates(id),
      ]);
      setCaseRec(rec);
      setRelated(rel);
      setRelatedTo(relTo);
      setReviews(revs);
      setUpdates(upds);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [id, contract, getCase, getRelatedCases, getCasesRelatedTo, getCaseReviews, getCaseUpdates]);

  useEffect(() => { loadData(); }, [loadData]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fmt = (ts: bigint) =>
    new Date(Number(ts) * 1000).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !modalReason.trim()) return;
    const ok = await updateCaseStatus(id, selectedStatus, modalReason.trim());
    if (ok) { setActiveModal(null); setModalReason(''); await loadData(); }
  };

  const handleMetadataSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !modalReason.trim() || !computedHash) return;
    const ok = await updateCaseMetadata(id, computedHash, modalReason.trim());
    if (ok) { setActiveModal(null); setModalReason(''); resetHash(); await loadData(); }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !modalReason.trim()) return;
    const ok = await recordCaseReview(id, reviewCategory, modalReason.trim());
    if (ok) { setActiveModal(null); setModalReason(''); await loadData(); }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !modalReason.trim()) return;
    const ok = await reportCaseUpdate(id, modalReason.trim(), updatePriority);
    if (ok) { setActiveModal(null); setModalReason(''); await loadData(); }
  };

  const handleAcknowledge = async (updateId: bigint) => {
    if (!id) return;
    const ok = await acknowledgeCaseUpdate(Number(updateId), id);
    if (ok) await loadData();
  };

  const handleFileForVerify = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !caseRec) return;
    const h = await hashFile(file);
    if (h) setIntegrityResult(
      h.toLowerCase() === caseRec.metadataHash.toLowerCase() ? 'match' : 'mismatch'
    );
  };

  if (loading) return <LoadingSpinner label="Loading case record from blockchain..." size="lg" />;
  if (!caseRec) return (
    <div className="card text-center py-12 space-y-4">
      <AlertCircle className="w-12 h-12 text-cyber-amber mx-auto" />
      <h2 className="text-xl font-bold text-cyber-text-primary">Case Not Found</h2>
      <p className="text-sm text-cyber-text-muted">No record found for ID: <span className="font-mono">{id}</span></p>
      <button onClick={() => navigate('/cases')} className="btn-secondary text-xs">Return to Registry</button>
    </div>
  );

  const transitions = allowedTransitions(caseRec.status);

  return (
    <div className="space-y-6">
      <Link to="/cases" className="inline-flex items-center gap-1.5 text-xs text-cyber-text-secondary hover:text-cyber-teal">
        <ArrowLeft className="w-4 h-4" /> Back to Case Registry
      </Link>

      {/* Hero card */}
      <div className="card p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-cyber-border">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-mono font-bold text-cyber-teal">{caseRec.caseRef}</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-cyber-surface border border-cyber-border text-cyber-text-secondary">
                {caseRec.category}
              </span>
              <CaseStatusBadge status={caseRec.status} />
            </div>
            <p className="mt-2 text-sm text-cyber-text-secondary max-w-2xl">
              {caseRec.description || 'No description provided.'}
            </p>
            <p className="mt-1 text-[11px] text-amber-400/70 italic">
              ⚠ Administrative record only — status does not constitute a determination of guilt or conviction.
            </p>
          </div>

          {/* Action toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {(isOfficer || isReviewer) && transitions.length > 0 && (
              <button onClick={() => {
                setSelectedStatus(transitions[0]);
                setModalReason('');
                setActiveModal('status');
              }} className="btn-secondary text-xs flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5 text-cyber-teal" /> Update Status
              </button>
            )}
            {isOfficer && (
              <button onClick={() => { resetHash(); setModalReason(''); setActiveModal('metadata'); }}
                className="btn-secondary text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyber-teal" /> Update Metadata
              </button>
            )}
            {isReviewer && (
              <button onClick={() => { setModalReason(''); setActiveModal('review'); }}
                className="btn-primary text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Record Review
              </button>
            )}
            {(isOfficer || isReviewer) && (
              <button onClick={() => { setModalReason(''); setActiveModal('update'); }}
                className="btn-secondary text-xs flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-cyber-amber" /> Report Update
              </button>
            )}
          </div>
        </div>

        {/* Identifiers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 bg-cyber-surface rounded-lg border border-cyber-border space-y-1">
            <span className="text-[11px] font-medium text-cyber-text-muted uppercase tracking-wider">Case ID (keccak256)</span>
            <div className="flex items-center justify-between font-mono text-xs text-cyber-text-primary gap-2">
              <span className="truncate">{caseRec.caseId}</span>
              <button onClick={() => copy(caseRec.caseId, 'caseId')} className="text-cyber-text-muted hover:text-cyber-teal flex-shrink-0">
                {copiedKey === 'caseId' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="p-3.5 bg-cyber-surface rounded-lg border border-cyber-border space-y-1">
            <span className="text-[11px] font-medium text-cyber-text-muted uppercase tracking-wider">Metadata Commitment (SHA-256)</span>
            <div className="flex items-center justify-between font-mono text-xs text-cyber-teal gap-2">
              <span className="truncate">{caseRec.metadataHash}</span>
              <button onClick={() => copy(caseRec.metadataHash, 'hash')} className="text-cyber-text-muted hover:text-cyber-teal flex-shrink-0">
                {copiedKey === 'hash' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Metadata row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2 text-cyber-text-secondary">
            <User className="w-4 h-4 text-cyber-teal" />
            <div>
              <p className="text-[10px] text-cyber-text-muted uppercase">Filed By</p>
              <p className="font-mono text-cyber-text-primary">{caseRec.filedBy.slice(0,6)}...{caseRec.filedBy.slice(-4)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-cyber-text-secondary">
            <Calendar className="w-4 h-4 text-cyber-teal" />
            <div>
              <p className="text-[10px] text-cyber-text-muted uppercase">Filing Date</p>
              <p className="text-cyber-text-primary">{caseRec.filingDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-cyber-text-secondary">
            <Hash className="w-4 h-4 text-cyber-teal" />
            <div>
              <p className="text-[10px] text-cyber-text-muted uppercase">Block Number</p>
              <p className="font-mono text-cyber-text-primary">#{caseRec.blockNumber.toString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-cyber-text-secondary">
            <Calendar className="w-4 h-4 text-cyber-teal" />
            <div>
              <p className="text-[10px] text-cyber-text-muted uppercase">Registered At</p>
              <p className="text-cyber-text-primary">{fmt(caseRec.registeredAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick integrity check */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cyber-teal" />
          <h2 className="text-base font-semibold text-cyber-text-primary">Quick Integrity Check</h2>
        </div>
        <p className="text-xs text-cyber-text-muted">
          Upload the case document to verify its SHA-256 hash matches the registered commitment.
          A match establishes consistency — not factual accuracy.
        </p>
        <label className="flex items-center gap-2 border-2 border-dashed border-cyber-border hover:border-cyber-teal rounded-xl p-4 cursor-pointer bg-cyber-surface transition-colors">
          <FileText className="w-4 h-4 text-cyber-teal" />
          <span className="text-xs text-cyber-text-secondary">
            {isHashing ? 'Computing hash...' : 'Select case document to verify'}
          </span>
          <input type="file" onChange={handleFileForVerify} className="hidden" disabled={isHashing} />
        </label>
        {computedHash && (
          <div className="p-3 bg-cyber-surface rounded border border-cyber-border space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-cyber-text-muted">Computed:</span>
              <span className="text-cyber-text-primary truncate max-w-xs">{computedHash}</span>
            </div>
            {integrityResult === 'match' && (
              <p className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded flex items-center gap-2">
                <Check className="w-4 h-4" /> Hash matches registered commitment.
              </p>
            )}
            {integrityResult === 'mismatch' && (
              <p className="text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Hash does NOT match — document may have been altered.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Related cases */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-cyber-text-primary flex items-center gap-2 pb-2 border-b border-cyber-border">
            <Layers className="w-4 h-4 text-cyber-teal" /> Related Cases ({related.length})
          </h2>
          {related.length === 0
            ? <p className="text-xs text-cyber-text-muted py-2">No related cases declared.</p>
            : related.map(rid => (
              <div key={rid} className="p-3 bg-cyber-surface rounded border border-cyber-border flex items-center justify-between text-xs">
                <span className="font-mono text-cyber-text-secondary truncate">{rid.slice(0,16)}...</span>
                <Link to={`/cases/${encodeURIComponent(rid)}`} className="text-cyber-teal hover:underline">View →</Link>
              </div>
            ))
          }
        </div>
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-cyber-text-primary flex items-center gap-2 pb-2 border-b border-cyber-border">
            <Layers className="w-4 h-4 text-blue-400" /> Linked By ({relatedTo.length})
          </h2>
          {relatedTo.length === 0
            ? <p className="text-xs text-cyber-text-muted py-2">No other cases reference this record.</p>
            : relatedTo.map(rid => (
              <div key={rid} className="p-3 bg-cyber-surface rounded border border-cyber-border flex items-center justify-between text-xs">
                <span className="font-mono text-cyber-text-secondary truncate">{rid.slice(0,16)}...</span>
                <Link to={`/cases/${encodeURIComponent(rid)}`} className="text-cyber-teal hover:underline">View →</Link>
              </div>
            ))
          }
        </div>
      </div>

      {/* Reviews */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-cyber-border">
          <h2 className="text-base font-semibold text-cyber-text-primary flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Case Reviews ({reviews.length})
          </h2>
          {isReviewer && (
            <button onClick={() => { setModalReason(''); setActiveModal('review'); }}
              className="text-xs text-cyber-teal hover:underline flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Review
            </button>
          )}
        </div>
        {reviews.length === 0
          ? <p className="text-xs text-cyber-text-muted py-2">No reviews submitted yet.</p>
          : reviews.map(rev => (
            <div key={rev.id.toString()} className="p-4 bg-cyber-surface rounded-lg border border-cyber-border space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ReviewCategoryBadge category={rev.category} />
                  <span className="text-xs text-cyber-text-muted">Review #{rev.id.toString()}</span>
                </div>
                <span className="text-[11px] font-mono text-cyber-text-muted">
                  {rev.reviewer.slice(0,6)}...{rev.reviewer.slice(-4)} · {fmt(rev.timestamp)}
                </span>
              </div>
              <p className="text-xs text-cyber-text-secondary">{rev.notes}</p>
            </div>
          ))
        }
      </div>

      {/* Updates */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-cyber-border">
          <h2 className="text-base font-semibold text-cyber-text-primary flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-cyber-amber" /> Case Updates ({updates.length})
          </h2>
          {(isOfficer || isReviewer) && (
            <button onClick={() => { setModalReason(''); setActiveModal('update'); }}
              className="text-xs text-cyber-amber hover:underline flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Report Update
            </button>
          )}
        </div>
        {updates.length === 0
          ? <p className="text-xs text-cyber-text-muted py-2">No updates reported.</p>
          : updates.map(upd => (
            <div key={upd.id.toString()}
              className={`p-4 rounded-lg border space-y-2 ${
                upd.acknowledged
                  ? 'bg-cyber-surface/60 border-cyber-border'
                  : 'bg-amber-950/20 border-cyber-amber/40'
              }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={upd.priority} />
                  <span className="text-xs font-semibold text-cyber-text-primary">Update #{upd.id.toString()}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                    upd.acknowledged
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>{upd.acknowledged ? 'ACKNOWLEDGED' : 'PENDING'}</span>
                </div>
                {(isOfficer || isReviewer) && !upd.acknowledged && (
                  <button onClick={() => handleAcknowledge(upd.id)}
                    className="btn-secondary text-[11px] py-1 px-2.5">Acknowledge</button>
                )}
              </div>
              <p className="text-xs text-cyber-text-secondary">{upd.summary}</p>
              <p className="text-[10px] font-mono text-cyber-text-muted">
                Reported by {upd.reporter.slice(0,6)}...{upd.reporter.slice(-4)} · {fmt(upd.timestamp)}
              </p>
            </div>
          ))
        }
      </div>

      {/* ─── Status Modal ─── */}
      <ActionModal isOpen={activeModal === 'status'} onClose={() => setActiveModal(null)}
        title="Update Case Status"
        description="Select the next administrative status. This does not constitute a legal determination.">
        <form onSubmit={handleStatusSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1">New Status:</label>
            <select value={selectedStatus} onChange={e => setSelectedStatus(Number(e.target.value) as CaseStatus)}
              className="input-field text-xs">
              {transitions.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1">Reason / Notes:</label>
            <textarea value={modalReason} onChange={e => setModalReason(e.target.value)}
              required rows={3} placeholder="Provide a reason for this status change..."
              className="input-field text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setActiveModal(null)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Confirm Status Change</button>
          </div>
        </form>
      </ActionModal>

      {/* ─── Metadata Modal ─── */}
      <ActionModal isOpen={activeModal === 'metadata'} onClose={() => { setActiveModal(null); resetHash(); }}
        title="Update Metadata Commitment"
        description="Upload the revised case document to compute a new SHA-256 commitment hash.">
        <form onSubmit={handleMetadataSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1">Upload Updated Document:</label>
            <label className="flex items-center gap-2 border-2 border-dashed border-cyber-border hover:border-cyber-teal rounded-xl p-4 cursor-pointer bg-cyber-surface/50 transition-colors">
              <FileText className="w-4 h-4 text-cyber-teal" />
              <span className="text-xs text-cyber-text-secondary">
                {isHashing ? 'Computing hash...' : computedHash ? `New hash: ${computedHash.slice(0,14)}...` : 'Select document file'}
              </span>
              <input type="file"
                onChange={async e => { const f = e.target.files?.[0]; if (f) await hashFile(f); }}
                className="hidden" disabled={isHashing} />
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1">Reason for Update:</label>
            <textarea value={modalReason} onChange={e => setModalReason(e.target.value)}
              required rows={2} placeholder="Briefly describe what changed in the document..."
              className="input-field text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setActiveModal(null); resetHash(); }} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" disabled={!computedHash} className="btn-primary text-xs">Update Commitment</button>
          </div>
        </form>
      </ActionModal>

      {/* ─── Review Modal ─── */}
      <ActionModal isOpen={activeModal === 'review'} onClose={() => setActiveModal(null)}
        title="Record Case Review"
        description="Submit a formal review event. Keep notes non-sensitive — detailed findings stay off-chain.">
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1">Review Category:</label>
            <select value={reviewCategory} onChange={e => setReviewCategory(Number(e.target.value) as ReviewCategory)}
              className="input-field text-xs">
              <option value={ReviewCategory.IntegrityVerification}>Integrity Verification</option>
              <option value={ReviewCategory.RecordReview}>Record Review</option>
              <option value={ReviewCategory.OfficialApproval}>Official Approval</option>
              <option value={ReviewCategory.RecordDispute}>Record Dispute</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1">Notes:</label>
            <textarea value={modalReason} onChange={e => setModalReason(e.target.value)}
              required rows={3} placeholder="Non-sensitive reviewer notes..."
              className="input-field text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setActiveModal(null)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Submit Review</button>
          </div>
        </form>
      </ActionModal>

      {/* ─── Update Modal ─── */}
      <ActionModal isOpen={activeModal === 'update'} onClose={() => setActiveModal(null)}
        title="Report Case Update"
        description="Log a procedural development or alert. This creates an immutable on-chain record.">
        <form onSubmit={handleUpdateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1">Priority (1–5):</label>
            <select value={updatePriority} onChange={e => setUpdatePriority(Number(e.target.value))}
              className="input-field text-xs">
              <option value={1}>P1 — Informational</option>
              <option value={2}>P2 — Low</option>
              <option value={3}>P3 — Medium</option>
              <option value={4}>P4 — High</option>
              <option value={5}>P5 — Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1">Update Summary:</label>
            <textarea value={modalReason} onChange={e => setModalReason(e.target.value)}
              required rows={3} placeholder="Briefly describe the procedural development..."
              className="input-field text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setActiveModal(null)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Submit Update</button>
          </div>
        </form>
      </ActionModal>

      <TransactionModal state={txState} onClose={() => { resetTxState(); loadData(); }}
        title="Processing Case Transaction" successMessage="Case record updated on-chain." />
    </div>
  );
}
