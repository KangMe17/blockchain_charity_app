import { useState, useEffect } from "react";
import { ethers } from "ethers";
import CrowdFundingABI from "./abi/CrowdFunding.json";

// ⚠️ THAY ĐỊA CHỈ CONTRACT CỦA BẠN VÀO ĐÂY
const contractAddress = "0x8cf53EdF377F6534e932a8592d9Dd7a020379edc";

function App() {
  const [account, setAccount] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [donators, setDonators] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentCampaignTitle, setCurrentCampaignTitle] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    target: "",
    deadline: "",
    image: "",
  });

  // Kết nối ví MetaMask
  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) return alert("Vui lòng cài đặt MetaMask!");
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
    } catch (error) {
      console.error(error);
    }
  };

  // Lấy danh sách chiến dịch
  const fetchCampaigns = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) return;

      const provider = new ethers.BrowserProvider(ethereum);
      const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, provider);
      const data = await contract.getCampaigns();

      const parsedData = data.map((campaign, i) => ({
        id: i,
        owner: campaign.owner,
        title: campaign.title,
        description: campaign.description,
        target: ethers.formatEther(campaign.target),
        amountCollected: ethers.formatEther(campaign.amountCollected),
        deadline: new Date(Number(campaign.deadline) * 1000).toLocaleDateString("vi-VN"),
        deadlineTimestamp: Number(campaign.deadline),
        image: campaign.image || "https://via.placeholder.com/800x400?text=Charity+Campaign",
        claimed: campaign.claimed,
      }));

      setCampaigns(parsedData);
    } catch (error) {
      console.log("Lỗi tải chiến dịch:", error);
    }
  };

  useEffect(() => {
    if (account) fetchCampaigns();
  }, [account]);

  // Tạo chiến dịch mới
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { ethereum } = window;
      if (!ethereum) return;

      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, signer);

      const targetInWei = ethers.parseEther(form.target);
      const deadlineDate = Math.floor(new Date(form.deadline).getTime() / 1000);

      const tx = await contract.createCampaign(
        account,
        form.title,
        form.description,
        targetInWei,
        deadlineDate,
        form.image
      );
      await tx.wait();

      alert("Tạo chiến dịch thành công! 🤲");
      setForm({ title: "", description: "", target: "", deadline: "", image: "" });
      fetchCampaigns();
    } catch (error) {
      alert("Lỗi: " + (error.reason || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Quyên góp
  const handleDonate = async (id) => {
    try {
      const { ethereum } = window;
      if (!ethereum) return;

      const amount = prompt("Nhập số ETH bạn muốn quyên góp (ví dụ: 0.1):");
      if (!amount || parseFloat(amount) <= 0) return;

      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, signer);

      const tx = await contract.donateToCampaign(id, {
        value: ethers.parseEther(amount),
      });
      setIsLoading(true);
      await tx.wait();

      alert("Cảm ơn trái tim nhân ái của bạn! ❤️");
      fetchCampaigns();
    } catch (error) {
      alert("Giao dịch thất bại: " + (error.reason || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Xem lịch sử quyên góp & rút tiền
  const handleGetDonators = async (id, title) => {
    try {
      const { ethereum } = window;
      if (!ethereum) return;

      const provider = new ethers.BrowserProvider(ethereum);
      const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, provider);

      const result = await contract.getDonators(id);
      let historyList = result[0].map((donator, i) => ({
        type: "donate",
        donator,
        amount: ethers.formatEther(result[1][i]),
        timestamp: 0,
      }));

      const filter = contract.filters.FundsWithdrawn(id);
      const events = await contract.queryFilter(filter);

      events.forEach((event) => {
        historyList.push({
          type: "withdraw",
          donator: event.args[1],
          amount: ethers.formatEther(event.args[2]),
          timestamp: Number(event.args[3]),
        });
      });

      setDonators(historyList);
      setCurrentCampaignTitle(title);
      setShowModal(true);
    } catch (error) {
      console.log("Lỗi lấy lịch sử:", error);
    }
  };

  // Rút tiền (chỉ chủ sở hữu)
  const handleWithdraw = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn rút toàn bộ tiền về ví?")) return;

    try {
      const { ethereum } = window;
      if (!ethereum) return;

      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, signer);

      const tx = await contract.withdraw(id);
      setIsLoading(true);
      await tx.wait();

      alert("Rút tiền thành công! 💸");
      fetchCampaigns();
    } catch (error) {
      alert("Lỗi rút tiền: " + (error.reason || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const displayedCampaigns = activeTab === "all"
    ? campaigns
    : campaigns.filter((camp) => camp.owner.toLowerCase() === account.toLowerCase());

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", fontFamily: "'Segoe UI', sans-serif, Arial" }}>
      {/* HERO HEADER - FULL WIDTH */}
      <header style={{
        background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        color: "white",
        padding: "120px 20px 100px",
        textAlign: "center",
        width: "100%",
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h1 style={{ fontSize: "52px", fontWeight: "900", margin: "0 0 20px" }}>
            🤝 Charity Chain
          </h1>
          <p style={{ fontSize: "24px", maxWidth: "900px", margin: "0 auto 40px", opacity: 0.95 }}>
            Nền tảng quyên góp từ thiện minh bạch trên blockchain – Mọi đóng góp đều có ý nghĩa.
          </p>
          {!account ? (
            <button onClick={connectWallet} style={{ ...primaryBtn, padding: "16px 40px", fontSize: "20px" }}>
              🦊 Kết nối MetaMask
            </button>
          ) : (
            <div style={{
              padding: "14px 32px",
              background: "rgba(255,255,255,0.25)",
              borderRadius: "50px",
              backdropFilter: "blur(10px)",
              display: "inline-block",
              fontSize: "18px",
              fontWeight: "bold"
            }}>
              👤 {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          )}
        </div>
      </header>

      {/* NỘI DUNG CHÍNH - FULL WIDTH */}
      <div style={{ width: "100%", padding: "0 20px" }}>

        {/* Form tạo chiến dịch */}
        {account && (
          <div style={{
            maxWidth: "1000px",
            margin: "0 auto 60px auto",
            background: "white",
            padding: "40px",
            borderRadius: "20px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ color: "#2c7a7b", fontSize: "28px", textAlign: "center", marginBottom: "30px" }}>
              🌱 Tạo Chiến Dịch Từ Thiện Mới
            </h3>
            <form onSubmit={handleCreateCampaign} style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
              <input placeholder="Tên chiến dịch" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              <input placeholder="Mục tiêu (ETH)" type="number" step="0.0001" min="0.01" required value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} style={inputStyle} />
              <input type="date" required value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} style={inputStyle} />
              <input placeholder="Link ảnh (URL)" required value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              <textarea placeholder="Mô tả chi tiết về mục đích từ thiện..." required rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              <button type="submit" disabled={isLoading} style={{ ...primaryBtn, gridColumn: "1 / -1", padding: "16px" }}>
                {isLoading ? "⏳ Đang xử lý..." : "✨ Khởi Tạo Chiến Dịch"}
              </button>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div style={{ textAlign: "center", marginBottom: "50px" }}>
          <button onClick={() => setActiveTab("all")} style={{ ...tabStyle, color: activeTab === "all" ? "#38a169" : "#666", borderBottom: activeTab === "all" ? "4px solid #38a169" : "none" }}>
            🌍 Tất Cả Chiến Dịch
          </button>
          <button onClick={() => setActiveTab("my_campaigns")} style={{ ...tabStyle, color: activeTab === "my_campaigns" ? "#38a169" : "#666", borderBottom: activeTab === "my_campaigns" ? "4px solid #38a169" : "none" }}>
            👤 Chiến Dịch Của Tôi
          </button>
        </div>

        {/* Danh sách chiến dịch - FULL WIDTH GRID */}
        <div style={{
          maxWidth: "1600px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: "30px",
          padding: "0 10px"
        }}>
          {displayedCampaigns.length === 0 ? (
            <p style={{ gridColumn: "1 / -1", textAlign: "center", fontSize: "22px", color: "#666", margin: "60px 0" }}>
              Chưa có chiến dịch nào. Hãy là người đầu tiên lan tỏa yêu thương! 🌱
            </p>
          ) : (
            displayedCampaigns.map((camp) => {
              const isExpired = Date.now() > camp.deadlineTimestamp * 1000;
              const isTargetMet = parseFloat(camp.amountCollected) >= parseFloat(camp.target);
              const isOwner = account.toLowerCase() === camp.owner.toLowerCase();
              const progress = Math.min((parseFloat(camp.amountCollected) / parseFloat(camp.target)) * 100, 100);

              return (
                <div key={camp.id} style={{
                  background: "white",
                  borderRadius: "20px",
                  overflow: "hidden",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                  transition: "transform 0.3s ease",
                }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-10px)"} onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                  {isTargetMet && <span style={badgeSuccess}>🎉 Đạt mục tiêu</span>}
                  {isExpired && !isTargetMet && <span style={badgeExpired}>⛔ Đã kết thúc</span>}
                  {camp.claimed && <span style={badgeClaimed}>💸 Đã rút tiền</span>}

                  <img src={camp.image} alt={camp.title} style={{ width: "100%", height: "220px", objectFit: "cover" }} onError={(e) => e.target.src = "https://via.placeholder.com/800x400?text=Charity+Image"} />

                  <div style={{ padding: "25px" }}>
                    <h4 style={{ fontSize: "20px", fontWeight: "bold", color: "#2d3748", margin: "0 0 12px" }}>
                      {camp.title}
                    </h4>
                    <p style={{ color: "#718096", lineHeight: "1.6", marginBottom: "20px" }}>
                      {camp.description.slice(0, 130)}{camp.description.length > 130 ? "..." : ""}
                    </p>

                    <div style={{ background: "#f7fafc", padding: "16px", borderRadius: "12px", marginBottom: "20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                        <span>🎯 Mục tiêu</span>
                        <strong style={{ color: "#2c7a7b" }}>{camp.target} ETH</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
                        <span>❤️ Đã quyên góp</span>
                        <strong style={{ color: "#38a169" }}>{camp.amountCollected} ETH</strong>
                      </div>
                      <div style={{ height: "12px", background: "#e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{
                          width: `${progress}%`,
                          height: "100%",
                          background: isTargetMet ? "#48bb78" : "linear-gradient(90deg, #4facfe, #00f2fe)",
                          transition: "width 0.6s ease"
                        }}></div>
                      </div>
                      <p style={{ textAlign: "right", marginTop: "8px", color: "#718096", fontSize: "14px" }}>
                        {progress.toFixed(1)}%
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <button onClick={() => handleDonate(camp.id)} disabled={isExpired || isLoading} style={{
                        ...donateBtn,
                        flex: 1,
                        opacity: isExpired ? 0.5 : 1,
                        cursor: isExpired ? "not-allowed" : "pointer"
                      }}>
                        {isExpired ? "⛔ Đã Đóng" : "❤️ Quyên Góp"}
                      </button>
                      <button onClick={() => handleGetDonators(camp.id, camp.title)} style={secondaryBtn}>
                        📊 Lịch Sử
                      </button>
                      {isOwner && parseFloat(camp.amountCollected) > 0 && !camp.claimed && (
                        <button onClick={() => handleWithdraw(camp.id)} style={{ ...withdrawBtn, width: "100%" }}>
                          💸 Rút {camp.amountCollected} ETH
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Lịch Sử */}
        {showModal && (
          <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "15px", borderBottom: "2px solid #edf2f7" }}>
                <h3 style={{ margin: 0, color: "#2c7a7b", fontSize: "22px" }}>
                  📊 Lịch Sử: {currentCampaignTitle}
                </h3>
                <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: "30px", cursor: "pointer" }}>
                  ✕
                </button>
              </div>
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {donators.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#a0aec0", padding: "30px" }}>
                    Chưa có giao dịch nào
                  </p>
                ) : (
                  donators.map((item, i) => (
                    <div key={i} style={{
                      padding: "15px",
                      borderBottom: "1px solid #edf2f7",
                      display: "flex",
                      justifyContent: "space-between",
                      background: item.type === "withdraw" ? "#fff5f5" : "#f7fafc"
                    }}>
                      <div>
                        <strong style={{ color: "#2d3748" }}>
                          {item.type === "withdraw" ? "📢 RÚT TIỀN" : `❤️ ${item.donator.slice(0,6)}...${item.donator.slice(-4)}`}
                        </strong>
                        {item.type === "withdraw" && (
                          <small style={{ display: "block", color: "#a0aec0" }}>
                            {new Date(item.timestamp * 1000).toLocaleDateString("vi-VN")}
                          </small>
                        )}
                      </div>
                      <strong style={{ color: item.type === "withdraw" ? "#e53e3e" : "#38a169" }}>
                        {item.type === "withdraw" ? "-" : "+"} {item.amount} ETH
                      </strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== STYLES ====================
const primaryBtn = {
  background: "linear-gradient(135deg, #38a169, #48bb78)",
  color: "white",
  border: "none",
  borderRadius: "12px",
  padding: "14px 28px",
  fontSize: "16px",
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 6px 20px rgba(56,161,105,0.3)",
  transition: "all 0.3s"
};

const donateBtn = {
  ...primaryBtn,
  background: "linear-gradient(135deg, #f56565, #fc8181)",
  boxShadow: "0 6px 20px rgba(245,101,101,0.4)"
};

const withdrawBtn = {
  ...primaryBtn,
  background: "#ecc94b",
  color: "#333"
};

const secondaryBtn = {
  background: "#e2e8f0",
  color: "#4a5568",
  border: "none",
  borderRadius: "12px",
  padding: "14px 20px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "16px"
};

const inputStyle = {
  padding: "14px 18px",
  borderRadius: "12px",
  border: "2px solid #e2e8f0",
  fontSize: "16px",
  outline: "none",
  transition: "border 0.3s"
};

const tabStyle = {
  padding: "12px 30px",
  background: "none",
  border: "none",
  fontSize: "20px",
  fontWeight: "600",
  cursor: "pointer"
};

const modalOverlayStyle = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000
};

const modalContentStyle = {
  background: "white",
  padding: "30px",
  borderRadius: "20px",
  width: "90%",
  maxWidth: "500px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
};

const badgeSuccess = { position: "absolute", top: "15px", right: "15px", padding: "8px 16px", borderRadius: "30px", background: "#48bb78", color: "white", fontSize: "13px", fontWeight: "bold", zIndex: 10 };
const badgeExpired = { ...badgeSuccess, background: "#e53e3e" };
const badgeClaimed = { ...badgeSuccess, top: "55px", background: "#718096" };

export default App;