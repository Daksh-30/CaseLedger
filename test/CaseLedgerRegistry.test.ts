import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("CaseLedgerRegistry", function () {

  // ─── Shared Fixture ────────────────────────────────────────────────────────

  async function deployRegistryFixture() {
    const [admin, officer, officer2, reviewer, stranger] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("CaseLedgerRegistry");
    const registry = await factory.deploy();
    await registry.waitForDeployment();

    const OFFICER_ROLE       = await registry.OFFICER_ROLE();
    const REVIEWER_ROLE      = await registry.REVIEWER_ROLE();
    const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();

    await registry.connect(admin).grantOfficerRole(officer.address);
    await registry.connect(admin).grantOfficerRole(officer2.address);
    await registry.connect(admin).grantReviewerRole(reviewer.address);

    const validHash  = ethers.zeroPadValue("0x1111", 32);
    const validHash2 = ethers.zeroPadValue("0x2222", 32);

    return {
      registry, admin, officer, officer2, reviewer, stranger,
      OFFICER_ROLE, REVIEWER_ROLE, DEFAULT_ADMIN_ROLE,
      validHash, validHash2,
    };
  }

  // ─── Deployment ────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("Should set deployer as DEFAULT_ADMIN_ROLE", async function () {
      const { registry, admin, DEFAULT_ADMIN_ROLE } = await loadFixture(deployRegistryFixture);
      expect(await registry.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Should set deployer as OFFICER_ROLE", async function () {
      const { registry, admin, OFFICER_ROLE } = await loadFixture(deployRegistryFixture);
      expect(await registry.hasRole(OFFICER_ROLE, admin.address)).to.be.true;
    });

    it("Initial case count should be zero", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);
      expect(await registry.getCaseCount()).to.equal(0);
    });
  });

  // ─── Case Registration ─────────────────────────────────────────────────────

  describe("Case Registration", function () {
    it("Should register a case successfully", async function () {
      const { registry, officer, validHash } = await loadFixture(deployRegistryFixture);

      const caseRef    = "CASE-DEMO-001";
      const category   = "Fraud";
      const filingDate = "2026-01-15";
      const desc       = "Fictional demo case — no real persons involved";

      const expectedId = await registry.computeCaseId(caseRef, filingDate);

      await expect(
        registry.connect(officer).registerCase(caseRef, category, filingDate, validHash, desc, [])
      )
        .to.emit(registry, "CaseRegistered")
        .withArgs(expectedId, caseRef, category, validHash, officer.address);

      const rec = await registry.getCase(expectedId);
      expect(rec.caseRef).to.equal(caseRef);
      expect(rec.category).to.equal(category);
      expect(rec.filingDate).to.equal(filingDate);
      expect(rec.metadataHash).to.equal(validHash);
      expect(rec.filedBy).to.equal(officer.address);
      expect(rec.status).to.equal(0); // CaseStatus.Registered
      expect(rec.relatedCases.length).to.equal(0);
      expect(rec.registeredAt).to.be.greaterThan(0);
      expect(rec.blockNumber).to.be.greaterThan(0);
    });

    it("Should reject empty case reference", async function () {
      const { registry, officer, validHash } = await loadFixture(deployRegistryFixture);
      await expect(
        registry.connect(officer).registerCase("", "Fraud", "2026-01-15", validHash, "desc", [])
      ).to.be.revertedWithCustomError(registry, "EmptyCaseRef");
    });

    it("Should reject empty category", async function () {
      const { registry, officer, validHash } = await loadFixture(deployRegistryFixture);
      await expect(
        registry.connect(officer).registerCase("CASE-001", "", "2026-01-15", validHash, "desc", [])
      ).to.be.revertedWithCustomError(registry, "EmptyCategory");
    });

    it("Should reject empty filing date", async function () {
      const { registry, officer, validHash } = await loadFixture(deployRegistryFixture);
      await expect(
        registry.connect(officer).registerCase("CASE-001", "Fraud", "", validHash, "desc", [])
      ).to.be.revertedWithCustomError(registry, "EmptyFilingDate");
    });

    it("Should reject zero metadata hash", async function () {
      const { registry, officer } = await loadFixture(deployRegistryFixture);
      await expect(
        registry.connect(officer).registerCase("CASE-001", "Fraud", "2026-01-15", ethers.ZeroHash, "desc", [])
      ).to.be.revertedWithCustomError(registry, "InvalidMetadataHash");
    });

    it("Should reject duplicate case registration", async function () {
      const { registry, officer, validHash } = await loadFixture(deployRegistryFixture);
      await registry.connect(officer).registerCase("CASE-001", "Fraud", "2026-01-15", validHash, "d", []);
      const caseId = await registry.computeCaseId("CASE-001", "2026-01-15");
      await expect(
        registry.connect(officer).registerCase("CASE-001", "Fraud", "2026-01-15", validHash, "d2", [])
      )
        .to.be.revertedWithCustomError(registry, "CaseAlreadyExists")
        .withArgs(caseId);
    });

    it("Should reject self-related case", async function () {
      const { registry, officer, validHash } = await loadFixture(deployRegistryFixture);
      const selfId = await registry.computeCaseId("SELF-CASE", "2026-01-15");
      await expect(
        registry.connect(officer).registerCase("SELF-CASE", "Theft", "2026-01-15", validHash, "d", [selfId])
      ).to.be.revertedWithCustomError(registry, "SelfRelatedCase");
    });

    it("Should reject unknown related case", async function () {
      const { registry, officer, validHash } = await loadFixture(deployRegistryFixture);
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("ghost@2025-01-01"));
      await expect(
        registry.connect(officer).registerCase("CASE-002", "Theft", "2026-01-15", validHash, "d", [fakeId])
      )
        .to.be.revertedWithCustomError(registry, "RelatedCaseNotFound")
        .withArgs(fakeId);
    });

    it("Should reject duplicate related case entries", async function () {
      const { registry, officer, validHash, validHash2 } = await loadFixture(deployRegistryFixture);
      await registry.connect(officer).registerCase("CASE-A", "Fraud", "2026-01-15", validHash, "d", []);
      const idA = await registry.computeCaseId("CASE-A", "2026-01-15");

      await expect(
        registry.connect(officer).registerCase("CASE-B", "Fraud", "2026-01-16", validHash2, "d", [idA, idA])
      )
        .to.be.revertedWithCustomError(registry, "DuplicateRelatedCase")
        .withArgs(idA);
    });

    it("Should reject more than 20 related cases", async function () {
      const { registry, officer, validHash } = await loadFixture(deployRegistryFixture);
      const manyIds: string[] = [];
      for (let i = 0; i < 21; i++) manyIds.push(ethers.zeroPadValue(ethers.toBeHex(i + 1), 32));

      await expect(
        registry.connect(officer).registerCase("CASE-X", "Fraud", "2026-01-15", validHash, "d", manyIds)
      )
        .to.be.revertedWithCustomError(registry, "TooManyRelatedCases")
        .withArgs(21, 20);
    });

    it("Should reject unauthorized registration", async function () {
      const { registry, stranger, validHash, OFFICER_ROLE } = await loadFixture(deployRegistryFixture);
      await expect(
        registry.connect(stranger).registerCase("CASE-Z", "Fraud", "2026-01-15", validHash, "d", [])
      )
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, OFFICER_ROLE);
    });

    it("Should register with valid related cases", async function () {
      const { registry, officer, validHash, validHash2 } = await loadFixture(deployRegistryFixture);
      await registry.connect(officer).registerCase("CASE-PARENT", "Fraud", "2026-01-10", validHash, "parent", []);
      const parentId = await registry.computeCaseId("CASE-PARENT", "2026-01-10");

      await registry.connect(officer).registerCase("CASE-CHILD", "Fraud", "2026-01-11", validHash2, "child", [parentId]);
      const childId = await registry.computeCaseId("CASE-CHILD", "2026-01-11");

      const related = await registry.getRelatedCases(childId);
      expect(related).to.deep.equal([parentId]);

      const relatedTo = await registry.getCasesRelatedTo(parentId);
      expect(relatedTo).to.deep.equal([childId]);
    });
  });

  // ─── Metadata Update ───────────────────────────────────────────────────────

  describe("Metadata Update", function () {
    async function caseFixture() {
      const base = await deployRegistryFixture();
      await base.registry.connect(base.officer).registerCase(
        "CASE-UPDATE", "Robbery", "2026-02-01", base.validHash, "test case", []
      );
      const caseId = await base.registry.computeCaseId("CASE-UPDATE", "2026-02-01");
      return { ...base, caseId };
    }

    it("Should update metadata commitment successfully", async function () {
      const { registry, officer, caseId, validHash2 } = await loadFixture(caseFixture);

      await expect(registry.connect(officer).updateCaseMetadata(caseId, validHash2, "New evidence collected"))
        .to.emit(registry, "CaseMetadataUpdated")
        .withArgs(caseId, validHash2, officer.address, "New evidence collected");

      const rec = await registry.getCase(caseId);
      expect(rec.metadataHash).to.equal(validHash2);
    });

    it("Should reject zero metadata hash on update", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await expect(
        registry.connect(officer).updateCaseMetadata(caseId, ethers.ZeroHash, "reason")
      ).to.be.revertedWithCustomError(registry, "InvalidMetadataHash");
    });

    it("Should reject empty reason on metadata update", async function () {
      const { registry, officer, caseId, validHash2 } = await loadFixture(caseFixture);
      await expect(
        registry.connect(officer).updateCaseMetadata(caseId, validHash2, "")
      ).to.be.revertedWithCustomError(registry, "EmptyReason");
    });

    it("Should reject unauthorized metadata update", async function () {
      const { registry, stranger, caseId, validHash2, OFFICER_ROLE } = await loadFixture(caseFixture);
      await expect(
        registry.connect(stranger).updateCaseMetadata(caseId, validHash2, "reason")
      )
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, OFFICER_ROLE);
    });
  });

  // ─── Status Transitions ────────────────────────────────────────────────────

  describe("Status Transitions", function () {
    async function caseFixture() {
      const base = await deployRegistryFixture();
      await base.registry.connect(base.officer).registerCase(
        "CASE-STATUS", "Assault", "2026-03-01", base.validHash, "status test", []
      );
      const caseId = await base.registry.computeCaseId("CASE-STATUS", "2026-03-01");
      return { ...base, caseId };
    }

    it("Should transition Registered → UnderInvestigation", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await expect(registry.connect(officer).updateCaseStatus(caseId, 1, "Evidence gathered"))
        .to.emit(registry, "CaseStatusChanged")
        .withArgs(caseId, 0, 1, officer.address, "Evidence gathered");
      expect(await registry.getCaseStatus(caseId)).to.equal(1);
    });

    it("Should transition UnderInvestigation → ChargesFiled", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await registry.connect(officer).updateCaseStatus(caseId, 1, "Investigation started");
      await registry.connect(officer).updateCaseStatus(caseId, 2, "Charges prepared");
      expect(await registry.getCaseStatus(caseId)).to.equal(2);
    });

    it("Should transition ChargesFiled → InCourt", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await registry.connect(officer).updateCaseStatus(caseId, 1, "start");
      await registry.connect(officer).updateCaseStatus(caseId, 2, "charges");
      await registry.connect(officer).updateCaseStatus(caseId, 3, "court date set");
      expect(await registry.getCaseStatus(caseId)).to.equal(3);
    });

    it("Should transition InCourt → Closed", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await registry.connect(officer).updateCaseStatus(caseId, 1, "s");
      await registry.connect(officer).updateCaseStatus(caseId, 2, "s");
      await registry.connect(officer).updateCaseStatus(caseId, 3, "s");
      await registry.connect(officer).updateCaseStatus(caseId, 4, "Case closed by court");
      expect(await registry.getCaseStatus(caseId)).to.equal(4);
    });

    it("Should allow Closed → Archived", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await registry.connect(officer).updateCaseStatus(caseId, 4, "closed");
      await registry.connect(officer).updateCaseStatus(caseId, 5, "Archiving after retention period");
      expect(await registry.getCaseStatus(caseId)).to.equal(5);
    });

    it("Should allow Closed → UnderInvestigation (reopen)", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await registry.connect(officer).updateCaseStatus(caseId, 4, "closed");
      await registry.connect(officer).updateCaseStatus(caseId, 1, "New evidence — reopening");
      expect(await registry.getCaseStatus(caseId)).to.equal(1);
    });

    it("Should reject Archived → any transition (terminal)", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await registry.connect(officer).updateCaseStatus(caseId, 4, "c");
      await registry.connect(officer).updateCaseStatus(caseId, 5, "archive");
      await expect(
        registry.connect(officer).updateCaseStatus(caseId, 0, "revert")
      ).to.be.revertedWithCustomError(registry, "InvalidStatusTransition");
    });

    it("Should reject invalid transition Registered → InCourt", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await expect(
        registry.connect(officer).updateCaseStatus(caseId, 3, "skip steps")
      ).to.be.revertedWithCustomError(registry, "InvalidStatusTransition");
    });

    it("Should reject same-status transition", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await expect(
        registry.connect(officer).updateCaseStatus(caseId, 0, "no change")
      ).to.be.revertedWithCustomError(registry, "InvalidStatusTransition");
    });

    it("Should reject empty reason on status change", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await expect(
        registry.connect(officer).updateCaseStatus(caseId, 1, "")
      ).to.be.revertedWithCustomError(registry, "EmptyReason");
    });

    it("Should reject unauthorized status update", async function () {
      const { registry, stranger, caseId } = await loadFixture(caseFixture);
      await expect(
        registry.connect(stranger).updateCaseStatus(caseId, 1, "attempt")
      ).to.be.revertedWith("CaseLedger: caller lacks required role");
    });

    it("Reviewer should also be able to update status", async function () {
      const { registry, reviewer, caseId } = await loadFixture(caseFixture);
      await registry.connect(reviewer).updateCaseStatus(caseId, 1, "Reviewer advancing status");
      expect(await registry.getCaseStatus(caseId)).to.equal(1);
    });
  });

  // ─── Case Reviews ──────────────────────────────────────────────────────────

  describe("Case Reviews", function () {
    async function caseFixture() {
      const base = await deployRegistryFixture();
      await base.registry.connect(base.officer).registerCase(
        "CASE-REVIEW", "Embezzlement", "2026-04-01", base.validHash, "review test", []
      );
      const caseId = await base.registry.computeCaseId("CASE-REVIEW", "2026-04-01");
      return { ...base, caseId };
    }

    it("Should record a case review", async function () {
      const { registry, reviewer, caseId } = await loadFixture(caseFixture);
      const notes = "All documentation verified — record matches commitment";

      await expect(registry.connect(reviewer).recordCaseReview(caseId, 0, notes))
        .to.emit(registry, "CaseReviewRecorded")
        .withArgs(1, caseId, reviewer.address, 0);

      const revs = await registry.getCaseReviews(caseId);
      expect(revs.length).to.equal(1);
      expect(revs[0].reviewer).to.equal(reviewer.address);
      expect(revs[0].category).to.equal(0);
      expect(revs[0].notes).to.equal(notes);
      expect(await registry.reviewCount()).to.equal(1);
    });

    it("Should reject empty notes", async function () {
      const { registry, reviewer, caseId } = await loadFixture(caseFixture);
      await expect(
        registry.connect(reviewer).recordCaseReview(caseId, 1, "")
      ).to.be.revertedWithCustomError(registry, "EmptyNotes");
    });

    it("Should reject review for unknown case", async function () {
      const { registry, reviewer } = await loadFixture(caseFixture);
      const unknownId = ethers.keccak256(ethers.toUtf8Bytes("ghost@2020-01-01"));
      await expect(
        registry.connect(reviewer).recordCaseReview(unknownId, 0, "notes")
      )
        .to.be.revertedWithCustomError(registry, "CaseNotFound")
        .withArgs(unknownId);
    });

    it("Should reject unauthorized review", async function () {
      const { registry, stranger, caseId, REVIEWER_ROLE } = await loadFixture(caseFixture);
      await expect(
        registry.connect(stranger).recordCaseReview(caseId, 0, "notes")
      )
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(stranger.address, REVIEWER_ROLE);
    });
  });

  // ─── Case Updates ──────────────────────────────────────────────────────────

  describe("Case Updates", function () {
    async function caseFixture() {
      const base = await deployRegistryFixture();
      await base.registry.connect(base.officer).registerCase(
        "CASE-UPDT", "Arson", "2026-05-01", base.validHash, "update test", []
      );
      const caseId = await base.registry.computeCaseId("CASE-UPDT", "2026-05-01");
      return { ...base, caseId };
    }

    it("Should report a case update", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);

      await expect(registry.connect(officer).reportCaseUpdate(caseId, "Witness identified", 3))
        .to.emit(registry, "CaseUpdateReported")
        .withArgs(1, caseId, officer.address, 3);

      const upds = await registry.getCaseUpdates(caseId);
      expect(upds.length).to.equal(1);
      expect(upds[0].priority).to.equal(3);
      expect(upds[0].acknowledged).to.be.false;
      expect(await registry.updateCount()).to.equal(1);
    });

    it("Should acknowledge a case update", async function () {
      const { registry, officer, reviewer, caseId } = await loadFixture(caseFixture);
      await registry.connect(officer).reportCaseUpdate(caseId, "Update summary", 2);

      await expect(registry.connect(reviewer).acknowledgeCaseUpdate(1, caseId))
        .to.emit(registry, "CaseUpdateAcknowledged")
        .withArgs(1, caseId, reviewer.address);

      const upds = await registry.getCaseUpdates(caseId);
      expect(upds[0].acknowledged).to.be.true;
    });

    it("Should reject invalid priority (0)", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await expect(
        registry.connect(officer).reportCaseUpdate(caseId, "summary", 0)
      ).to.be.revertedWithCustomError(registry, "InvalidPriority").withArgs(0);
    });

    it("Should reject invalid priority (6)", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await expect(
        registry.connect(officer).reportCaseUpdate(caseId, "summary", 6)
      ).to.be.revertedWithCustomError(registry, "InvalidPriority").withArgs(6);
    });

    it("Should reject double acknowledgement", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await registry.connect(officer).reportCaseUpdate(caseId, "summary", 1);
      await registry.connect(officer).acknowledgeCaseUpdate(1, caseId);
      await expect(
        registry.connect(officer).acknowledgeCaseUpdate(1, caseId)
      ).to.be.revertedWithCustomError(registry, "UpdateAlreadyAcknowledged").withArgs(1);
    });

    it("Should reject acknowledging non-existent update", async function () {
      const { registry, officer, caseId } = await loadFixture(caseFixture);
      await expect(
        registry.connect(officer).acknowledgeCaseUpdate(999, caseId)
      ).to.be.revertedWithCustomError(registry, "UpdateNotFound").withArgs(999);
    });

    it("Should reject unauthorized update report", async function () {
      const { registry, stranger, caseId } = await loadFixture(caseFixture);
      await expect(
        registry.connect(stranger).reportCaseUpdate(caseId, "summary", 2)
      ).to.be.revertedWith("CaseLedger: caller lacks required role");
    });
  });

  // ─── Integrity Commitment ─────────────────────────────────────────────────

  describe("Integrity Commitment", function () {
    it("computeCaseId should match frontend keccak encoding", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);
      const ref  = "CASE-DEMO-001";
      const date = "2026-01-15";
      const onChain  = await registry.computeCaseId(ref, date);
      const offChain = ethers.keccak256(ethers.toUtf8Bytes(`${ref}@${date}`));
      expect(onChain).to.equal(offChain);
    });

    it("Different metadata hashes should be detectable as mismatch", async function () {
      const { registry, officer } = await loadFixture(deployRegistryFixture);
      const originalHash  = ethers.zeroPadValue("0xAAAA", 32);
      const tamperedHash  = ethers.zeroPadValue("0xBBBB", 32);

      await registry.connect(officer).registerCase(
        "CASE-INTEGRITY", "Fraud", "2026-06-01", originalHash, "integrity test", []
      );
      const caseId = await registry.computeCaseId("CASE-INTEGRITY", "2026-06-01");
      const rec = await registry.getCase(caseId);

      expect(rec.metadataHash).to.equal(originalHash);
      expect(rec.metadataHash).to.not.equal(tamperedHash);
    });

    it("After metadata update, new hash is stored and audit event emitted", async function () {
      const { registry, officer } = await loadFixture(deployRegistryFixture);
      const h1 = ethers.zeroPadValue("0x1111", 32);
      const h2 = ethers.zeroPadValue("0x2222", 32);

      await registry.connect(officer).registerCase(
        "CASE-COMMIT", "Theft", "2026-06-02", h1, "commit test", []
      );
      const caseId = await registry.computeCaseId("CASE-COMMIT", "2026-06-02");

      await expect(registry.connect(officer).updateCaseMetadata(caseId, h2, "Evidence updated"))
        .to.emit(registry, "CaseMetadataUpdated")
        .withArgs(caseId, h2, officer.address, "Evidence updated");

      const rec = await registry.getCase(caseId);
      expect(rec.metadataHash).to.equal(h2);
    });
  });

  // ─── Role Management ───────────────────────────────────────────────────────

  describe("Role Management", function () {
    it("Admin should grant OFFICER_ROLE", async function () {
      const { registry, admin, stranger, OFFICER_ROLE } = await loadFixture(deployRegistryFixture);
      expect(await registry.hasRole(OFFICER_ROLE, stranger.address)).to.be.false;

      await expect(registry.connect(admin).grantOfficerRole(stranger.address))
        .to.emit(registry, "RoleGranted_CL")
        .withArgs(stranger.address, OFFICER_ROLE, admin.address);

      expect(await registry.hasRole(OFFICER_ROLE, stranger.address)).to.be.true;
    });

    it("Admin should revoke OFFICER_ROLE", async function () {
      const { registry, admin, officer, OFFICER_ROLE } = await loadFixture(deployRegistryFixture);
      await expect(registry.connect(admin).revokeOfficerRole(officer.address))
        .to.emit(registry, "RoleRevoked_CL")
        .withArgs(officer.address, OFFICER_ROLE, admin.address);
      expect(await registry.hasRole(OFFICER_ROLE, officer.address)).to.be.false;
    });

    it("Admin should grant REVIEWER_ROLE", async function () {
      const { registry, admin, stranger, REVIEWER_ROLE } = await loadFixture(deployRegistryFixture);
      await expect(registry.connect(admin).grantReviewerRole(stranger.address))
        .to.emit(registry, "RoleGranted_CL")
        .withArgs(stranger.address, REVIEWER_ROLE, admin.address);
      expect(await registry.hasRole(REVIEWER_ROLE, stranger.address)).to.be.true;
    });

    it("Admin should revoke REVIEWER_ROLE", async function () {
      const { registry, admin, reviewer, REVIEWER_ROLE } = await loadFixture(deployRegistryFixture);
      await expect(registry.connect(admin).revokeReviewerRole(reviewer.address))
        .to.emit(registry, "RoleRevoked_CL")
        .withArgs(reviewer.address, REVIEWER_ROLE, admin.address);
      expect(await registry.hasRole(REVIEWER_ROLE, reviewer.address)).to.be.false;
    });

    it("Non-admin should not grant roles", async function () {
      const { registry, officer, stranger, DEFAULT_ADMIN_ROLE } = await loadFixture(deployRegistryFixture);
      await expect(registry.connect(officer).grantOfficerRole(stranger.address))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount")
        .withArgs(officer.address, DEFAULT_ADMIN_ROLE);
    });
  });

  // ─── View Functions ────────────────────────────────────────────────────────

  describe("View Functions", function () {
    it("Should return all case IDs", async function () {
      const { registry, officer, validHash, validHash2 } = await loadFixture(deployRegistryFixture);
      await registry.connect(officer).registerCase("CASE-A", "Fraud", "2026-07-01", validHash, "a", []);
      await registry.connect(officer).registerCase("CASE-B", "Theft", "2026-07-02", validHash2, "b", []);
      const idA = await registry.computeCaseId("CASE-A", "2026-07-01");
      const idB = await registry.computeCaseId("CASE-B", "2026-07-02");
      const all = await registry.getAllCaseIds();
      expect(all).to.deep.equal([idA, idB]);
    });

    it("Should return correct case count", async function () {
      const { registry, officer, validHash } = await loadFixture(deployRegistryFixture);
      expect(await registry.getCaseCount()).to.equal(0);
      await registry.connect(officer).registerCase("CASE-C", "Fraud", "2026-07-03", validHash, "c", []);
      expect(await registry.getCaseCount()).to.equal(1);
    });

    it("Should revert getCase for unknown ID", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);
      const unknown = ethers.keccak256(ethers.toUtf8Bytes("unknown@2020-01-01"));
      await expect(registry.getCase(unknown))
        .to.be.revertedWithCustomError(registry, "CaseNotFound")
        .withArgs(unknown);
    });

    it("Should revert getCaseStatus for unknown ID", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);
      const unknown = ethers.keccak256(ethers.toUtf8Bytes("ghost@2020-01-01"));
      await expect(registry.getCaseStatus(unknown))
        .to.be.revertedWithCustomError(registry, "CaseNotFound")
        .withArgs(unknown);
    });

    it("Historical events are preserved after status change", async function () {
      const { registry, officer, validHash } = await loadFixture(deployRegistryFixture);
      await registry.connect(officer).registerCase("CASE-HIST", "Fraud", "2026-08-01", validHash, "h", []);
      const caseId = await registry.computeCaseId("CASE-HIST", "2026-08-01");

      // Filter for status changed events — should accumulate
      const filter = registry.filters.CaseStatusChanged(caseId);
      await registry.connect(officer).updateCaseStatus(caseId, 1, "step1");
      await registry.connect(officer).updateCaseStatus(caseId, 2, "step2");
      const evts = await registry.queryFilter(filter);
      expect(evts.length).to.equal(2);
    });
  });
});
