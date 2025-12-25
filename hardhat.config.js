import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Nạp các biến từ file .env vào
dotenv.config();

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: "0.8.28", // Đảm bảo version này khớp với file .sol
  networks: {
    // Cấu hình mạng Localhost (giữ lại để test nếu cần)
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Cấu hình mạng Sepolia
    sepolia: {
      url: process.env.SEPOLIA_URL,
      accounts: [process.env.PRIVATE_KEY], // Hardhat sẽ dùng ví này để trả phí gas
    },
  },
};

export default config;