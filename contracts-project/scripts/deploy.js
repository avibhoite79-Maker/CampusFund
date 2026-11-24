const hre = require("hardhat");

async function main() {
  const fund = await hre.ethers.deployContract("CampusFund");
  await fund.waitForDeployment();
  console.log("CampusFund deployed to:", await fund.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});