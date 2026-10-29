import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Seed script for CaseLedger demo environment.
 * Uses FICTIONAL identities only. No real persons, real cases, or real criminal data.
 */
async function main() {
  const [admin, officer1, officer2, reviewer] = await ethers.getSigners();
  console.log("Seeding CaseLedger with accounts:");
  console.log("Admin:     ", admin.address);
  console.log("Officer 1: ", officer1.address);
  console.log("Officer 2: ", officer2.address);
  console.log("Reviewer:  ", reviewer.address);

  const artifactPath = path.join(
    __dirname, "..", "frontend", "src", "contracts", "CaseLedgerRegistry.json"
  );

  let registry: any;
  let registryAddress: string;

  if (fs.existsSync(artifactPath)) {
    const data = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const code = await ethers.provider.getCode(data.address);
    if (code !== "0x") {
      registryAddress = data.address;
      registry = await ethers.getContractAt("CaseLedgerRegistry", registryAddress);
      console.log("Connected to existing CaseLedgerRegistry at:", registryAddress);
    }
  }

  if (!registry) {
    console.log("Deploying new CaseLedgerRegistry instance for seeding...");
    const factory = await ethers.getContractFactory("CaseLedgerRegistry", admin);
    registry = await factory.deploy();
    await registry.waitForDeployment();
    registryAddress = await registry.getAddress();
    console.log("Deployed CaseLedgerRegistry at:", registryAddress);

    const outputDir = path.dirname(artifactPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const contractInterface = factory.interface.formatJson();
    fs.writeFileSync(
      artifactPath,
      JSON.stringify({ address: registryAddress, abi: JSON.parse(contractInterface) }, null, 2),
      "utf-8"
    );
  }

  console.log("\n--- Granting Roles ---");
  const OFFICER_ROLE  = await registry.OFFICER_ROLE();
  const REVIEWER_ROLE = await registry.REVIEWER_ROLE();

  if (!(await registry.hasRole(OFFICER_ROLE, officer1.address))) {
    const tx = await registry.connect(admin).grantOfficerRole(officer1.address);
    await tx.wait();
    console.log("Granted OFFICER_ROLE to", officer1.address);
  }

  if (!(await registry.hasRole(OFFICER_ROLE, officer2.address))) {
    const tx = await registry.connect(admin).grantOfficerRole(officer2.address);
    await tx.wait();
    console.log("Granted OFFICER_ROLE to", officer2.address);
  }

  if (!(await registry.hasRole(REVIEWER_ROLE, reviewer.address))) {
    const tx = await registry.connect(admin).grantReviewerRole(reviewer.address);
    await tx.wait();
    console.log("Granted REVIEWER_ROLE to", reviewer.address);
  }

  console.log("\n--- Registering Demo Cases (fictional data only) ---");

  // Metadata hashes represent SHA-256 commitments of fictional off-chain documents
  const h1 = ethers.zeroPadValue("0x1111", 32);
  const h2 = ethers.zeroPadValue("0x2222", 32);
  const h3 = ethers.zeroPadValue("0x3333", 32);
  const h4 = ethers.zeroPadValue("0x4444", 32);

  const id1 = await registry.computeCaseId("CASE-DEMO-001", "2026-01-10");
  const id2 = await registry.computeCaseId("CASE-DEMO-002", "2026-01-18");
  const id3 = await registry.computeCaseId("CASE-DEMO-003", "2026-02-05");
  const id4 = await registry.computeCaseId("CASE-DEMO-004", "2026-03-12");

  // CASE-DEMO-001 — Fraud (Registered status)
  try {
    await registry.getCase(id1);
    console.log("CASE-DEMO-001 already registered");
  } catch {
    const tx = await registry.connect(officer1).registerCase(
      "CASE-DEMO-001", "Fraud", "2026-01-10", h1,
      "Fictional: alleged financial misrepresentation involving a fictitious company",
      []
    );
    await tx.wait();
    console.log("Registered CASE-DEMO-001 (Fraud)");
  }

  // CASE-DEMO-002 — Theft, related to CASE-DEMO-001 (UnderInvestigation)
  try {
    await registry.getCase(id2);
    console.log("CASE-DEMO-002 already registered");
  } catch {
    const tx = await registry.connect(officer1).registerCase(
      "CASE-DEMO-002", "Theft", "2026-01-18", h2,
      "Fictional: alleged property theft linked to CASE-DEMO-001 suspect",
      [id1]
    );
    await tx.wait();
    console.log("Registered CASE-DEMO-002 (Theft, related to CASE-DEMO-001)");
    const tx2 = await registry.connect(officer1).updateCaseStatus(
      id2, 1, "Initial investigation commenced"
    );
    await tx2.wait();
    console.log("Advanced CASE-DEMO-002 to UnderInvestigation");
  }

  // CASE-DEMO-003 — Assault (ChargesFiled)
  try {
    await registry.getCase(id3);
    console.log("CASE-DEMO-003 already registered");
  } catch {
    const tx = await registry.connect(officer2).registerCase(
      "CASE-DEMO-003", "Assault", "2026-02-05", h3,
      "Fictional: alleged assault in a public space — no real persons involved",
      []
    );
    await tx.wait();
    console.log("Registered CASE-DEMO-003 (Assault)");
    await (await registry.connect(officer2).updateCaseStatus(id3, 1, "Evidence collected")).wait();
    await (await registry.connect(officer2).updateCaseStatus(id3, 2, "Charges prepared and filed")).wait();
    console.log("Advanced CASE-DEMO-003 to ChargesFiled");
  }

  // CASE-DEMO-004 — Cybercrime (Closed — demonstrates full lifecycle)
  try {
    await registry.getCase(id4);
    console.log("CASE-DEMO-004 already registered");
  } catch {
    const tx = await registry.connect(officer1).registerCase(
      "CASE-DEMO-004", "Cybercrime", "2026-03-12", h4,
      "Fictional: alleged unauthorised access to a fictitious computer system",
      []
    );
    await tx.wait();
    console.log("Registered CASE-DEMO-004 (Cybercrime)");
    await (await registry.connect(officer1).updateCaseStatus(id4, 1, "Digital evidence secured")).wait();
    await (await registry.connect(officer1).updateCaseStatus(id4, 2, "Charges filed")).wait();
    await (await registry.connect(officer1).updateCaseStatus(id4, 3, "Referred to court")).wait();
    await (await registry.connect(officer1).updateCaseStatus(id4, 4, "Court proceedings concluded")).wait();
    console.log("Advanced CASE-DEMO-004 to Closed");
  }

  console.log("\n--- Adding Case Review ---");
  const reviews = await registry.getCaseReviews(id1);
  if (reviews.length === 0) {
    const tx = await registry.connect(reviewer).recordCaseReview(
      id1, 0,
      "Record integrity verified — metadata hash matches filed documentation"
    );
    await tx.wait();
    console.log("Added IntegrityVerification review to CASE-DEMO-001");
  }

  console.log("\n--- Reporting a Case Update on CASE-DEMO-002 ---");
  const existingUpdates = await registry.getCaseUpdates(id2);
  if (existingUpdates.length === 0) {
    const tx = await registry.connect(reviewer).reportCaseUpdate(
      id2, "New witness statement received — corroborates initial findings", 3
    );
    await tx.wait();
    console.log("Reported Priority-3 update on CASE-DEMO-002");
  }

  console.log("\n--- Seed script completed successfully! ---");
  console.log("\nDemo cases registered:");
  console.log("  CASE-DEMO-001 (Fraud)       — Registered");
  console.log("  CASE-DEMO-002 (Theft)       — UnderInvestigation  ← has update");
  console.log("  CASE-DEMO-003 (Assault)     — ChargesFiled");
  console.log("  CASE-DEMO-004 (Cybercrime)  — Closed (full lifecycle demo)");
  console.log("\nAll identities are fictional. No real persons or real criminal data.");
}

main().catch((error) => {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
});
