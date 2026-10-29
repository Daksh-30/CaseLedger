// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CaseLedgerRegistry
 * @dev Blockchain-Based Criminal Case Record Management and Audit System
 *
 * IMPORTANT: This is an academic prototype only.
 * It is NOT suitable for storing real criminal records, personal data,
 * or any information subject to data-protection law.
 * All records should use synthetic fictional identifiers.
 *
 * On-chain storage is limited to:
 *   - Opaque case identifiers
 *   - Cryptographic metadata commitments (hashes)
 *   - Controlled status values
 *   - Role assignments
 *   - Audit event references
 *
 * Detailed case descriptions and personal information must remain off-chain.
 */
contract CaseLedgerRegistry is AccessControl {

    // ─── Enums ───────────────────────────────────────────────────────────────

    /**
     * @dev Administrative case-progress statuses.
     * These represent procedural stages, NOT a determination of guilt.
     */
    enum CaseStatus {
        Registered,          // 0 — Case record has been filed
        UnderInvestigation,  // 1 — Active investigation in progress
        ChargesFiled,        // 2 — Formal charges have been submitted
        InCourt,             // 3 — Matter is before a court
        Closed,              // 4 — Case has been administratively closed
        Archived             // 5 — Case archived; no active proceedings
    }

    /**
     * @dev Category of a case review action.
     */
    enum ReviewCategory {
        IntegrityVerification,  // 0 — Record hash verified by reviewer
        RecordReview,           // 1 — Substantive review of record content
        OfficialApproval,       // 2 — Formal administrative approval
        RecordDispute           // 3 — Dispute or concern raised about record
    }

    // ─── Structs ─────────────────────────────────────────────────────────────

    /**
     * @dev Core case record stored on-chain.
     * Never stores real names, addresses, biometrics, or sensitive personal data.
     */
    struct CaseRecord {
        bytes32 caseId;           // keccak256(caseRef + "@" + filingDate)
        string  caseRef;          // Fictional case reference, e.g. CASE-DEMO-001
        string  category;         // Category label, e.g. "Fraud", "Theft"
        string  filingDate;       // ISO date string, e.g. "2026-01-15"
        bytes32 metadataHash;     // SHA-256 commitment of off-chain metadata
        address filedBy;          // Wallet address of the filing officer
        uint256 registeredAt;     // block.timestamp
        uint256 blockNumber;      // block.number at registration
        CaseStatus status;        // Current administrative status
        bytes32[] relatedCases;   // IDs of related case records
        string  description;      // Brief non-sensitive summary (max 200 chars recommended)
    }

    /**
     * @dev A review event submitted by an authorized reviewer.
     */
    struct CaseReview {
        uint256 id;
        bytes32 caseId;
        address reviewer;
        ReviewCategory category;
        string  notes;       // Non-sensitive reviewer notes
        uint256 timestamp;
    }

    /**
     * @dev A procedural update or alert linked to a case.
     */
    struct CaseUpdate {
        uint256 id;
        bytes32 caseId;
        address reporter;
        string  summary;     // Non-sensitive summary
        uint8   priority;    // 1 (low) – 5 (critical)
        uint256 timestamp;
        bool    acknowledged;
    }

    // ─── Roles ───────────────────────────────────────────────────────────────

    bytes32 public constant OFFICER_ROLE  = keccak256("OFFICER_ROLE");
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(bytes32 => CaseRecord)  private cases;
    bytes32[] public caseIds;

    mapping(bytes32 => CaseReview[])  private reviews;
    mapping(bytes32 => CaseUpdate[])  private updates;
    mapping(bytes32 => bytes32[])     private relatedTo; // reverse: caseId → cases that list it

    uint256 public reviewCount;
    uint256 public updateCount;
    uint256 public constant MAX_RELATED_CASES = 20;

    // ─── Events ──────────────────────────────────────────────────────────────

    event CaseRegistered(
        bytes32 indexed caseId,
        string  caseRef,
        string  category,
        bytes32 metadataHash,
        address indexed officer
    );
    event CaseMetadataUpdated(
        bytes32 indexed caseId,
        bytes32 newMetadataHash,
        address indexed officer,
        string  reason
    );
    event CaseStatusChanged(
        bytes32 indexed caseId,
        CaseStatus oldStatus,
        CaseStatus newStatus,
        address indexed actor,
        string  reason
    );
    event CaseReviewRecorded(
        uint256 indexed reviewId,
        bytes32 indexed caseId,
        address indexed reviewer,
        uint8   category
    );
    event CaseUpdateReported(
        uint256 indexed updateId,
        bytes32 indexed caseId,
        address indexed reporter,
        uint8   priority
    );
    event CaseUpdateAcknowledged(
        uint256 indexed updateId,
        bytes32 indexed caseId,
        address indexed acknowledger
    );
    event RoleGranted_CL(
        address indexed account,
        bytes32 indexed role,
        address indexed grantor
    );
    event RoleRevoked_CL(
        address indexed account,
        bytes32 indexed role,
        address indexed revoker
    );

    // ─── Custom Errors ───────────────────────────────────────────────────────

    error EmptyCaseRef();
    error EmptyCategory();
    error EmptyFilingDate();
    error InvalidMetadataHash();
    error CaseAlreadyExists(bytes32 caseId);
    error CaseNotFound(bytes32 caseId);
    error RelatedCaseNotFound(bytes32 relatedId);
    error SelfRelatedCase();
    error TooManyRelatedCases(uint256 count, uint256 max);
    error InvalidStatusTransition(CaseStatus current, CaseStatus target);
    error EmptyReason();
    error EmptyNotes();
    error InvalidPriority(uint8 priority);
    error UpdateNotFound(uint256 updateId);
    error UpdateAlreadyAcknowledged(uint256 updateId);
    error DuplicateRelatedCase(bytes32 relatedId);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OFFICER_ROLE, msg.sender);
        emit RoleGranted_CL(msg.sender, DEFAULT_ADMIN_ROLE, msg.sender);
        emit RoleGranted_CL(msg.sender, OFFICER_ROLE, msg.sender);
    }

    // ─── ID Computation ──────────────────────────────────────────────────────

    /**
     * @notice Computes a deterministic case ID from case reference and filing date.
     * @dev keccak256(abi.encodePacked(caseRef, "@", filingDate))
     */
    function computeCaseId(
        string memory caseRef,
        string memory filingDate
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(caseRef, "@", filingDate));
    }

    // ─── Registration ────────────────────────────────────────────────────────

    /**
     * @notice Registers a new case record.
     * @dev Only OFFICER_ROLE or DEFAULT_ADMIN_ROLE may register cases.
     *      metadataHash is a SHA-256 commitment of the off-chain case document.
     *      No personally identifiable information should be passed in description.
     */
    function registerCase(
        string  calldata caseRef,
        string  calldata category,
        string  calldata filingDate,
        bytes32          metadataHash,
        string  calldata description,
        bytes32[] calldata relatedCases
    ) external onlyRole(OFFICER_ROLE) {
        if (bytes(caseRef).length == 0)     revert EmptyCaseRef();
        if (bytes(category).length == 0)    revert EmptyCategory();
        if (bytes(filingDate).length == 0)  revert EmptyFilingDate();
        if (metadataHash == bytes32(0))      revert InvalidMetadataHash();

        bytes32 caseId = computeCaseId(caseRef, filingDate);
        if (cases[caseId].registeredAt != 0) revert CaseAlreadyExists(caseId);

        if (relatedCases.length > MAX_RELATED_CASES) {
            revert TooManyRelatedCases(relatedCases.length, MAX_RELATED_CASES);
        }

        for (uint256 i = 0; i < relatedCases.length; i++) {
            bytes32 rid = relatedCases[i];
            if (rid == caseId) revert SelfRelatedCase();

            for (uint256 j = 0; j < i; j++) {
                if (relatedCases[j] == rid) revert DuplicateRelatedCase(rid);
            }

            if (cases[rid].registeredAt == 0) revert RelatedCaseNotFound(rid);
        }

        cases[caseId] = CaseRecord({
            caseId:       caseId,
            caseRef:      caseRef,
            category:     category,
            filingDate:   filingDate,
            metadataHash: metadataHash,
            filedBy:      msg.sender,
            registeredAt: block.timestamp,
            blockNumber:  block.number,
            status:       CaseStatus.Registered,
            relatedCases: relatedCases,
            description:  description
        });

        for (uint256 i = 0; i < relatedCases.length; i++) {
            relatedTo[relatedCases[i]].push(caseId);
        }

        caseIds.push(caseId);

        emit CaseRegistered(caseId, caseRef, category, metadataHash, msg.sender);
    }

    // ─── Retrieval ───────────────────────────────────────────────────────────

    /**
     * @notice Returns the on-chain case record.
     */
    function getCase(bytes32 caseId) external view returns (CaseRecord memory) {
        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);
        return cases[caseId];
    }

    /**
     * @notice Returns all registered case IDs.
     */
    function getAllCaseIds() external view returns (bytes32[] memory) {
        return caseIds;
    }

    /**
     * @notice Returns total registered case count.
     */
    function getCaseCount() external view returns (uint256) {
        return caseIds.length;
    }

    /**
     * @notice Returns related case IDs declared at registration.
     */
    function getRelatedCases(bytes32 caseId) external view returns (bytes32[] memory) {
        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);
        return cases[caseId].relatedCases;
    }

    /**
     * @notice Returns cases that reference this case as related.
     */
    function getCasesRelatedTo(bytes32 caseId) external view returns (bytes32[] memory) {
        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);
        return relatedTo[caseId];
    }

    /**
     * @notice Returns the current case status.
     */
    function getCaseStatus(bytes32 caseId) external view returns (CaseStatus) {
        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);
        return cases[caseId].status;
    }

    // ─── Metadata Update ─────────────────────────────────────────────────────

    /**
     * @notice Updates the metadata commitment for a case.
     * @dev Records the new hash and preserves the audit event. Does not erase history.
     *      Only OFFICER_ROLE or admin may update metadata.
     */
    function updateCaseMetadata(
        bytes32 caseId,
        bytes32 newMetadataHash,
        string  calldata reason
    ) external onlyRole(OFFICER_ROLE) {
        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);
        if (newMetadataHash == bytes32(0))    revert InvalidMetadataHash();
        if (bytes(reason).length == 0)        revert EmptyReason();

        cases[caseId].metadataHash = newMetadataHash;
        emit CaseMetadataUpdated(caseId, newMetadataHash, msg.sender, reason);
    }

    // ─── Status Transitions ──────────────────────────────────────────────────

    /**
     * @notice Advances or changes the administrative status of a case.
     * @dev Valid transitions:
     *      Registered       → UnderInvestigation, Closed, Archived
     *      UnderInvestigation → ChargesFiled, Closed, Archived
     *      ChargesFiled     → InCourt, Closed, Archived
     *      InCourt          → Closed, Archived
     *      Closed           → Archived, UnderInvestigation (reopen)
     *      Archived         → (no further transitions; permanent)
     *
     * These statuses represent administrative case progress only.
     * They do NOT represent a determination of guilt.
     *
     * Only OFFICER_ROLE or REVIEWER_ROLE may change status.
     */
    function updateCaseStatus(
        bytes32 caseId,
        CaseStatus newStatus,
        string  calldata reason
    ) external {
        bool isOfficer  = hasRole(OFFICER_ROLE, msg.sender);
        bool isReviewer = hasRole(REVIEWER_ROLE, msg.sender);
        require(isOfficer || isReviewer, "CaseLedger: caller lacks required role");

        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);
        if (bytes(reason).length == 0)        revert EmptyReason();

        CaseStatus current = cases[caseId].status;
        if (current == newStatus) revert InvalidStatusTransition(current, newStatus);

        // Archived is terminal
        if (current == CaseStatus.Archived) {
            revert InvalidStatusTransition(current, newStatus);
        }

        // Validate allowed transitions
        bool allowed = false;
        if (current == CaseStatus.Registered) {
            allowed = (newStatus == CaseStatus.UnderInvestigation ||
                       newStatus == CaseStatus.Closed             ||
                       newStatus == CaseStatus.Archived);
        } else if (current == CaseStatus.UnderInvestigation) {
            allowed = (newStatus == CaseStatus.ChargesFiled ||
                       newStatus == CaseStatus.Closed       ||
                       newStatus == CaseStatus.Archived);
        } else if (current == CaseStatus.ChargesFiled) {
            allowed = (newStatus == CaseStatus.InCourt   ||
                       newStatus == CaseStatus.Closed    ||
                       newStatus == CaseStatus.Archived);
        } else if (current == CaseStatus.InCourt) {
            allowed = (newStatus == CaseStatus.Closed   ||
                       newStatus == CaseStatus.Archived);
        } else if (current == CaseStatus.Closed) {
            // Reopen or archive
            allowed = (newStatus == CaseStatus.UnderInvestigation ||
                       newStatus == CaseStatus.Archived);
        }

        if (!allowed) revert InvalidStatusTransition(current, newStatus);

        cases[caseId].status = newStatus;
        emit CaseStatusChanged(caseId, current, newStatus, msg.sender, reason);
    }

    // ─── Reviews ─────────────────────────────────────────────────────────────

    /**
     * @notice Records a review event against a case.
     * @dev Only REVIEWER_ROLE may submit reviews.
     *      notes must be non-sensitive; detailed findings stay off-chain.
     */
    function recordCaseReview(
        bytes32 caseId,
        ReviewCategory category,
        string  calldata notes
    ) external onlyRole(REVIEWER_ROLE) {
        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);
        if (bytes(notes).length == 0)         revert EmptyNotes();

        reviewCount++;
        reviews[caseId].push(CaseReview({
            id:        reviewCount,
            caseId:    caseId,
            reviewer:  msg.sender,
            category:  category,
            notes:     notes,
            timestamp: block.timestamp
        }));

        emit CaseReviewRecorded(reviewCount, caseId, msg.sender, uint8(category));
    }

    /**
     * @notice Returns all reviews for a case.
     */
    function getCaseReviews(bytes32 caseId) external view returns (CaseReview[] memory) {
        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);
        return reviews[caseId];
    }

    // ─── Case Updates ────────────────────────────────────────────────────────

    /**
     * @notice Reports a procedural update or alert against a case.
     * @dev OFFICER_ROLE or REVIEWER_ROLE may report updates.
     *      priority: 1 (informational) – 5 (critical)
     */
    function reportCaseUpdate(
        bytes32 caseId,
        string  calldata summary,
        uint8   priority
    ) external {
        bool isOfficer  = hasRole(OFFICER_ROLE, msg.sender);
        bool isReviewer = hasRole(REVIEWER_ROLE, msg.sender);
        require(isOfficer || isReviewer, "CaseLedger: caller lacks required role");

        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);
        if (bytes(summary).length == 0)       revert EmptyReason();
        if (priority < 1 || priority > 5)     revert InvalidPriority(priority);

        updateCount++;
        updates[caseId].push(CaseUpdate({
            id:             updateCount,
            caseId:         caseId,
            reporter:       msg.sender,
            summary:        summary,
            priority:       priority,
            timestamp:      block.timestamp,
            acknowledged:   false
        }));

        emit CaseUpdateReported(updateCount, caseId, msg.sender, priority);
    }

    /**
     * @notice Acknowledges a previously reported case update.
     */
    function acknowledgeCaseUpdate(
        uint256 updateId,
        bytes32 caseId
    ) external {
        bool isOfficer  = hasRole(OFFICER_ROLE, msg.sender);
        bool isReviewer = hasRole(REVIEWER_ROLE, msg.sender);
        require(isOfficer || isReviewer, "CaseLedger: caller lacks required role");

        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);

        CaseUpdate[] storage list = updates[caseId];
        bool found = false;
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].id == updateId) {
                found = true;
                if (list[i].acknowledged) revert UpdateAlreadyAcknowledged(updateId);
                list[i].acknowledged = true;
                emit CaseUpdateAcknowledged(updateId, caseId, msg.sender);
                break;
            }
        }
        if (!found) revert UpdateNotFound(updateId);
    }

    /**
     * @notice Returns all updates for a case.
     */
    function getCaseUpdates(bytes32 caseId) external view returns (CaseUpdate[] memory) {
        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);
        return updates[caseId];
    }

    /**
     * @notice Returns total update count for a case.
     */
    function getCaseUpdateCount(bytes32 caseId) external view returns (uint256) {
        if (cases[caseId].registeredAt == 0) revert CaseNotFound(caseId);
        return updates[caseId].length;
    }

    // ─── Role Management ─────────────────────────────────────────────────────

    /**
     * @notice Grants OFFICER_ROLE to an account.
     */
    function grantOfficerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(OFFICER_ROLE, account);
        emit RoleGranted_CL(account, OFFICER_ROLE, msg.sender);
    }

    /**
     * @notice Revokes OFFICER_ROLE from an account.
     */
    function revokeOfficerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(OFFICER_ROLE, account);
        emit RoleRevoked_CL(account, OFFICER_ROLE, msg.sender);
    }

    /**
     * @notice Grants REVIEWER_ROLE to an account.
     */
    function grantReviewerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(REVIEWER_ROLE, account);
        emit RoleGranted_CL(account, REVIEWER_ROLE, msg.sender);
    }

    /**
     * @notice Revokes REVIEWER_ROLE from an account.
     */
    function revokeReviewerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(REVIEWER_ROLE, account);
        emit RoleRevoked_CL(account, REVIEWER_ROLE, msg.sender);
    }
}
