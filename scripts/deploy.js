import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const provider = deployer.provider;

  // --- 1. KIỂM TRA MẠNG (QUAN TRỌNG NHẤT) ---
  const network = await provider.getNetwork();
  
  console.log("----------------------------------------------------");
  console.log("🌍 Đang kết nối tới mạng có Chain ID:", network.chainId.toString());
  
  if (network.chainId.toString() === "11155111") {
      console.log("✅ ĐÚNG LÀ MẠNG SEPOLIA!");
  } else if (network.chainId.toString() === "1") {
      console.log("❌ SAI RỒI! ĐÂY LÀ ETHEREUM MAINNET (Mạng thật)");
  } else if (network.chainId.toString() === "31337") {
      console.log("❌ SAI RỒI! ĐÂY LÀ HARDHAT LOCALHOST (Mạng ảo)");
  } else {
      console.log("⚠️ Mạng lạ, không phải Sepolia.");
  }

  // --- 2. KIỂM TRA VÍ ---
  console.log("👉 Địa chỉ ví:", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("💰 Số dư:", hre.ethers.formatEther(balance), "ETH");
  console.log("----------------------------------------------------");

  if (balance.toString() === "0") {
    console.error("⛔ DỪNG LẠI: Ví 0 ETH thì không thể deploy.");
    return;
  }

  // --- 3. DEPLOY ---
  console.log("🚀 Đang deploy...");
  const CrowdFunding = await hre.ethers.getContractFactory("CrowdFunding");
  const crowdFunding = await CrowdFunding.deploy();
  await crowdFunding.waitForDeployment();
  console.log("🎉 Thành công! Contract Address:", await crowdFunding.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});