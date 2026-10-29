import { Loader2, CheckCircle2, AlertTriangle, X, ExternalLink } from 'lucide-react';
import type { TransactionState } from '../../types';

interface TransactionModalProps {
  state: TransactionState;
  onClose: () => void;
  title?: string;
  successMessage?: string;
}

export function TransactionModal({
  state,
  onClose,
  title = 'Transaction in Progress',
  successMessage = 'Transaction confirmed successfully on blockchain.',
}: TransactionModalProps) {
  if (state.status === 'idle') return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md border-cyber-border-light bg-cyber-surface shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-cyber-text-muted hover:text-cyber-text-primary transition-colors"
          disabled={state.status === 'pending'}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center py-4">
          {state.status === 'pending' && (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-cyber-teal/10 border border-cyber-teal/30 flex items-center justify-center mb-4">
                <Loader2 className="w-7 h-7 text-cyber-teal animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-cyber-text-primary">{title}</h3>
              <p className="mt-2 text-sm text-cyber-text-secondary">
                Waiting for blockchain confirmation... Please do not close this window.
              </p>
              {state.hash && (
                <div className="mt-4 p-2.5 bg-cyber-card rounded border border-cyber-border text-xs font-mono text-cyber-teal truncate w-full">
                  Tx: {state.hash}
                </div>
              )}
            </div>
          )}

          {state.status === 'success' && (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-glow-green">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-cyber-text-primary">Transaction Confirmed</h3>
              <p className="mt-2 text-sm text-cyber-text-secondary">{successMessage}</p>
              {state.hash && (
                <div className="mt-4 p-2.5 bg-cyber-card rounded border border-cyber-border text-xs font-mono text-cyber-teal truncate w-full flex items-center justify-center gap-1.5">
                  <span>Tx: {state.hash.slice(0, 14)}...{state.hash.slice(-8)}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              )}
              <button onClick={onClose} className="mt-6 btn-primary w-full">
                Dismiss
              </button>
            </div>
          )}

          {state.status === 'error' && (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 shadow-glow-red">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-cyber-text-primary">Transaction Failed</h3>
              <p className="mt-2 text-sm text-red-300 break-words px-2 bg-red-950/20 border border-red-500/20 rounded py-2 w-full">
                {state.error || 'An unexpected error occurred while executing the transaction.'}
              </p>
              <button onClick={onClose} className="mt-6 btn-secondary w-full">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
