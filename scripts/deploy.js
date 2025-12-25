import hre from "hardhat";

async function main() {
  console.log("Đang chuẩn bị deploy...");

  // 1. Lấy bản thiết kế của Contract
  const CrowdFunding = await hre.ethers.getContractFactory("CrowdFunding");

  // 2. Deploy lên mạng
  const crowdFunding = await CrowdFunding.deploy();

  // 3. Chờ xác nhận
  await crowdFunding.waitForDeployment();

  // 4. Lấy địa chỉ
  const address = await crowdFunding.getAddress();

  console.log("----------------------------------------------------");
  console.log("🎉 CHÚC MỪNG! Contract đã deploy thành công!");
  console.log("👉 Địa chỉ Contract: " + address);
  console.log("----------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});