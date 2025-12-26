# Charity DApp

**Mô tả ngắn:**
Charity DApp là một ví dụ nền tảng gây quỹ từ thiện minh bạch trên Ethereum. Dự án bao gồm một smart contract `CrowdFunding.sol` (Hardhat) và giao diện frontend React (Vite) để tạo chiến dịch, quyên góp, yêu cầu rút tiền theo milestone, vote của người quyên góp, và hoàn tiền khi chiến dịch thất bại.

---

## 🔧 Tính năng chính

- Tạo chiến dịch (title, description, target, deadline, image)
- Quyên góp (payable)
- Hoàn tiền nếu campaign không đạt mục tiêu sau deadline
- Chủ chiến dịch tạo *requests* rút tiền (milestones)
- Người quyên góp bỏ phiếu cho request; chỉ khi >50% đồng ý thì owner có thể rút
- API contract: `createCampaign`, `donateToCampaign`, `refund`, `createRequest`, `approveRequest`, `finalizeRequest`, `getCampaigns`, `getDonators`, `getRequestDetails`, `getRequestsCount`

---

## Yêu cầu (Prerequisites)

- Node.js (>= 18 recommended)
- npm hoặc yarn
- MetaMask (hoặc wallet tương thích Web3)
- Mạng Sepolia (hoặc Hardhat local) và private key có ETH khi deploy trên testnet

---

## Cài đặt & Chạy (Local)

1. Clone repo

```bash
git clone <repo-url>
cd charity-dapp
```

2. Cài đặt phụ thuộc cho root (Hardhat) và frontend

```bash
# root (hardhat)
npm install

# frontend
cd client
npm install
```

3. Chạy frontend

```bash
cd client
npm run dev
# -> Mở http://localhost:5173
```

4. Chạy Hardhat local (tuỳ chọn)

```bash
npx hardhat node
# Trong terminal khác, deploy lên localhost
npx hardhat run scripts/deploy.js --network localhost
```

---

## Triển khai lên Sepolia (Testnet)

1. Tạo file `.env` ở root với các biến (ví dụ):

```
SEPOLIA_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
PRIVATE_KEY="0xYOUR_PRIVATE_KEY"
```

2. Deploy

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

> Lưu ý: script `deploy.js` kiểm tra chainId để cảnh báo nếu bạn không phải Sepolia.

---

## Frontend

- Frontend dùng React + Vite và `ethers` v6.
- Contract address hiện đang cứng trong `client/src/App.jsx` (biến `contractAddress`):

```js
const contractAddress = "0x015a8FF766bC931c33c3b0d227f210C651485b1a";
```

Hãy cập nhật địa chỉ này nếu bạn deploy contract mới.

Các hành động chính: kết nối MetaMask, tạo campaign, donate (nhập ETH), request (owner), approve (donator), finalize (owner), refund (donator sau khi campaign thất bại).

---

## Một số lưu ý kỹ thuật & bảo mật

- `refund` chỉ cho phép khi `deadline` đã qua và `amountCollected < target`.
- `finalizeRequest` yêu cầu owner gọi và request phải có >50% số người donate đã approve.
- `createRequest` kiểm tra balance của hợp đồng (đơn giản) — trên production cần quản lý balance per-campaign kỹ hơn.
- Frontend dùng `ethers.BrowserProvider` và signer để gửi giao dịch (tương thích MetaMask).

---

## Debugging / Troubleshooting

- Nếu gặp lỗi `You have no contributions` khi refund: kiểm tra xem địa chỉ đã từng donate cho campaign đó chưa.
- Nếu không thể tạo request: chỉ owner campaign mới được phép.
- Nếu smart contract gọi `call exception`: kiểm tra revert message, dữ liệu input (deadline phải là thời gian tương lai, value phải hợp lệ).

---

## Thêm thông tin

- Contracts: `contracts/CrowdFunding.sol`
- Deploy script: `scripts/deploy.js`
- Frontend entry: `client/src/App.jsx`
- ABI: `client/src/abi/CrowdFunding.json`

---

## Góp ý & License

- **Author:**
- **License:** MIT (hoặc chọn license phù hợp)

---
