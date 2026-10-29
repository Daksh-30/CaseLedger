import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying CaseLedgerRegistry with account:", deployer.address);

  const CaseLedgerRegistry = await ethers.getContractFactory("CaseLedgerRegistry");
  const registry = await CaseLedgerRegistry.deploy();
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log("CaseLedgerRegistry deployed to:", registryAddress);

  const artifact = await ethers.getContractFactory("CaseLedgerRegistry");
  const contractInterface = artifact.interface.formatJson();
  const parsedAbi = JSON.parse(contractInterface);

  const outputDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "CaseLedgerRegistry.json");
  const contractData = { address: registryAddress, abi: parsedAbi };

  fs.writeFileSync(outputPath, JSON.stringify(contractData, null, 2), "utf-8");
  console.log(`Saved deployment artifact to ${outputPath}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
