import { useWeb3 } from '../../contexts/Web3Context';
import { Wallet, AlertTriangle, CheckCircle, LogOut, RefreshCw } from 'lucide-react';

export function Header() {
  const { wallet, connectWallet, disconnectWallet, switchNetwork, isMetaMaskInstalled, connectionError } = useWeb3();

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
      officer:  'bg-blue-500/10   text-blue-400   border-blue-500/20',
      reviewer: 'bg-cyan-500/10   text-cyan-400   border-cyan-500/20',
      public:   'bg-gray-500/10   text-gray-400   border-gray-500/20',
    };
    return (
      <span key={role} className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${colors[role] || colors.public}`}>
        {role.toUpperCase()}
      </span>
    );
  };

  return (
    <header className="h-16 border-b border-cyber-border bg-cyber-surface/80 backdrop-blur-sm
                       flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {connectionError && (
          <div className="flex items-center gap-2 text-cyber-amber text-sm
                          bg-cyber-amber/10 border border-cyber-amber/20 px-3 py-1.5 rounded-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate max-w-md">{connectionError}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {wallet.isConnected ? (
          <>
            {wallet.isCorrectNetwork ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400
                              bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Hardhat Local</span>
              </div>
            ) : (
              <button
                onClick={switchNetwork}
                className="flex items-center gap-1.5 text-xs text-cyber-amber
                           bg-cyber-amber/10 border border-cyber-amber/20 px-2.5 py-1 rounded-md
                           hover:bg-cyber-amber/20 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Wrong Network</span>
                <RefreshCw className="w-3 h-3 animate-spin" />
              </button>
            )}

            {wallet.balance && (
              <div className="text-xs font-mono text-cyber-text-secondary px-2 py-1
                              bg-cyber-surface border border-cyber-border rounded">
                {parseFloat(wallet.balance).toFixed(3)} ETH
              </div>
            )}

            <div className="flex items-center gap-1">
              {wallet.roles.filter(r => r !== 'public').map(getRoleBadge)}
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-cyber-card rounded-lg border border-cyber-border">
              <Wallet className="w-4 h-4 text-cyber-teal" />
              <span className="text-sm font-mono text-cyber-text-primary">
                {shortenAddress(wallet.address!)}
              </span>
            </div>

            <button
              onClick={disconnectWallet}
              className="p-2 text-cyber-text-muted hover:text-cyber-red transition-colors
                         rounded-lg hover:bg-cyber-card"
              title="Disconnect wallet"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={connectWallet}
            disabled={!isMetaMaskInstalled}
            className="btn-primary flex items-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            {isMetaMaskInstalled ? 'Connect Wallet' : 'Install MetaMask'}
          </button>
        )}
      </div>
    </header>
  );
}
