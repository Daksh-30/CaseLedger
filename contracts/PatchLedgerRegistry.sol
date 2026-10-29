// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PatchLedgerRegistry
 * @dev Blockchain-Based Software Supply-Chain Integrity Platform Registry
 */
contract PatchLedgerRegistry is AccessControl {
    enum SecurityStatus {
        Active,
        Flagged,
        Revoked
    }

    enum AttestationType {
        Audit,
        Review,
        Approval,
        Concern
    }

    struct Release {
        bytes32 releaseId; // keccak256(packageName, "@", version)
        string packageName;
        string version;
        bytes32 fingerprint; // SHA-256 hash
        address maintainer;
        uint256 registeredAt; // block.timestamp
        uint256 blockNumber;
        SecurityStatus status;
        bytes32[] dependencies; // releaseIds of dependencies
        string description;
    }

    struct SecurityAttestation {
        uint256 id;
        bytes32 releaseId;
        address reviewer;
        AttestationType attestationType;
        string reason;
        uint256 timestamp;
    }

    struct Incident {
        uint256 id;
        bytes32 releaseId;
        address reporter;
        string reason;
        uint8 severity; // 1-5
        uint256 timestamp;
        bool resolved;
    }

    bytes32 public constant MAINTAINER_ROLE = keccak256("MAINTAINER_ROLE");
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");

    mapping(bytes32 => Release) private releases;
    bytes32[] public releaseIds;
    mapping(bytes32 => SecurityAttestation[]) private attestations;
    mapping(bytes32 => Incident[]) private incidents;
    mapping(bytes32 => bytes32[]) private dependents;

    uint256 public attestationCount;
    uint256 public incidentCount;
    uint256 public constant MAX_DEPENDENCIES = 20;

    // Events
    event ReleaseRegistered(
        bytes32 indexed releaseId,
        string packageName,
        string version,
        bytes32 fingerprint,
        address indexed maintainer
    );
    event ReleaseFlagged(bytes32 indexed releaseId, address indexed reporter, string reason);
    event ReleaseRevoked(bytes32 indexed releaseId, address indexed revoker, string reason);
    event ReleaseRestored(bytes32 indexed releaseId, address indexed restorer, string reason);
    event AttestationAdded(
        uint256 indexed attestationId,
        bytes32 indexed releaseId,
        address indexed reviewer,
        uint8 attestationType
    );
    event IncidentReported(
        uint256 indexed incidentId,
        bytes32 indexed releaseId,
        address indexed reporter,
        uint8 severity
    );
    event IncidentResolved(
        uint256 indexed incidentId,
        bytes32 indexed releaseId,
        address indexed resolver
    );
    event RoleGranted_PL(address indexed account, bytes32 indexed role, address indexed grantor);
    event RoleRevoked_PL(address indexed account, bytes32 indexed role, address indexed revoker);

    // Custom Errors
    error EmptyPackageName();
    error EmptyVersion();
    error InvalidFingerprint();
    error ReleaseAlreadyExists(bytes32 releaseId);
    error ReleaseNotFound(bytes32 releaseId);
    error DependencyNotFound(bytes32 depId);
    error SelfDependency();
    error TooManyDependencies(uint256 count, uint256 max);
    error InvalidStatusTransition(SecurityStatus current, SecurityStatus target);
    error EmptyReason();
    error InvalidSeverity(uint8 severity);
    error IncidentNotFound(uint256 incidentId);
    error IncidentAlreadyResolved(uint256 incidentId);
    error DuplicateDependency(bytes32 depId);
    error CyclicDependency(bytes32 depId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MAINTAINER_ROLE, msg.sender);
        emit RoleGranted_PL(msg.sender, DEFAULT_ADMIN_ROLE, msg.sender);
        emit RoleGranted_PL(msg.sender, MAINTAINER_ROLE, msg.sender);
    }

    /**
     * @notice Computes deterministic release ID from package name and version
     */
    function computeReleaseId(
        string memory packageName,
        string memory version
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(packageName, "@", version));
    }

    /**
     * @notice Registers a new software release
     */
    function registerRelease(
        string calldata packageName,
        string calldata version,
        bytes32 fingerprint,
        string calldata description,
        bytes32[] calldata dependencies
    ) external onlyRole(MAINTAINER_ROLE) {
        if (bytes(packageName).length == 0) revert EmptyPackageName();
        if (bytes(version).length == 0) revert EmptyVersion();
        if (fingerprint == bytes32(0)) revert InvalidFingerprint();

        bytes32 releaseId = computeReleaseId(packageName, version);
        if (releases[releaseId].registeredAt != 0) {
            revert ReleaseAlreadyExists(releaseId);
        }

        if (dependencies.length > MAX_DEPENDENCIES) {
            revert TooManyDependencies(dependencies.length, MAX_DEPENDENCIES);
        }

        for (uint256 i = 0; i < dependencies.length; i++) {
            bytes32 depId = dependencies[i];
            if (depId == releaseId) {
                revert SelfDependency();
            }

            for (uint256 j = 0; j < i; j++) {
                if (dependencies[j] == depId) {
                    revert DuplicateDependency(depId);
                }
            }

            if (releases[depId].registeredAt == 0) {
                revert DependencyNotFound(depId);
            }

            bytes32[] storage depDependencies = releases[depId].dependencies;
            for (uint256 k = 0; k < depDependencies.length; k++) {
                if (depDependencies[k] == releaseId) {
                    revert CyclicDependency(depId);
                }
            }
        }

        releases[releaseId] = Release({
            releaseId: releaseId,
            packageName: packageName,
            version: version,
            fingerprint: fingerprint,
            maintainer: msg.sender,
            registeredAt: block.timestamp,
            blockNumber: block.number,
            status: SecurityStatus.Active,
            dependencies: dependencies,
            description: description
        });

        for (uint256 i = 0; i < dependencies.length; i++) {
            dependents[dependencies[i]].push(releaseId);
        }

        releaseIds.push(releaseId);

        emit ReleaseRegistered(releaseId, packageName, version, fingerprint, msg.sender);
    }

    /**
     * @notice Retrieves release details
     */
    function getRelease(bytes32 releaseId) external view returns (Release memory) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        return releases[releaseId];
    }

    /**
     * @notice Returns all release IDs
     */
    function getAllReleaseIds() external view returns (bytes32[] memory) {
        return releaseIds;
    }

    /**
     * @notice Returns total count of registered releases
     */
    function getReleaseCount() external view returns (uint256) {
        return releaseIds.length;
    }

    /**
     * @notice Returns dependencies for a specific release
     */
    function getDependencies(bytes32 releaseId) external view returns (bytes32[] memory) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        return releases[releaseId].dependencies;
    }

    /**
     * @notice Returns direct dependents for a specific release
     */
    function getDependents(bytes32 releaseId) external view returns (bytes32[] memory) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        return dependents[releaseId];
    }

    /**
     * @notice Flags an active release for security concerns and logs an incident
     */
    function flagRelease(
        bytes32 releaseId,
        string calldata reason
    ) external onlyRole(REVIEWER_ROLE) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        if (bytes(reason).length == 0) revert EmptyReason();
        if (releases[releaseId].status != SecurityStatus.Active) {
            revert InvalidStatusTransition(releases[releaseId].status, SecurityStatus.Flagged);
        }

        releases[releaseId].status = SecurityStatus.Flagged;
        emit ReleaseFlagged(releaseId, msg.sender, reason);

        incidentCount++;
        incidents[releaseId].push(
            Incident({
                id: incidentCount,
                releaseId: releaseId,
                reporter: msg.sender,
                reason: reason,
                severity: 3,
                timestamp: block.timestamp,
                resolved: false
            })
        );
        emit IncidentReported(incidentCount, releaseId, msg.sender, 3);
    }

    /**
     * @notice Revokes a release due to critical flaws or compromise
     */
    function revokeRelease(
        bytes32 releaseId,
        string calldata reason
    ) external onlyRole(REVIEWER_ROLE) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        if (bytes(reason).length == 0) revert EmptyReason();
        if (
            releases[releaseId].status != SecurityStatus.Active &&
            releases[releaseId].status != SecurityStatus.Flagged
        ) {
            revert InvalidStatusTransition(releases[releaseId].status, SecurityStatus.Revoked);
        }

        releases[releaseId].status = SecurityStatus.Revoked;
        emit ReleaseRevoked(releaseId, msg.sender, reason);
    }

    /**
     * @notice Restores a flagged or revoked release to Active
     */
    function restoreRelease(
        bytes32 releaseId,
        string calldata reason
    ) external onlyRole(REVIEWER_ROLE) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        if (bytes(reason).length == 0) revert EmptyReason();
        if (
            releases[releaseId].status != SecurityStatus.Flagged &&
            releases[releaseId].status != SecurityStatus.Revoked
        ) {
            revert InvalidStatusTransition(releases[releaseId].status, SecurityStatus.Active);
        }

        releases[releaseId].status = SecurityStatus.Active;
        emit ReleaseRestored(releaseId, msg.sender, reason);
    }

    /**
     * @notice Adds a security attestation to a release
     */
    function addSecurityAttestation(
        bytes32 releaseId,
        AttestationType aType,
        string calldata reason
    ) external onlyRole(REVIEWER_ROLE) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        if (bytes(reason).length == 0) revert EmptyReason();

        attestationCount++;
        attestations[releaseId].push(
            SecurityAttestation({
                id: attestationCount,
                releaseId: releaseId,
                reviewer: msg.sender,
                attestationType: aType,
                reason: reason,
                timestamp: block.timestamp
            })
        );

        emit AttestationAdded(attestationCount, releaseId, msg.sender, uint8(aType));
    }

    /**
     * @notice Retrieves all security attestations for a release
     */
    function getAttestations(
        bytes32 releaseId
    ) external view returns (SecurityAttestation[] memory) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        return attestations[releaseId];
    }

    /**
     * @notice Reports a security incident against a release
     */
    function reportIncident(
        bytes32 releaseId,
        string calldata reason,
        uint8 severity
    ) external onlyRole(REVIEWER_ROLE) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        if (bytes(reason).length == 0) revert EmptyReason();
        if (severity < 1 || severity > 5) revert InvalidSeverity(severity);

        incidentCount++;
        incidents[releaseId].push(
            Incident({
                id: incidentCount,
                releaseId: releaseId,
                reporter: msg.sender,
                reason: reason,
                severity: severity,
                timestamp: block.timestamp,
                resolved: false
            })
        );

        emit IncidentReported(incidentCount, releaseId, msg.sender, severity);
    }

    /**
     * @notice Resolves a previously reported incident
     */
    function resolveIncident(
        uint256 incidentId,
        bytes32 releaseId
    ) external onlyRole(REVIEWER_ROLE) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);

        Incident[] storage list = incidents[releaseId];
        bool found = false;
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].id == incidentId) {
                found = true;
                if (list[i].resolved) revert IncidentAlreadyResolved(incidentId);
                list[i].resolved = true;
                emit IncidentResolved(incidentId, releaseId, msg.sender);
                break;
            }
        }
        if (!found) revert IncidentNotFound(incidentId);
    }

    /**
     * @notice Retrieves all incidents for a release
     */
    function getIncidents(bytes32 releaseId) external view returns (Incident[] memory) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        return incidents[releaseId];
    }

    /**
     * @notice Returns total number of incidents for a release
     */
    function getIncidentCount(bytes32 releaseId) external view returns (uint256) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        return incidents[releaseId].length;
    }

    /**
     * @notice Grants maintainer role to an account
     */
    function grantMaintainerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(MAINTAINER_ROLE, account);
        emit RoleGranted_PL(account, MAINTAINER_ROLE, msg.sender);
    }

    /**
     * @notice Revokes maintainer role from an account
     */
    function revokeMaintainerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(MAINTAINER_ROLE, account);
        emit RoleRevoked_PL(account, MAINTAINER_ROLE, msg.sender);
    }

    /**
     * @notice Grants reviewer role to an account
     */
    function grantReviewerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(REVIEWER_ROLE, account);
        emit RoleGranted_PL(account, REVIEWER_ROLE, msg.sender);
    }

    /**
     * @notice Revokes reviewer role from an account
     */
    function revokeReviewerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(REVIEWER_ROLE, account);
        emit RoleRevoked_PL(account, REVIEWER_ROLE, msg.sender);
    }

    /**
     * @notice Returns current security status of a release
     */
    function getReleaseStatus(bytes32 releaseId) external view returns (SecurityStatus) {
        if (releases[releaseId].registeredAt == 0) revert ReleaseNotFound(releaseId);
        return releases[releaseId].status;
    }
}
