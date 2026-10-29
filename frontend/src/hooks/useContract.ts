import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import type {
  CaseRecord, CaseReview, CaseUpdate,
  CaseStatus, ReviewCategory,
  TransactionState, AuditEvent,
} from '../types';

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseCaseRecord(data: ethers.Result): CaseRecord {
  return {
    caseId:       data.caseId,
    caseRef:      data.caseRef,
    category:     data.category,
    filingDate:   data.filingDate,
    metadataHash: data.metadataHash,
    filedBy:      data.filedBy,
    registeredAt: data.registeredAt,
    blockNumber:  data.blockNumber,
    status:       Number(data.status) as CaseStatus,
    relatedCases: [...data.relatedCases],
    description:  data.description,
  };
}

function parseCaseReview(data: ethers.Result): CaseReview {
  return {
    id:        data.id,
    caseId:    data.caseId,
    reviewer:  data.reviewer,
    category:  Number(data.category) as ReviewCategory,
    notes:     data.notes,
    timestamp: data.timestamp,
  };
}

function parseCaseUpdate(data: ethers.Result): CaseUpdate {
  return {
    id:           data.id,
    caseId:       data.caseId,
    reporter:     data.reporter,
    summary:      data.summary,
    priority:     Number(data.priority),
    timestamp:    data.timestamp,
    acknowledged: data.acknowledged,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useContract() {
  const { contract } = useWeb3();
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });

  const resetTxState = useCallback(() => setTxState({ status: 'idle' }), []);

  // ── ID computation ──────────────────────────────────────────────────────────
  /**
   * Computes the deterministic case ID client-side.
   * Must match: keccak256(abi.encodePacked(caseRef, "@", filingDate))
   */
  const computeCaseId = useCallback((caseRef: string, filingDate: string): string => {
    return ethers.keccak256(ethers.toUtf8Bytes(`${caseRef}@${filingDate}`));
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const handleTx = async (fn: () => Promise<ethers.ContractTransactionResponse>): Promise<boolean> => {
    try {
      setTxState({ status: 'pending' });
      const tx = await fn();
      setTxState({ status: 'pending', hash: tx.hash });
      await tx.wait();
      setTxState({ status: 'success', hash: tx.hash });
      return true;
    } catch (err: unknown) {
      const error = err as { code?: string; reason?: string; message?: string };
      const msg = error.code === 'ACTION_REJECTED'
        ? 'Transaction rejected by user'
        : (error.reason || error.message || 'Transaction failed');
      setTxState({ status: 'error', error: msg });
      return false;
    }
  };

  // ── Registration ────────────────────────────────────────────────────────────
  const registerCase = useCallback(async (
    caseRef: string,
    category: string,
    filingDate: string,
    metadataHash: string,
    description: string,
    relatedCases: string[],
  ): Promise<boolean> => {
    if (!contract) return false;
    return handleTx(() =>
      contract.registerCase(caseRef, category, filingDate, metadataHash, description, relatedCases)
    );
  }, [contract]);

  // ── Retrieval ───────────────────────────────────────────────────────────────
  const getCase = useCallback(async (caseId: string): Promise<CaseRecord | null> => {
    if (!contract) return null;
    try {
      const data = await contract.getCase(caseId);
      return parseCaseRecord(data);
    } catch { return null; }
  }, [contract]);

  const getAllCases = useCallback(async (): Promise<CaseRecord[]> => {
    if (!contract) return [];
    try {
      const ids: string[] = await contract.getAllCaseIds();
      return Promise.all(ids.map(async (id) => parseCaseRecord(await contract.getCase(id))));
    } catch (err) {
      console.error('Failed to fetch cases:', err);
      return [];
    }
  }, [contract]);

  const getCaseCount = useCallback(async (): Promise<number> => {
    if (!contract) return 0;
    try { return Number(await contract.getCaseCount()); } catch { return 0; }
  }, [contract]);

  const getRelatedCases = useCallback(async (caseId: string): Promise<string[]> => {
    if (!contract) return [];
    try { return [...await contract.getRelatedCases(caseId)]; } catch { return []; }
  }, [contract]);

  const getCasesRelatedTo = useCallback(async (caseId: string): Promise<string[]> => {
    if (!contract) return [];
    try { return [...await contract.getCasesRelatedTo(caseId)]; } catch { return []; }
  }, [contract]);

  const getCaseStatus = useCallback(async (caseId: string): Promise<CaseStatus | null> => {
    if (!contract) return null;
    try { return Number(await contract.getCaseStatus(caseId)) as CaseStatus; } catch { return null; }
  }, [contract]);

  // ── Metadata Update ─────────────────────────────────────────────────────────
  const updateCaseMetadata = useCallback(async (
    caseId: string,
    newMetadataHash: string,
    reason: string,
  ): Promise<boolean> => {
    if (!contract) return false;
    return handleTx(() => contract.updateCaseMetadata(caseId, newMetadataHash, reason));
  }, [contract]);

  // ── Status ──────────────────────────────────────────────────────────────────
  const updateCaseStatus = useCallback(async (
    caseId: string,
    newStatus: CaseStatus,
    reason: string,
  ): Promise<boolean> => {
    if (!contract) return false;
    return handleTx(() => contract.updateCaseStatus(caseId, newStatus, reason));
  }, [contract]);

  // ── Reviews ─────────────────────────────────────────────────────────────────
  const recordCaseReview = useCallback(async (
    caseId: string,
    category: ReviewCategory,
    notes: string,
  ): Promise<boolean> => {
    if (!contract) return false;
    return handleTx(() => contract.recordCaseReview(caseId, category, notes));
  }, [contract]);

  const getCaseReviews = useCallback(async (caseId: string): Promise<CaseReview[]> => {
    if (!contract) return [];
    try {
      const data = await contract.getCaseReviews(caseId);
      return data.map(parseCaseReview);
    } catch { return []; }
  }, [contract]);

  // ── Case Updates ────────────────────────────────────────────────────────────
  const reportCaseUpdate = useCallback(async (
    caseId: string,
    summary: string,
    priority: number,
  ): Promise<boolean> => {
    if (!contract) return false;
    return handleTx(() => contract.reportCaseUpdate(caseId, summary, priority));
  }, [contract]);

  const acknowledgeCaseUpdate = useCallback(async (
    updateId: number,
    caseId: string,
  ): Promise<boolean> => {
    if (!contract) return false;
    return handleTx(() => contract.acknowledgeCaseUpdate(updateId, caseId));
  }, [contract]);

  const getCaseUpdates = useCallback(async (caseId: string): Promise<CaseUpdate[]> => {
    if (!contract) return [];
    try {
      const data = await contract.getCaseUpdates(caseId);
      return data.map(parseCaseUpdate);
    } catch { return []; }
  }, [contract]);

  // ── Role Management ─────────────────────────────────────────────────────────
  const grantOfficerRole = useCallback(async (address: string): Promise<boolean> => {
    if (!contract) return false;
    return handleTx(() => contract.grantOfficerRole(address));
  }, [contract]);

  const revokeOfficerRole = useCallback(async (address: string): Promise<boolean> => {
    if (!contract) return false;
    return handleTx(() => contract.revokeOfficerRole(address));
  }, [contract]);

  const grantReviewerRole = useCallback(async (address: string): Promise<boolean> => {
    if (!contract) return false;
    return handleTx(() => contract.grantReviewerRole(address));
  }, [contract]);

  const revokeReviewerRole = useCallback(async (address: string): Promise<boolean> => {
    if (!contract) return false;
    return handleTx(() => contract.revokeReviewerRole(address));
  }, [contract]);

  // ── Audit Events ────────────────────────────────────────────────────────────
  const getAuditEvents = useCallback(async (): Promise<AuditEvent[]> => {
    if (!contract) return [];
    try {
      const events: AuditEvent[] = [];

      const [registered, metaUpdated, statusChanged, reviewed, updated, acknowledged] =
        await Promise.all([
          contract.queryFilter(contract.filters.CaseRegistered()).catch(() => []),
          contract.queryFilter(contract.filters.CaseMetadataUpdated()).catch(() => []),
          contract.queryFilter(contract.filters.CaseStatusChanged()).catch(() => []),
          contract.queryFilter(contract.filters.CaseReviewRecorded()).catch(() => []),
          contract.queryFilter(contract.filters.CaseUpdateReported()).catch(() => []),
          contract.queryFilter(contract.filters.CaseUpdateAcknowledged()).catch(() => []),
        ]);

      const statusLabels = ['Registered', 'Under Investigation', 'Charges Filed', 'In Court', 'Closed', 'Archived'];
      const reviewLabels = ['Integrity Verification', 'Record Review', 'Official Approval', 'Record Dispute'];

      for (const e of registered) {
        const log = e as ethers.EventLog;
        events.push({
          type: 'Case Registered',
          caseId: log.args[0],
          actor: log.args[4],
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          details: `${log.args[1]} — ${log.args[2]}`,
        });
      }

      for (const e of metaUpdated) {
        const log = e as ethers.EventLog;
        events.push({
          type: 'Metadata Updated',
          caseId: log.args[0],
          actor: log.args[2],
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          details: log.args[3],
        });
      }

      for (const e of statusChanged) {
        const log = e as ethers.EventLog;
        const from = statusLabels[Number(log.args[1])] || '?';
        const to   = statusLabels[Number(log.args[2])] || '?';
        events.push({
          type: 'Status Changed',
          caseId: log.args[0],
          actor: log.args[3],
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          details: `${from} → ${to}: ${log.args[4]}`,
        });
      }

      for (const e of reviewed) {
        const log = e as ethers.EventLog;
        events.push({
          type: 'Case Reviewed',
          caseId: log.args[1],
          actor: log.args[2],
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          details: `Category: ${reviewLabels[Number(log.args[3])] || 'Unknown'}`,
        });
      }

      for (const e of updated) {
        const log = e as ethers.EventLog;
        events.push({
          type: 'Update Reported',
          caseId: log.args[1],
          actor: log.args[2],
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          details: `Priority: ${log.args[3]}`,
        });
      }

      for (const e of acknowledged) {
        const log = e as ethers.EventLog;
        events.push({
          type: 'Update Acknowledged',
          caseId: log.args[1],
          actor: log.args[2],
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          details: `Update #${log.args[0]}`,
        });
      }

      events.sort((a, b) => b.blockNumber - a.blockNumber);
      return events;
    } catch (err) {
      console.error('Failed to fetch audit events:', err);
      return [];
    }
  }, [contract]);

  return {
    contract,
    txState,
    resetTxState,
    computeCaseId,
    registerCase,
    getCase,
    getAllCases,
    getCaseCount,
    getRelatedCases,
    getCasesRelatedTo,
    getCaseStatus,
    updateCaseMetadata,
    updateCaseStatus,
    recordCaseReview,
    getCaseReviews,
    reportCaseUpdate,
    acknowledgeCaseUpdate,
    getCaseUpdates,
    grantOfficerRole,
    revokeOfficerRole,
    grantReviewerRole,
    revokeReviewerRole,
    getAuditEvents,
  };
}
