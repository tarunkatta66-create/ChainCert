const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Compiling and deploying ChainCert smart contract...");

  // Get the ContractFactory for ChainCert
  const ChainCert = await hre.ethers.getContractFactory("ChainCert");

  // Deploy the contract
  const chainCert = await ChainCert.deploy();

  // Wait for the deployment to finish
  await chainCert.waitForDeployment();

  const contractAddress = await chainCert.getAddress();
  console.log(`ChainCert contract deployed successfully to address: ${contractAddress}`);

  // Fetch the artifacts to get the ABI
  const artifactPath = path.join(__dirname, "../artifacts/contracts/ChainCert.sol/ChainCert.json");
  const contractArtifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  
  const contractInfo = {
    address: contractAddress,
    abi: contractArtifact.abi
  };

  // Export to api/contract_info.json
  const apiDir = path.join(__dirname, "../api");
  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
  }
  const apiFilePath = path.join(apiDir, "contract_info.json");
  fs.writeFileSync(apiFilePath, JSON.stringify(contractInfo, null, 2), "utf8");
  console.log(`Exported contract info to: ${apiFilePath}`);

  // Export to frontend/src/contract_info.json
  const frontendSrcDir = path.join(__dirname, "../frontend/src");
  if (!fs.existsSync(frontendSrcDir)) {
    fs.mkdirSync(frontendSrcDir, { recursive: true });
  }
  const frontendFilePath = path.join(frontendSrcDir, "contract_info.json");
  fs.writeFileSync(frontendFilePath, JSON.stringify(contractInfo, null, 2), "utf8");
  console.log(`Exported contract info to: ${frontendFilePath}`);

  console.log("Deployment and environment setup complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
