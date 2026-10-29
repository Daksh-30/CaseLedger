import { useState, useCallback } from 'react';
import {
  UserCheck, UserX, Key, AlertTriangle,
  Copy, Check, Search, Server,
} from 'lucide-react';
import { useContract } from '../hooks/useContract';
import { useWeb3 } from '../contexts/Web3Context';
import { CONTRACT_ADDRESS, EXPECTED_CHAIN_ID, EXPECTED_NETWORK_NAME } from '../contracts/config';
import { TransactionModal } from '../components/ui/TransactionModal';

// Role hashes — must match keccak256 values in CaseLedgerRegistry.sol
const OFFICER_ROLE       = '0xbbecb2568601cb27e6ced525237c463da94c4fb7a9b98ac79fd30fd56d8e1b53';
const REVIEWER_ROLE      = '0xc10c77be35aff266144ed64c26a1fa104bae2f284ae99ac4a34203454704a185';
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

export function AdminPanel() {
  const {
    grantOfficerRole, revokeOfficerRole,
    grantReviewerRole, revokeReviewerRole,
    txState, resetTxState, contract,
  } = useContract();
  const { wallet } = useWeb3();

  const [targetAddress, setTargetAddress] = useState('');
  const [selectedRole,  setSelectedRole]  = useState<'officer' | 'reviewer'>('officer');
  const [copiedAddr,    setCopiedAddr]    = useState(false);

  const [inspectAddress, setInspectAddress] = useState('');
  const [inspectResults, setInspectResults] = useState<{
    isAdmin: boolean; isOfficer: boolean; isReviewer: boolean; checked: boolean;
  } | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  const isAdmin = wallet.roles.includes('admin');

  const handleGrant = async () => {
    if (!targetAddress.trim()) return;
    if (selectedRole === 'officer') await grantOfficerRole(targetAddress.trim());
    else                             await grantReviewerRole(targetAddress.trim());
  };

  const handleRevoke = async () => {
    if (!targetAddress.trim()) return;
    if (selectedRole === 'officer') await revokeOfficerRole(targetAddress.trim());
    else                             await revokeReviewerRole(targetAddress.trim());
  };

  const checkRoles = useCallback(async () => {
    if (!contract || !inspectAddress.trim()) return;
    setIsInspecting(true);
    try {
      const addr = inspectAddress.trim();
      const [adm, off, rev] = await Promise.all([
        contract.hasRole(DEFAULT_ADMIN_ROLE, addr),
        contract.hasRole(OFFICER_ROLE,  addr),
        contract.hasRole(REVIEWER_ROLE, addr),
      ]);
      setInspectResults({ isAdmin: adm, isOfficer: off, isReviewer: rev, checked: true });
    } catch (err) { console.error(err); }
    finally { setIsInspecting(false); }
  }, [contract, inspectAddress]);

  const copyAddr = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-2 border-b border-cyber-border">
        <h1 className="text-2xl font-bold tracking-tight text-cyber-text-primary">Access Management</h1>
        <p className="mt-1 text-sm text-cyber-text-secondary">
          On-chain role administration for CaseLedger. All role changes are immutably recorded.
        </p>
      </div>

      {!isAdmin && (
        <div className="card p-4 bg-amber-950/20 border-cyber-amber/40 shadow-glow-amber flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-cyber-amber flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-200">Administrator Privileges Required</p>
            <p className="text-amber-300/80">
              Wallet <code className="font-mono">{wallet.address || 'not connected'}</code> does not
              hold <code>DEFAULT_ADMIN_ROLE</code>. Role changes require admin rights.
            </p>
          </div>
        </div>
      )}

      {/* Role Management */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-cyber-border">
          <Key className="w-5 h-5 text-cyber-teal" />
          <h2 className="text-base font-semibold text-cyber-text-primary">Grant / Revoke Role</h2>
        </div>

        <p className="text-xs text-cyber-text-secondary">
          Assign or remove on-chain permissions. Each change generates a blockchain transaction and
          emits a <code>RoleGranted_CL</code> or <code>RoleRevoked_CL</code> event.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1.5">
              Target Wallet Address:
            </label>
            <input type="text" value={targetAddress} onChange={e => setTargetAddress(e.target.value)}
              placeholder="0x..." className="input-field text-xs font-mono" />
          </div>

          <div>
            <label className="block text-xs font-medium text-cyber-text-secondary mb-1.5">Select Role:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Officer card */}
              <div onClick={() => setSelectedRole('officer')}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex flex-col gap-2 ${
                  selectedRole === 'officer'
                    ? 'bg-blue-500/10 border-blue-400 text-blue-300'
                    : 'bg-cyber-surface border-cyber-border text-cyber-text-secondary hover:border-cyber-border-light'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono">OFFICER_ROLE</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Case Officer</span>
                </div>
                <p className="text-[11px] text-cyber-text-muted">
                  File new case records, update metadata, advance case status.
                </p>
              </div>
              {/* Reviewer card */}
              <div onClick={() => setSelectedRole('reviewer')}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex flex-col gap-2 ${
                  selectedRole === 'reviewer'
                    ? 'bg-purple-500/10 border-purple-400 text-purple-300'
                    : 'bg-cyber-surface border-cyber-border text-cyber-text-secondary hover:border-cyber-border-light'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono">REVIEWER_ROLE</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">Reviewer</span>
                </div>
                <p className="text-[11px] text-cyber-text-muted">
                  Submit reviews, report and acknowledge case updates, advance status.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button onClick={handleRevoke}
              disabled={!isAdmin || !targetAddress.trim() || txState.status === 'pending'}
              className="btn-danger text-xs flex items-center gap-1.5">
              <UserX className="w-3.5 h-3.5" /> Revoke Role
            </button>
            <button onClick={handleGrant}
              disabled={!isAdmin || !targetAddress.trim() || txState.status === 'pending'}
              className="btn-primary text-xs flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" /> Grant Role
            </button>
          </div>
        </div>
      </div>

      {/* Role Inspector */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-cyber-border">
          <Search className="w-5 h-5 text-cyber-teal" />
          <h2 className="text-base font-semibold text-cyber-text-primary">Query Wallet Roles</h2>
        </div>
        <p className="text-xs text-cyber-text-secondary">
          Check the current on-chain role assignments for any wallet address.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="text" value={inspectAddress} onChange={e => setInspectAddress(e.target.value)}
            placeholder="0x..." className="input-field text-xs font-mono flex-1" />
          <button onClick={checkRoles} disabled={isInspecting || !inspectAddress.trim()}
            className="btn-secondary text-xs">Query Roles</button>
        </div>

        {inspectResults?.checked && (
          <div className="p-4 bg-cyber-surface rounded-lg border border-cyber-border space-y-2 text-xs">
            <p className="font-mono text-cyber-text-muted text-[11px]">Results for: {inspectAddress}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {[
                { label: 'ADMIN',    active: inspectResults.isAdmin,    cls: 'bg-purple-500/10 border-purple-500/30 text-purple-300' },
                { label: 'OFFICER',  active: inspectResults.isOfficer,  cls: 'bg-blue-500/10   border-blue-500/30   text-blue-300'   },
                { label: 'REVIEWER', active: inspectResults.isReviewer, cls: 'bg-cyan-500/10   border-cyan-500/30   text-cyan-300'   },
              ].map(({ label, active, cls }) => (
                <div key={label} className={`p-2.5 rounded border flex items-center justify-between ${
                  active ? cls : 'bg-cyber-card border-cyber-border text-cyber-text-muted'
                }`}>
                  <span>{label}</span>
                  <span className="font-bold">{active ? 'GRANTED' : 'NO'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contract Info */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-cyber-border">
          <Server className="w-5 h-5 text-cyber-teal" />
          <h2 className="text-base font-semibold text-cyber-text-primary">Deployment Parameters</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-cyber-surface rounded border border-cyber-border space-y-1">
            <span className="text-[10px] text-cyber-text-muted uppercase">Contract Address</span>
            <div className="flex items-center justify-between text-cyber-teal">
              <span className="truncate">{CONTRACT_ADDRESS}</span>
              <button onClick={copyAddr} className="text-cyber-text-muted hover:text-cyber-text-primary ml-2">
                {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="p-3 bg-cyber-surface rounded border border-cyber-border space-y-1">
            <span className="text-[10px] text-cyber-text-muted uppercase">Network / Chain ID</span>
            <p className="text-cyber-text-primary">{EXPECTED_NETWORK_NAME} (Chain ID: {EXPECTED_CHAIN_ID})</p>
          </div>
        </div>
        <div className="p-3 bg-amber-950/10 border border-amber-500/20 rounded text-xs text-amber-300/80">
          <strong>Academic prototype.</strong> This system is not suitable for real criminal data.
          All case records must use fictional identifiers only.
        </div>
      </div>

      <TransactionModal state={txState} onClose={resetTxState}
        title="Processing Role Operation" successMessage="Role change confirmed on-chain." />
    </div>
  );
}
