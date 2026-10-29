import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck, Upload, CheckCircle2,
  XCircle, HelpCircle, ArrowRight, RefreshCw,
} from 'lucide-react';
import { useContract } from '../hooks/useContract';
import { useFileHash } from '../hooks/useFileHash';
import { CaseStatusBadge } from '../components/ui/CaseStatusBadge';
import type { CaseRecord } from '../types';

export function VerifyRecord() {
  const [searchParams] = useSearchParams();
  const initialHash    = searchParams.get('hash') || '';

  const { getAllCases, getCase, computeCaseId, contract } = useContract();
  const { hash: computedHash, fileName, fileSize, isHashing, hashFile, reset: resetHash } = useFileHash();

  const [inputHash,     setInputHash]     = useState(initialHash);
  const [targetRef,     setTargetRef]     = useState('');
  const [targetDate,    setTargetDate]    = useState('');
  const [allCases,      setAllCases]      = useState<CaseRecord[]>([]);
  const [isVerifying,   setIsVerifying]   = useState(false);
  const [hasSearched,   setHasSearched]   = useState(false);
  const [matchedCase,   setMatchedCase]   = useState<CaseRecord | null>(null);
  const [expectedCase,  setExpectedCase]  = useState<CaseRecord | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!contract) return;
      try {
        const list = await getAllCases();
        if (mounted) setAllCases(list);
      } catch (err) { console.error('Failed to load cases:', err); }
    })();
    return () => { mounted = false; };
  }, [contract, getAllCases]);

  const verifyHash = useCallback(async (hash: string, ref: string, date: string) => {
    setIsVerifying(true);
    setHasSearched(true);
    setMatchedCase(null);
    setExpectedCase(null);

    const norm = hash.trim().toLowerCase();

    if (ref.trim() && date.trim()) {
      const id       = computeCaseId(ref.trim(), date.trim());
      const expected = await getCase(id);
      setExpectedCase(expected);
      if (expected && expected.metadataHash.toLowerCase() === norm) {
        setMatchedCase(expected);
        setIsVerifying(false);
        return;
      }
    }

    const match = allCases.find(c => c.metadataHash.toLowerCase() === norm);
    setMatchedCase(match || null);
    setIsVerifying(false);
  }, [allCases, computeCaseId, getCase]);

  // Auto-verify if hash supplied via URL
  useEffect(() => {
    if (initialHash && allCases.length > 0 && !hasSearched) {
      setInputHash(initialHash);
      verifyHash(initialHash, '', '');
    }
  }, [initialHash, allCases, hasSearched, verifyHash]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const h = await hashFile(file);
    if (h) { setInputHash(h); verifyHash(h, targetRef, targetDate); }
  };

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputHash.trim() && (!targetRef.trim() || !targetDate.trim())) return;
    verifyHash(inputHash, targetRef, targetDate);
  };

  const handleReset = () => {
    resetHash();
    setInputHash('');
    setTargetRef('');
    setTargetDate('');
    setMatchedCase(null);
    setExpectedCase(null);
    setHasSearched(false);
  };

  const activeHash = computedHash || inputHash;
  const hasMismatch =
    !!expectedCase && !!inputHash &&
    expectedCase.metadataHash.toLowerCase() !== inputHash.trim().toLowerCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-2 border-b border-cyber-border">
        <h1 className="text-2xl font-bold tracking-tight text-cyber-text-primary">Verify Record Integrity</h1>
        <p className="mt-1 text-sm text-cyber-text-secondary">
          Cryptographically compare a case document against its registered on-chain commitment.
        </p>
      </div>

      {/* Explainer */}
      <div className="card p-4 text-xs text-cyber-text-secondary space-y-1 border-cyber-border">
        <p>
          <strong className="text-cyber-text-primary">What verification establishes:</strong>{' '}
          A matching hash proves the document is consistent with what was registered on-chain.
        </p>
        <p>
          <strong className="text-cyber-text-primary">What it does not establish:</strong>{' '}
          Verification does not confirm the factual accuracy of the document's contents, nor does it
          constitute a legal finding of any kind.
        </p>
      </div>

      {/* Input panel */}
      <div className="card p-6 space-y-6">
        {/* File upload */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-cyber-teal uppercase tracking-wider">
            Option 1 — Upload Case Document
          </label>
          <div className="p-6 border-2 border-dashed border-cyber-border hover:border-cyber-teal/70
                          rounded-xl bg-cyber-surface/60 text-center transition-colors">
            <Upload className="w-9 h-9 text-cyber-teal mx-auto mb-2" />
            <p className="text-sm font-medium text-cyber-text-primary">
              Drop document to compute SHA-256 automatically
            </p>
            <p className="text-xs text-cyber-text-muted mt-1">
              File is processed locally in your browser — nothing is uploaded.
            </p>
            <label className="mt-4 inline-block">
              <span className="btn-secondary text-xs cursor-pointer">
                {isHashing ? 'Computing...' : 'Select File'}
              </span>
              <input type="file" onChange={handleFileUpload} disabled={isHashing} className="hidden" />
            </label>
            {fileName && (
              <p className="mt-3 text-xs text-emerald-400 flex items-center justify-center gap-1.5 font-mono">
                <CheckCircle2 className="w-4 h-4" />
                {fileName} ({((fileSize || 0) / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </div>

        {/* Manual input */}
        <form onSubmit={handleManualVerify} className="space-y-4 pt-4 border-t border-cyber-border">
          <label className="block text-xs font-semibold text-cyber-teal uppercase tracking-wider">
            Option 2 — Enter Hash or Case Reference
          </label>

          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1">
              SHA-256 Metadata Hash:
            </label>
            <input type="text" value={inputHash} onChange={e => setInputHash(e.target.value)}
              placeholder="0x..." className="input-field text-xs font-mono" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-cyber-text-secondary mb-1">
                Case Reference (optional):
              </label>
              <input type="text" value={targetRef} onChange={e => setTargetRef(e.target.value)}
                placeholder="e.g. CASE-DEMO-001" className="input-field text-xs font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-cyber-text-secondary mb-1">
                Filing Date (optional):
              </label>
              <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
                className="input-field text-xs" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={handleReset}
              className="text-xs text-cyber-text-muted hover:text-cyber-text-primary">Reset</button>
            <button type="submit"
              disabled={isVerifying || (!inputHash.trim() && (!targetRef.trim() || !targetDate.trim()))}
              className="btn-primary text-xs flex items-center gap-1.5">
              {isVerifying
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...</>
                : <><ShieldCheck className="w-4 h-4" /> Verify Against Ledger</>
              }
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-cyber-text-primary">Verification Result</h2>

          {/* TAMPER / MISMATCH */}
          {hasMismatch && (
            <div className="card p-6 bg-red-950/30 border-cyber-red shadow-glow-red space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-cyber-red/20 text-cyber-red flex-shrink-0">
                  <XCircle className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-200">INTEGRITY FAILURE — HASH MISMATCH</h3>
                  <p className="text-xs text-red-300 mt-1">
                    The provided hash does NOT match the registered commitment for{' '}
                    <strong>{expectedCase!.caseRef}</strong> (filed {expectedCase!.filingDate}).
                    The document may have been altered since registration.
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-xs font-mono pt-2 border-t border-cyber-red/30">
                <div className="p-3 rounded bg-cyber-surface border border-cyber-red/40">
                  <span className="text-[10px] text-cyber-text-muted block uppercase">Provided Hash:</span>
                  <span className="text-red-400 break-all">{inputHash}</span>
                </div>
                <div className="p-3 rounded bg-cyber-surface border border-emerald-500/40">
                  <span className="text-[10px] text-cyber-text-muted block uppercase">Registered Commitment:</span>
                  <span className="text-emerald-400 break-all">{expectedCase!.metadataHash}</span>
                </div>
              </div>
              <div className="flex justify-end">
                <Link to={`/cases/${encodeURIComponent(expectedCase!.caseId)}`} className="btn-danger text-xs">
                  View Official Case Record →
                </Link>
              </div>
            </div>
          )}

          {/* MATCH */}
          {matchedCase && !hasMismatch && (
            <div className="card p-6 bg-emerald-950/20 border-emerald-500/40 shadow-glow-green space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 flex-shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-emerald-300">RECORD CONSISTENT WITH LEDGER</h3>
                    <CaseStatusBadge status={matchedCase.status} size="sm" />
                  </div>
                  <p className="text-xs text-emerald-200 mt-1">
                    The document matches the registered commitment for{' '}
                    <strong className="text-white">{matchedCase.caseRef}</strong> ({matchedCase.category},
                    filed {matchedCase.filingDate}).
                    This establishes consistency — not factual accuracy of the document's contents.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-emerald-500/20 text-xs">
                <div className="p-3 bg-cyber-surface rounded border border-cyber-border">
                  <span className="text-[10px] text-cyber-text-muted block uppercase">Case Reference</span>
                  <span className="font-mono font-semibold text-cyber-text-primary">{matchedCase.caseRef}</span>
                </div>
                <div className="p-3 bg-cyber-surface rounded border border-cyber-border">
                  <span className="text-[10px] text-cyber-text-muted block uppercase">Filing Date</span>
                  <span className="text-cyber-text-primary">{matchedCase.filingDate}</span>
                </div>
                <div className="p-3 bg-cyber-surface rounded border border-cyber-border col-span-2">
                  <span className="text-[10px] text-cyber-text-muted block uppercase">Registered Hash</span>
                  <span className="font-mono text-emerald-400 break-all text-xs">{matchedCase.metadataHash}</span>
                </div>
              </div>
              <div className="flex justify-end">
                <Link to={`/cases/${encodeURIComponent(matchedCase.caseId)}`}
                  className="btn-primary text-xs flex items-center gap-1.5">
                  Inspect Full Case Record <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* NOT FOUND */}
          {!matchedCase && !hasMismatch && (
            <div className="card p-8 text-center space-y-3">
              <HelpCircle className="w-10 h-10 text-cyber-text-muted mx-auto" />
              <h3 className="text-base font-bold text-cyber-text-primary">No Matching Record Found</h3>
              <p className="text-xs text-cyber-text-secondary max-w-md mx-auto">
                No registered case matches the provided hash or reference.
                The document may not have been registered, or the wrong hash was supplied.
              </p>
              {activeHash && (
                <p className="font-mono text-xs text-cyber-teal bg-cyber-card p-2 rounded border border-cyber-border break-all max-w-lg mx-auto">
                  {activeHash}
                </p>
              )}
              <div className="pt-2">
                <Link to="/file" className="btn-secondary text-xs inline-flex items-center gap-1.5">
                  File this as a new case record →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
