// Contract configuration — updated automatically by the deploy script.
// If the contract is redeployed, run: npm run deploy
// This will overwrite CaseLedgerRegistry.json with the new address and ABI.

import contractData from './CaseLedgerRegistry.json';

export const CONTRACT_ADDRESS: string = contractData.address;
export const CONTRACT_ABI = contractData.abi;

// Hardhat local network
export const EXPECTED_CHAIN_ID = 31337;
export const EXPECTED_NETWORK_NAME = 'Hardhat Local';

export const NETWORK_CONFIG = {
  chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}`,
  chainName: 'Hardhat Local',
  rpcUrls: ['http://127.0.0.1:8545'],
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
};
