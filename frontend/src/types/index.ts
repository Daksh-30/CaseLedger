// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * Administrative case-progress statuses.
 * These represent procedural stages ONLY — not a determination of guilt.
 */
export enum CaseStatus {
  Registered         = 0,
  UnderInvestigation = 1,
  ChargesFiled       = 2,
  InCourt            = 3,
  Closed             = 4,
  Archived           = 5,
}

/**
 * Category of a case review action submitted by an authorized reviewer.
 */
export enum ReviewCategory {
  IntegrityVerification = 0,
  RecordReview          = 1,
  OfficialApproval      = 2,
  RecordDispute         = 3,
}

// ─── Core Domain Types ────────────────────────────────────────────────────────

/**
 * On-chain case record (no personally identifiable information).
 */
export interface CaseRecord {
  caseId:       string;   // bytes32 — keccak256(caseRef + "@" + filingDate)
  caseRef:      string;   // e.g. "CASE-DEMO-001"
  category:     string;   // e.g. "Fraud"
  filingDate:   string;   // ISO date, e.g. "2026-01-15"
  metadataHash: string;   // bytes32 — SHA-256 commitment of off-chain document
  filedBy:      string;   // officer wallet address
  registeredAt: bigint;   // block.timestamp
  blockNumber:  bigint;   // block.number
  status:       CaseStatus;
  relatedCases: string[]; // bytes32[] related case IDs
  description:  string;   // brief non-sensitive summary
}

/**
 * A review event recorded by an authorized reviewer.
 */
export interface CaseReview {
  id:        bigint;
  caseId:    string;
  reviewer:  string;
  category:  ReviewCategory;
  notes:     string;
  timestamp: bigint;
}

/**
 * A procedural update or alert linked to a case.
 */
export interface CaseUpdate {
  id:           bigint;
  caseId:       string;
  reporter:     string;
  summary:      string;
  priority:     number;  // 1–5
  timestamp:    bigint;
  acknowledged: boolean;
}

// ─── Verification ─────────────────────────────────────────────────────────────

export interface VerificationResult {
  status:         'match' | 'mismatch' | 'unknown' | 'invalid';
  computedHash:   string;
  registeredHash: string;
  caseId:         string;
  caseRef:        string;
  caseStatus:     CaseStatus;
  message:        string;
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────

export interface AuditEvent {
  type:            string;
  caseId:          string;
  actor:           string;
  blockNumber:     number;
  transactionHash: string;
  timestamp?:      number;
  details:         string;
}

// ─── Wallet / Web3 ────────────────────────────────────────────────────────────

export type WalletRole = 'admin' | 'officer' | 'reviewer' | 'public';

export interface WalletState {
  address:          string | null;
  isConnected:      boolean;
  chainId:          number | null;
  isCorrectNetwork: boolean;
  roles:            WalletRole[];
  balance:          string;
}

export interface TransactionState {
  status: 'idle' | 'pending' | 'success' | 'error';
  hash?:  string;
  error?: string;
}
