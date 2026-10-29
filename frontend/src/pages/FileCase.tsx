import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus, Upload, FileText, Layers, AlertTriangle,
  Info, CheckCircle2, Check,
} from 'lucide-react';
import { useContract } from '../hooks/useContract';
import { useWeb3 } from '../contexts/Web3Context';
import { useFileHash } from '../hooks/useFileHash';
import { TransactionModal } from '../components/ui/TransactionModal';
import { CaseStatusBadge } from '../components/ui/CaseStatusBadge';

import type { CaseRecord } from '../types';

const CATEGORIES = [
  'Fraud', 'Theft', 'Assault', 'Cybercrime', 'Drug Offence',
  'Robbery', 'Arson', 'Forgery', 'Vandalism', 'Other',
];

export function FileCase() {
  const navigate = useNavigate();
  const { registerCase, getAllCases, computeCaseId, txState, resetTxState, contract } = useContract();
  const { wallet } = useWeb3();
  const { hash: computedHash, isHashing, fileName, fileSize, hashFile, reset: resetHash } = useFileHash();

  const [caseRef,     setCaseRef]     = useState('');
  const [category,    setCategory]    = useState('Fraud');
  const [filingDate,  setFilingDate]  = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [manualHash,  setManualHash]  = useState('');
  const [selectedRelated, setSelectedRelated] = useState<string[]>([]);
  const [existingCases,   setExistingCases]   = useState<CaseRecord[]>([]);
  const [formError,   setFormError]   = useState<string | null>(null);

  const isOfficer = wallet.roles.includes('officer') || wallet.roles.includes('admin');

  useEffect(() => {
    if (computedHash) setManualHash(computedHash);
  }, [computedHash]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!contract) return;
      try {
        const list = await getAllCases();
        if (mounted) setExistingCases(list);
      } catch (err) { console.error('Failed to load cases:', err); }
    })();
    return () => { mounted = false; };
  }, [contract, getAllCases]);

  const liveId = useMemo(() => {
    if (!caseRef.trim() || !filingDate.trim()) return '';
    try { return computeCaseId(caseRef.trim(), filingDate.trim()); } catch { return ''; }
  }, [caseRef, filingDate, computeCaseId]);

  const toggleRelated = (caseId: string) => {
    setSelectedRelated(prev => {
      if (prev.includes(caseId)) return prev.filter(id => id !== caseId);
      if (prev.length >= 20) { setFormError('Maximum 20 related cases.'); return prev; }
      return [...prev, caseId];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!isOfficer) { setFormError('Connected wallet does not have OFFICER_ROLE.'); return; }
    if (!caseRef.trim())    { setFormError('Case reference is required.'); return; }
    if (!filingDate.trim()) { setFormError('Filing date is required.'); return; }

    let fp = manualHash.trim();
    if (!fp.startsWith('0x')) fp = '0x' + fp;
    if (fp.length !== 66)     { setFormError('Metadata hash must be 0x followed by 64 hex characters.'); return; }

    await registerCase(
      caseRef.trim(), category, filingDate.trim(), fp,
      description.trim(), selectedRelated,
    );
  };

  const handleSuccessClose = () => {
    resetTxState();
    if (liveId) navigate(`/cases/${encodeURIComponent(liveId)}`);
    else        navigate('/cases');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-2 border-b border-cyber-border">
        <h1 className="text-2xl font-bold tracking-tight text-cyber-text-primary">File New Case Record</h1>
        <p className="mt-1 text-sm text-cyber-text-secondary">
          Register a fictional case record with a cryptographic metadata commitment on-chain.
          Use synthetic identifiers only — do not enter real personal data.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
        <span>
          <strong>Academic prototype.</strong> All case references must be fictional.
          Do not store real names, addresses, government IDs, biometrics, or sensitive personal information on-chain.
          Detailed case documents must remain off-chain.
        </span>
      </div>

      {!isOfficer && (
        <div className="card p-4 bg-amber-950/20 border-cyber-amber/40 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-cyber-amber flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-200">Officer Authorization Required</p>
            <p className="text-amber-300/80">
              Only accounts with <code>OFFICER_ROLE</code> can file case records.
              You can explore the form but cannot submit without the required role.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        {formError && (
          <div className="p-3 bg-red-950/20 border border-cyber-red/50 rounded-lg text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-cyber-red" />
            {formError}
          </div>
        )}

        {/* Section 1: Case Identification */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-cyber-teal flex items-center gap-2 uppercase tracking-wider">
            <FileText className="w-4 h-4" /> Case Identification
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-cyber-text-secondary mb-1.5">
                Case Reference <span className="text-cyber-red">*</span>
              </label>
              <input type="text" value={caseRef} onChange={e => setCaseRef(e.target.value)}
                placeholder="e.g. CASE-DEMO-005" required className="input-field text-sm font-mono" />
              <p className="mt-1 text-[11px] text-cyber-text-muted">Fictional reference identifier (e.g. CASE-DEMO-001)</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-cyber-text-secondary mb-1.5">
                Filing Date <span className="text-cyber-red">*</span>
              </label>
              <input type="date" value={filingDate} onChange={e => setFilingDate(e.target.value)}
                required className="input-field text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1.5">
              Case Category <span className="text-cyber-red">*</span>
            </label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="input-field text-sm">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1.5">
              Brief Non-Sensitive Description
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Non-sensitive summary only. No personal data, addresses, or government IDs."
              className="input-field text-xs" />
            <p className="mt-1 text-[11px] text-amber-400/80">
              ⚠ Do not include real names, home addresses, biometrics, or sensitive case details here.
            </p>
          </div>

          {liveId && (
            <div className="p-3 bg-cyber-surface rounded-lg border border-cyber-border space-y-1">
              <span className="text-[11px] text-cyber-text-muted uppercase flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyber-teal" /> Computed Case ID (keccak256 of ref + date)
              </span>
              <p className="font-mono text-xs text-cyber-teal truncate">{liveId}</p>
            </div>
          )}
        </div>

        {/* Section 2: Metadata Commitment */}
        <div className="space-y-4 pt-4 border-t border-cyber-border">
          <h2 className="text-sm font-semibold text-cyber-teal flex items-center gap-2 uppercase tracking-wider">
            <Upload className="w-4 h-4" /> Metadata Commitment (SHA-256)
          </h2>
          <p className="text-xs text-cyber-text-muted">
            Upload the off-chain case document to compute its SHA-256 hash in your browser.
            Only the hash is stored on-chain — the document itself is never uploaded.
          </p>

          <div className="p-5 border-2 border-dashed border-cyber-border hover:border-cyber-teal/60
                          rounded-xl bg-cyber-surface/50 text-center transition-colors">
            <Upload className="w-8 h-8 text-cyber-teal mx-auto mb-2" />
            <p className="text-sm font-medium text-cyber-text-primary">Drop case document to auto-compute hash</p>
            <p className="text-xs text-cyber-text-muted mt-1">Hashed locally via Web Crypto API. File is never transmitted.</p>
            <label className="mt-3 inline-block">
              <span className="btn-secondary text-xs cursor-pointer">
                {isHashing ? 'Computing...' : 'Select Document'}
              </span>
              <input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) hashFile(f); }}
                disabled={isHashing} className="hidden" />
            </label>
            {fileName && (
              <p className="mt-2 text-xs text-emerald-400 flex items-center justify-center gap-1.5 font-mono">
                <CheckCircle2 className="w-4 h-4" /> {fileName} ({((fileSize || 0) / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1.5">
              SHA-256 Hash (0x + 64 hex chars) <span className="text-cyber-red">*</span>
            </label>
            <input type="text" value={manualHash} onChange={e => setManualHash(e.target.value)}
              placeholder="0x..." required className="input-field text-xs font-mono" />
          </div>
        </div>

        {/* Section 3: Related Cases */}
        <div className="space-y-4 pt-4 border-t border-cyber-border">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-cyber-teal flex items-center gap-2 uppercase tracking-wider">
              <Layers className="w-4 h-4" /> Related Cases ({selectedRelated.length}/20)
            </h2>
            {selectedRelated.length > 0 && (
              <button type="button" onClick={() => setSelectedRelated([])}
                className="text-xs text-cyber-text-muted hover:text-cyber-text-primary">Clear all</button>
            )}
          </div>

          {existingCases.length === 0
            ? <p className="text-xs text-cyber-text-muted">No existing cases to link.</p>
            : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {existingCases.map(c => {
                  const sel = selectedRelated.includes(c.caseId);
                  return (
                    <div key={c.caseId} onClick={() => toggleRelated(c.caseId)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        sel
                          ? 'bg-cyber-teal/10 border-cyber-teal shadow-glow-teal'
                          : 'bg-cyber-surface border-cyber-border hover:border-cyber-border-light'
                      }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          sel ? 'bg-cyber-teal border-cyber-teal' : 'border-cyber-border-light'
                        }`}>
                          {sel && <Check className="w-3 h-3 text-cyber-bg" />}
                        </div>
                        <span className="font-mono font-semibold text-cyber-text-primary">{c.caseRef}</span>
                        <span className="text-cyber-text-muted">{c.category}</span>
                        <CaseStatusBadge status={c.status} size="sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-cyber-border flex items-center justify-between">
          <button type="button" onClick={() => {
            setCaseRef(''); setDescription(''); setManualHash('');
            setSelectedRelated([]); resetHash(); setFormError(null);
          }} className="btn-secondary text-xs">Reset</button>
          <button type="submit" disabled={!isOfficer || txState.status === 'pending'}
            className="btn-primary text-xs flex items-center gap-1.5">
            <FilePlus className="w-4 h-4" /> Register Case on Blockchain
          </button>
        </div>
      </form>

      <TransactionModal state={txState} onClose={handleSuccessClose}
        title="Registering Case Record"
        successMessage={`Case "${caseRef}" successfully committed to blockchain.`} />
    </div>
  );
}
