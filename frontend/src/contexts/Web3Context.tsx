import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { BrowserProvider, Contract, formatEther } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, EXPECTED_CHAIN_ID, NETWORK_CONFIG } from '../contracts/config';
import type { WalletState, WalletRole } from '../types';

interface Web3ContextType {
  wallet: WalletState;
  contract: Contract | null;
  provider: BrowserProvider | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: () => Promise<void>;
  isMetaMaskInstalled: boolean;
  connectionError: string | null;
}

const Web3Context = createContext<Web3ContextType | null>(null);

export function useWeb3(): Web3ContextType {
  const context = useContext(Web3Context);
  if (!context) throw new Error('useWeb3 must be used within a Web3Provider');
  return context;
}

const DEFAULT_WALLET: WalletState = {
  address: null,
  isConnected: false,
  chainId: null,
  isCorrectNetwork: false,
  roles: [],
  balance: '0',
};

// Role constants — must match keccak256 values in CaseLedgerRegistry.sol
const OFFICER_ROLE       = '0xbbecb2568601cb27e6ced525237c463da94c4fb7a9b98ac79fd30fd56d8e1b53';
const REVIEWER_ROLE      = '0xc10c77be35aff266144ed64c26a1fa104bae2f284ae99ac4a34203454704a185';
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

export function Web3Provider({ children }: { children: ReactNode }) {
  const [wallet, setWallet]             = useState<WalletState>(DEFAULT_WALLET);
  const [contract, setContract]         = useState<Contract | null>(null);
  const [provider, setProvider]         = useState<BrowserProvider | null>(null);
  const [connectionError, setConnError] = useState<string | null>(null);

  const isMetaMaskInstalled = typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;

  const checkRoles = useCallback(async (
    contractInstance: Contract,
    address: string
  ): Promise<WalletRole[]> => {
    const roles: WalletRole[] = ['public'];
    try {
      if (await contractInstance.hasRole(DEFAULT_ADMIN_ROLE, address)) roles.push('admin');
      if (await contractInstance.hasRole(OFFICER_ROLE, address))        roles.push('officer');
      if (await contractInstance.hasRole(REVIEWER_ROLE, address))       roles.push('reviewer');
    } catch (err) {
      console.warn('Failed to check roles:', err);
    }
    return roles;
  }, []);

  const setupContract = useCallback(async (
    browserProvider: BrowserProvider,
    address: string
  ) => {
    try {
      const signer           = await browserProvider.getSigner();
      const contractInstance = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const code = await browserProvider.getCode(CONTRACT_ADDRESS);
      if (code === '0x') {
        setConnError('Contract not deployed at configured address. Run the deploy script first.');
        setContract(null);
        return;
      }

      const roles   = await checkRoles(contractInstance, address);
      const balance = await browserProvider.getBalance(address);

      setContract(contractInstance);
      setWallet(prev => ({ ...prev, roles, balance: formatEther(balance) }));
      setConnError(null);
    } catch (err) {
      console.error('Contract setup failed:', err);
      setConnError('Failed to connect to contract. Is the local blockchain running?');
    }
  }, [checkRoles]);

  const connectWallet = useCallback(async () => {
    if (!isMetaMaskInstalled) {
      setConnError('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }
    try {
      setConnError(null);
      const ethereum = window.ethereum!;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (accounts.length === 0) {
        setConnError('No accounts found. Please unlock MetaMask.');
        return;
      }

      const browserProvider = new BrowserProvider(ethereum);
      const network         = await browserProvider.getNetwork();
      const chainId         = Number(network.chainId);
      const isCorrectNetwork = chainId === EXPECTED_CHAIN_ID;

      setProvider(browserProvider);
      setWallet({ address: accounts[0], isConnected: true, chainId, isCorrectNetwork, roles: ['public'], balance: '0' });

      if (isCorrectNetwork) {
        await setupContract(browserProvider, accounts[0]);
      } else {
        setConnError(`Wrong network. Please switch to Hardhat Local (Chain ID: ${EXPECTED_CHAIN_ID}).`);
      }
    } catch (err: unknown) {
      const error = err as { code?: number; message?: string };
      if (error.code === 4001) setConnError('Connection rejected by user.');
      else setConnError(error.message || 'Failed to connect wallet.');
    }
  }, [isMetaMaskInstalled, setupContract]);

  const disconnectWallet = useCallback(() => {
    setWallet(DEFAULT_WALLET);
    setContract(null);
    setProvider(null);
    setConnError(null);
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORK_CONFIG.chainId }],
      });
    } catch (switchError: unknown) {
      const error = switchError as { code?: number };
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [NETWORK_CONFIG],
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts: unknown) => {
      const accts = accounts as string[];
      if (accts.length === 0) {
        disconnectWallet();
      } else if (wallet.isConnected) {
        const browserProvider  = new BrowserProvider(window.ethereum!);
        const network          = await browserProvider.getNetwork();
        const chainId          = Number(network.chainId);
        const isCorrectNetwork = chainId === EXPECTED_CHAIN_ID;
        setProvider(browserProvider);
        setWallet(prev => ({ ...prev, address: accts[0], chainId, isCorrectNetwork }));
        if (isCorrectNetwork) await setupContract(browserProvider, accts[0]);
      }
    };

    const handleChainChanged = () => window.location.reload();

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [wallet.isConnected, disconnectWallet, setupContract]);

  return (
    <Web3Context.Provider value={{
      wallet, contract, provider,
      connectWallet, disconnectWallet, switchNetwork,
      isMetaMaskInstalled, connectionError,
    }}>
      {children}
    </Web3Context.Provider>
  );
}
