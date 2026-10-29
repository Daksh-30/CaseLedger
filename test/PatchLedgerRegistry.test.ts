import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("PatchLedgerRegistry", function () {
  async function deployRegistryFixture() {
    const [admin, maintainer, reviewer, otherAccount] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("PatchLedgerRegistry");
    const registry = await factory.deploy();
    await registry.waitForDeployment();

    const MAINTAINER_ROLE = await registry.MAINTAINER_ROLE();
    const REVIEWER_ROLE = await registry.REVIEWER_ROLE();
    const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();

    // Grant maintainer role to maintainer account
    await registry.connect(admin).grantMaintainerRole(maintainer.address);
    // Grant reviewer role to reviewer account
    await registry.connect(admin).grantReviewerRole(reviewer.address);

    const validFingerprint = ethers.zeroPadValue("0x1111", 32);
    const validFingerprint2 = ethers.zeroPadValue("0x2222", 32);

    return {
      registry,
      admin,
      maintainer,
      reviewer,
      otherAccount,
      MAINTAINER_ROLE,
      REVIEWER_ROLE,
      DEFAULT_ADMIN_ROLE,
      validFingerprint,
      validFingerprint2,
    };
  }

  describe("Deployment", function () {
    it("Should set deployer as admin", async function () {
      const { registry, admin, DEFAULT_ADMIN_ROLE } = await loadFixture(deployRegistryFixture);
      expect(await registry.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Should set deployer as maintainer", async function () {
      const { registry, admin, MAINTAINER_ROLE } = await loadFixture(deployRegistryFixture);
      expect(await registry.hasRole(MAINTAINER_ROLE, admin.address)).to.be.true;
    });
  });

  describe("Release Registration", function () {
    it("Should register a release successfully", async function () {
      const { registry, maintainer, validFingerprint } = await loadFixture(deployRegistryFixture);

      const pkgName = "auth-lib";
      const version = "1.0.0";
      const description = "Zero trust authentication module";
      const expectedReleaseId = await registry.computeReleaseId(pkgName, version);

      await expect(
        registry
          .connect(maintainer)
          .registerRelease(pkgName, version, validFingerprint, description, [])
      )
        .to.emit(registry, "ReleaseRegistered")
        .withArgs(expectedReleaseId, pkgName, version, validFingerprint, maintainer.address);

      const release = await registry.getRelease(expectedReleaseId);
      expect(release.packageName).to.equal(pkgName);
      expect(release.version).to.equal(version);
      expect(release.fingerprint).to.equal(validFingerprint);
      expect(release.maintainer).to.equal(maintainer.address);
      expect(release.status).to.equal(0); // SecurityStatus.Active
      expect(release.dependencies.length).to.equal(0);
      expect(release.description).to.equal(description);
      expect(release.registeredAt).to.be.greaterThan(0);
      expect(release.blockNumber).to.be.greaterThan(0);
    });

    it("Should reject empty package name", async function () {
      const { registry, maintainer, validFingerprint } = await loadFixture(deployRegistryFixture);
      await expect(
        registry
          .connect(maintainer)
          .registerRelease("", "1.0.0", validFingerprint, "description", [])
      ).to.be.revertedWithCustomError(registry, "EmptyPackageName");
    });

    it("Should reject empty version", async function () {
      const { registry, maintainer, validFingerprint } = await loadFixture(deployRegistryFixture);
      await expect(
        registry
          .connect(maintainer)
          .registerRelease("pkg", "", validFingerprint, "description", [])
      ).to.be.revertedWithCustomError(registry, "EmptyVersion");
    });

    it("Should reject invalid fingerprint (zero bytes)", async function () {
      const { registry, maintainer } = await loadFixture(deployRegistryFixture);
      await expect(
        registry
          .connect(maintainer)
          .registerRelease("pkg", "1.0.0", ethers.ZeroHash, "description", [])
      ).to.be.revertedWithCustomError(registry, "InvalidFingerprint");
    });

    it("Should reject duplicate release", async function () {
      const { registry, maintainer, validFingerprint } = await loadFixture(deployRegistryFixture);
      await registry
        .connect(maintainer)
        .registerRelease("pkg", "1.0.0", validFingerprint, "desc", []);

      const releaseId = await registry.computeReleaseId("pkg", "1.0.0");
      await expect(
        registry
          .connect(maintainer)
          .registerRelease("pkg", "1.0.0", validFingerprint, "desc2", [])
      )
        .to.be.revertedWithCustomError(registry, "ReleaseAlreadyExists")
        .withArgs(releaseId);
    });

    it("Should register with valid dependencies", async function () {
      const { registry, maintainer, validFingerprint, validFingerprint2 } = await loadFixture(
        deployRegistryFixture
      );

      // Register parent release
      await registry
        .connect(maintainer)
        .registerRelease("dep-pkg", "1.0.0", validFingerprint, "base dep", []);
      const depId = await registry.computeReleaseId("dep-pkg", "1.0.0");

      // Register child release with dependency
      await registry
        .connect(maintainer)
        .registerRelease("child-pkg", "1.0.0", validFingerprint2, "child", [depId]);
      const childId = await registry.computeReleaseId("child-pkg", "1.0.0");

      const deps = await registry.getDependencies(childId);
      expect(deps).to.deep.equal([depId]);

      const dependents = await registry.getDependents(depId);
      expect(dependents).to.deep.equal([childId]);
    });

    it("Should reject unknown dependency", async function () {
      const { registry, maintainer, validFingerprint } = await loadFixture(deployRegistryFixture);
      const fakeDepId = ethers.keccak256(ethers.toUtf8Bytes("non-existent@1.0.0"));

      await expect(
        registry
          .connect(maintainer)
          .registerRelease("pkg", "1.0.0", validFingerprint, "desc", [fakeDepId])
      )
        .to.be.revertedWithCustomError(registry, "DependencyNotFound")
        .withArgs(fakeDepId);
    });

    it("Should reject self-dependency", async function () {
      const { registry, maintainer, validFingerprint } = await loadFixture(deployRegistryFixture);
      const selfId = await registry.computeReleaseId("self-pkg", "1.0.0");

      await expect(
        registry
          .connect(maintainer)
          .registerRelease("self-pkg", "1.0.0", validFingerprint, "desc", [selfId])
      ).to.be.revertedWithCustomError(registry, "SelfDependency");
    });

    it("Should reject duplicate dependencies", async function () {
      const { registry, maintainer, validFingerprint, validFingerprint2 } = await loadFixture(
        deployRegistryFixture
      );
      await registry
        .connect(maintainer)
        .registerRelease("dep-pkg", "1.0.0", validFingerprint, "dep", []);
      const depId = await registry.computeReleaseId("dep-pkg", "1.0.0");

      await expect(
        registry
          .connect(maintainer)
          .registerRelease("pkg", "1.0.0", validFingerprint2, "desc", [depId, depId])
      )
        .to.be.revertedWithCustomError(registry, "DuplicateDependency")
        .withArgs(depId);
    });

    it("Should reject too many dependencies (>20)", async function () {
      const { registry, maintainer, validFingerprint } = await loadFixture(deployRegistryFixture);
      const manyDeps: string[] = [];
      for (let i = 0; i < 21; i++) {
        manyDeps.push(ethers.zeroPadValue(ethers.toBeHex(i + 1), 32));
      }

      await expect(
        registry
          .connect(maintainer)
          .registerRelease("pkg", "1.0.0", validFingerprint, "desc", manyDeps)
      )
        .to.be.revertedWithCustomError(registry, "TooManyDependencies")
        .withArgs(21, 20);
    });

    it("Should reject unauthorized registration", async function () {
      const { registry, otherAccount, validFingerprint, MAINTAINER_ROLE } = await loadFixture(
        deployRegistryFixture
      );
      await expect(
        registry
          .connect(otherAccount)
          .registerRelease("pkg", "1.0.0", validFingerprint, "desc", [])
      )
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(otherAccount.address, MAINTAINER_ROLE);
    });
  });

  describe("Status Transitions", function () {
    async function registeredReleaseFixture() {
      const base = await deployRegistryFixture();
      await base.registry
        .connect(base.maintainer)
        .registerRelease("target-pkg", "1.0.0", base.validFingerprint, "description", []);
      const releaseId = await base.registry.computeReleaseId("target-pkg", "1.0.0");
      return { ...base, releaseId };
    }

    it("Should flag an active release", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(registeredReleaseFixture);
      const reason = "Suspicious outbound network traffic observed in sandbox";

      await expect(registry.connect(reviewer).flagRelease(releaseId, reason))
        .to.emit(registry, "ReleaseFlagged")
        .withArgs(releaseId, reviewer.address, reason)
        .and.to.emit(registry, "IncidentReported")
        .withArgs(1, releaseId, reviewer.address, 3);

      expect(await registry.getReleaseStatus(releaseId)).to.equal(1); // SecurityStatus.Flagged

      const incidents = await registry.getIncidents(releaseId);
      expect(incidents.length).to.equal(1);
      expect(incidents[0].severity).to.equal(3);
      expect(incidents[0].reason).to.equal(reason);
      expect(incidents[0].resolved).to.be.false;
    });

    it("Should revoke an active release", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(registeredReleaseFixture);
      const reason = "Critical zero-day exploit verified";

      await expect(registry.connect(reviewer).revokeRelease(releaseId, reason))
        .to.emit(registry, "ReleaseRevoked")
        .withArgs(releaseId, reviewer.address, reason);

      expect(await registry.getReleaseStatus(releaseId)).to.equal(2); // SecurityStatus.Revoked
    });

    it("Should revoke a flagged release", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(registeredReleaseFixture);
      await registry.connect(reviewer).flagRelease(releaseId, "Initial suspicious behavior");

      await expect(
        registry.connect(reviewer).revokeRelease(releaseId, "Confirmed critical malware payload")
      )
        .to.emit(registry, "ReleaseRevoked")
        .withArgs(releaseId, reviewer.address, "Confirmed critical malware payload");

      expect(await registry.getReleaseStatus(releaseId)).to.equal(2); // SecurityStatus.Revoked
    });

    it("Should restore a flagged release", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(registeredReleaseFixture);
      await registry.connect(reviewer).flagRelease(releaseId, "Suspicious report");

      await expect(
        registry.connect(reviewer).restoreRelease(releaseId, "Verified as false positive")
      )
        .to.emit(registry, "ReleaseRestored")
        .withArgs(releaseId, reviewer.address, "Verified as false positive");

      expect(await registry.getReleaseStatus(releaseId)).to.equal(0); // SecurityStatus.Active

      // Past incidents preserved
      const incidents = await registry.getIncidents(releaseId);
      expect(incidents.length).to.equal(1);
    });

    it("Should restore a revoked release", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(registeredReleaseFixture);
      await registry.connect(reviewer).revokeRelease(releaseId, "Emergency revocation");

      await expect(
        registry.connect(reviewer).restoreRelease(releaseId, "Re-evaluated and safe under guidelines")
      )
        .to.emit(registry, "ReleaseRestored")
        .withArgs(releaseId, reviewer.address, "Re-evaluated and safe under guidelines");

      expect(await registry.getReleaseStatus(releaseId)).to.equal(0); // SecurityStatus.Active
    });

    it("Should reject flagging an already flagged release", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(registeredReleaseFixture);
      await registry.connect(reviewer).flagRelease(releaseId, "First flag");

      await expect(
        registry.connect(reviewer).flagRelease(releaseId, "Second flag")
      ).to.be.revertedWithCustomError(registry, "InvalidStatusTransition");
    });

    it("Should reject flagging a revoked release", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(registeredReleaseFixture);
      await registry.connect(reviewer).revokeRelease(releaseId, "Revoked directly");

      await expect(
        registry.connect(reviewer).flagRelease(releaseId, "Cannot flag revoked")
      ).to.be.revertedWithCustomError(registry, "InvalidStatusTransition");
    });

    it("Should reject unauthorized flagging", async function () {
      const { registry, otherAccount, releaseId, REVIEWER_ROLE } = await loadFixture(
        registeredReleaseFixture
      );
      await expect(
        registry.connect(otherAccount).flagRelease(releaseId, "Unauthorized flag attempt")
      )
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(otherAccount.address, REVIEWER_ROLE);
    });

    it("Should reject unauthorized revocation", async function () {
      const { registry, otherAccount, releaseId, REVIEWER_ROLE } = await loadFixture(
        registeredReleaseFixture
      );
      await expect(
        registry.connect(otherAccount).revokeRelease(releaseId, "Unauthorized revoke attempt")
      )
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(otherAccount.address, REVIEWER_ROLE);
    });
  });

  describe("Attestations", function () {
    async function releaseFixture() {
      const base = await deployRegistryFixture();
      await base.registry
        .connect(base.maintainer)
        .registerRelease("attest-pkg", "1.0.0", base.validFingerprint, "pkg", []);
      const releaseId = await base.registry.computeReleaseId("attest-pkg", "1.0.0");
      return { ...base, releaseId };
    }

    it("Should add attestation", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(releaseFixture);
      const reason = "Passed SOC2 and independent static analysis audit";

      await expect(registry.connect(reviewer).addSecurityAttestation(releaseId, 0, reason))
        .to.emit(registry, "AttestationAdded")
        .withArgs(1, releaseId, reviewer.address, 0);

      const attestations = await registry.getAttestations(releaseId);
      expect(attestations.length).to.equal(1);
      expect(attestations[0].id).to.equal(1);
      expect(attestations[0].releaseId).to.equal(releaseId);
      expect(attestations[0].reviewer).to.equal(reviewer.address);
      expect(attestations[0].attestationType).to.equal(0);
      expect(attestations[0].reason).to.equal(reason);
      expect(attestations[0].timestamp).to.be.greaterThan(0);

      expect(await registry.attestationCount()).to.equal(1);
    });

    it("Should reject attestation for unknown release", async function () {
      const { registry, reviewer } = await loadFixture(releaseFixture);
      const unknownId = ethers.keccak256(ethers.toUtf8Bytes("unknown@0.0.0"));

      await expect(
        registry.connect(reviewer).addSecurityAttestation(unknownId, 1, "Review notes")
      )
        .to.be.revertedWithCustomError(registry, "ReleaseNotFound")
        .withArgs(unknownId);
    });

    it("Should reject attestation with empty reason", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(releaseFixture);
      await expect(
        registry.connect(reviewer).addSecurityAttestation(releaseId, 2, "")
      ).to.be.revertedWithCustomError(registry, "EmptyReason");
    });

    it("Should reject unauthorized attestation", async function () {
      const { registry, otherAccount, releaseId, REVIEWER_ROLE } = await loadFixture(
        releaseFixture
      );
      await expect(
        registry.connect(otherAccount).addSecurityAttestation(releaseId, 0, "Audit passed")
      )
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(otherAccount.address, REVIEWER_ROLE);
    });
  });

  describe("Incidents", function () {
    async function incidentFixture() {
      const base = await deployRegistryFixture();
      await base.registry
        .connect(base.maintainer)
        .registerRelease("incident-pkg", "1.0.0", base.validFingerprint, "desc", []);
      const releaseId = await base.registry.computeReleaseId("incident-pkg", "1.0.0");
      return { ...base, releaseId };
    }

    it("Should report incident", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(incidentFixture);
      const reason = "Suspicious behavior reported by community member";
      const severity = 4;

      await expect(registry.connect(reviewer).reportIncident(releaseId, reason, severity))
        .to.emit(registry, "IncidentReported")
        .withArgs(1, releaseId, reviewer.address, severity);

      const incidents = await registry.getIncidents(releaseId);
      expect(incidents.length).to.equal(1);
      expect(incidents[0].id).to.equal(1);
      expect(incidents[0].reporter).to.equal(reviewer.address);
      expect(incidents[0].reason).to.equal(reason);
      expect(incidents[0].severity).to.equal(severity);
      expect(incidents[0].resolved).to.be.false;

      expect(await registry.getIncidentCount(releaseId)).to.equal(1);
      expect(await registry.incidentCount()).to.equal(1);
    });

    it("Should resolve incident", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(incidentFixture);
      await registry.connect(reviewer).reportIncident(releaseId, "Flaw detected", 2);

      await expect(registry.connect(reviewer).resolveIncident(1, releaseId))
        .to.emit(registry, "IncidentResolved")
        .withArgs(1, releaseId, reviewer.address);

      const incidents = await registry.getIncidents(releaseId);
      expect(incidents[0].resolved).to.be.true;
    });

    it("Should reject invalid severity", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(incidentFixture);

      await expect(
        registry.connect(reviewer).reportIncident(releaseId, "Zero severity", 0)
      )
        .to.be.revertedWithCustomError(registry, "InvalidSeverity")
        .withArgs(0);

      await expect(
        registry.connect(reviewer).reportIncident(releaseId, "Six severity", 6)
      )
        .to.be.revertedWithCustomError(registry, "InvalidSeverity")
        .withArgs(6);
    });

    it("Should reject resolving already resolved incident", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(incidentFixture);
      await registry.connect(reviewer).reportIncident(releaseId, "Bug in authentication", 3);
      await registry.connect(reviewer).resolveIncident(1, releaseId);

      await expect(
        registry.connect(reviewer).resolveIncident(1, releaseId)
      )
        .to.be.revertedWithCustomError(registry, "IncidentAlreadyResolved")
        .withArgs(1);
    });

    it("Should reject resolving non-existent incident", async function () {
      const { registry, reviewer, releaseId } = await loadFixture(incidentFixture);
      await expect(
        registry.connect(reviewer).resolveIncident(999, releaseId)
      )
        .to.be.revertedWithCustomError(registry, "IncidentNotFound")
        .withArgs(999);
    });
  });

  describe("Dependency Queries", function () {
    it("Should return correct dependencies", async function () {
      const { registry, maintainer, validFingerprint, validFingerprint2 } = await loadFixture(
        deployRegistryFixture
      );

      await registry
        .connect(maintainer)
        .registerRelease("pkg-a", "1.0.0", validFingerprint, "A", []);
      const idA = await registry.computeReleaseId("pkg-a", "1.0.0");

      await registry
        .connect(maintainer)
        .registerRelease("pkg-b", "1.0.0", validFingerprint2, "B", [idA]);
      const idB = await registry.computeReleaseId("pkg-b", "1.0.0");

      const depsA = await registry.getDependencies(idA);
      expect(depsA.length).to.equal(0);

      const depsB = await registry.getDependencies(idB);
      expect(depsB).to.deep.equal([idA]);
    });

    it("Should return correct dependents", async function () {
      const { registry, maintainer, validFingerprint, validFingerprint2 } = await loadFixture(
        deployRegistryFixture
      );

      await registry
        .connect(maintainer)
        .registerRelease("base-module", "1.0.0", validFingerprint, "base", []);
      const baseId = await registry.computeReleaseId("base-module", "1.0.0");

      await registry
        .connect(maintainer)
        .registerRelease("client-1", "1.0.0", validFingerprint2, "c1", [baseId]);
      const client1Id = await registry.computeReleaseId("client-1", "1.0.0");

      const fp3 = ethers.zeroPadValue("0x3333", 32);
      await registry
        .connect(maintainer)
        .registerRelease("client-2", "1.0.0", fp3, "c2", [baseId]);
      const client2Id = await registry.computeReleaseId("client-2", "1.0.0");

      const dependents = await registry.getDependents(baseId);
      expect(dependents).to.deep.equal([client1Id, client2Id]);
    });
  });

  describe("Role Management", function () {
    it("Admin should grant maintainer role", async function () {
      const { registry, admin, otherAccount, MAINTAINER_ROLE } = await loadFixture(
        deployRegistryFixture
      );

      expect(await registry.hasRole(MAINTAINER_ROLE, otherAccount.address)).to.be.false;

      await expect(registry.connect(admin).grantMaintainerRole(otherAccount.address))
        .to.emit(registry, "RoleGranted_PL")
        .withArgs(otherAccount.address, MAINTAINER_ROLE, admin.address);

      expect(await registry.hasRole(MAINTAINER_ROLE, otherAccount.address)).to.be.true;
    });

    it("Admin should revoke maintainer role", async function () {
      const { registry, admin, maintainer, MAINTAINER_ROLE } = await loadFixture(
        deployRegistryFixture
      );

      expect(await registry.hasRole(MAINTAINER_ROLE, maintainer.address)).to.be.true;

      await expect(registry.connect(admin).revokeMaintainerRole(maintainer.address))
        .to.emit(registry, "RoleRevoked_PL")
        .withArgs(maintainer.address, MAINTAINER_ROLE, admin.address);

      expect(await registry.hasRole(MAINTAINER_ROLE, maintainer.address)).to.be.false;
    });

    it("Admin should grant reviewer role", async function () {
      const { registry, admin, otherAccount, REVIEWER_ROLE } = await loadFixture(
        deployRegistryFixture
      );

      expect(await registry.hasRole(REVIEWER_ROLE, otherAccount.address)).to.be.false;

      await expect(registry.connect(admin).grantReviewerRole(otherAccount.address))
        .to.emit(registry, "RoleGranted_PL")
        .withArgs(otherAccount.address, REVIEWER_ROLE, admin.address);

      expect(await registry.hasRole(REVIEWER_ROLE, otherAccount.address)).to.be.true;
    });

    it("Non-admin should not grant roles", async function () {
      const { registry, maintainer, otherAccount, DEFAULT_ADMIN_ROLE } = await loadFixture(
        deployRegistryFixture
      );

      await expect(
        registry.connect(maintainer).grantMaintainerRole(otherAccount.address)
      )
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(maintainer.address, DEFAULT_ADMIN_ROLE);

      await expect(
        registry.connect(maintainer).grantReviewerRole(otherAccount.address)
      )
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(maintainer.address, DEFAULT_ADMIN_ROLE);
    });
  });

  describe("View Functions", function () {
    it("Should return all release IDs", async function () {
      const { registry, maintainer, validFingerprint, validFingerprint2 } = await loadFixture(
        deployRegistryFixture
      );

      await registry
        .connect(maintainer)
        .registerRelease("pkg-alpha", "1.0.0", validFingerprint, "A", []);
      await registry
        .connect(maintainer)
        .registerRelease("pkg-beta", "2.0.0", validFingerprint2, "B", []);

      const idAlpha = await registry.computeReleaseId("pkg-alpha", "1.0.0");
      const idBeta = await registry.computeReleaseId("pkg-beta", "2.0.0");

      const allIds = await registry.getAllReleaseIds();
      expect(allIds).to.deep.equal([idAlpha, idBeta]);
    });

    it("Should return release count", async function () {
      const { registry, maintainer, validFingerprint } = await loadFixture(deployRegistryFixture);
      expect(await registry.getReleaseCount()).to.equal(0);

      await registry
        .connect(maintainer)
        .registerRelease("pkg-1", "1.0.0", validFingerprint, "1", []);
      expect(await registry.getReleaseCount()).to.equal(1);
    });

    it("Should return release status", async function () {
      const { registry, maintainer, validFingerprint } = await loadFixture(deployRegistryFixture);
      await registry
        .connect(maintainer)
        .registerRelease("pkg-status", "1.0.0", validFingerprint, "desc", []);
      const releaseId = await registry.computeReleaseId("pkg-status", "1.0.0");

      expect(await registry.getReleaseStatus(releaseId)).to.equal(0); // Active
    });

    it("Should revert for unknown release", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);
      const unknownId = ethers.keccak256(ethers.toUtf8Bytes("ghost@1.0.0"));

      await expect(registry.getRelease(unknownId))
        .to.be.revertedWithCustomError(registry, "ReleaseNotFound")
        .withArgs(unknownId);

      await expect(registry.getReleaseStatus(unknownId))
        .to.be.revertedWithCustomError(registry, "ReleaseNotFound")
        .withArgs(unknownId);

      await expect(registry.getDependencies(unknownId))
        .to.be.revertedWithCustomError(registry, "ReleaseNotFound")
        .withArgs(unknownId);

      await expect(registry.getDependents(unknownId))
        .to.be.revertedWithCustomError(registry, "ReleaseNotFound")
        .withArgs(unknownId);
    });
  });
});
