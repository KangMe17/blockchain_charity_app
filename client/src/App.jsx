import { useState, useEffect } from "react";
import { ethers } from "ethers";
import CrowdFundingABI from "./abi/CrowdFunding.json";

const contractAddress = "0x015a8FF766bC931c33c3b0d227f210C651485b1a";

function App() {
  const [account, setAccount] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [sortOption, setSortOption] = useState("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [donators, setDonators] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requests, setRequests] = useState([]);
  const [currentCampaignId, setCurrentCampaignId] = useState(null);
  const [currentCampaignOwner, setCurrentCampaignOwner] = useState("");
  const [donatorCount, setDonatorCount] = useState(0);

  const [currentCampaignTitle, setCurrentCampaignTitle] = useState("");
  const [form, setForm] = useState({ title: "", description: "", target: "", deadline: "", image: "" });
  
  const [requestForm, setRequestForm] = useState({ description: "", value: "" });

  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) return alert("Vui lòng cài đặt MetaMask!");
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
    } catch (error) { console.error(error); }
  };

  const getRemainingTime = (deadlineTimestamp) => {
      const now = new Date().getTime();
      const deadline = deadlineTimestamp * 1000; // Đổi giây sang mili-giây
      const diff = deadline - now;

      if (diff <= 0) return "Đã kết thúc";

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) return `${days} ngày ${hours} giờ còn lại`;
      return `${hours} giờ ${minutes} phút còn lại`;
  };

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
        donatorsCount: campaign.donators.length
      }));
      setCampaigns(parsedData);
    } catch (error) { console.log("Lỗi tải chiến dịch:", error); }
  };

  useEffect(() => {
    if (account) fetchCampaigns();
  }, [account]);

const handleCreateCampaign = async (e) => {
    e.preventDefault();
    
    // --- BƯỚC 1: KIỂM TRA NGÀY HỢP LỆ (Client-side Validation) ---
    const inputDate = new Date(form.deadline);
    const currentDate = new Date();
    
    // Reset giờ phút giây về 0 để so sánh ngày cho chuẩn (tuỳ chọn)
    currentDate.setHours(0, 0, 0, 0); 
    
    if (inputDate.getTime() < Date.now()) {
        alert("⛔ Lỗi: Ngày kết thúc phải là một ngày trong TƯƠNG LAI! Vui lòng chọn lại.");
        return; // Dừng ngay, không gửi transaction nữa
    }

    setIsLoading(true);
    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, signer);
        
        const targetInWei = ethers.parseEther(form.target);
        const deadlineDate = Math.floor(new Date(form.deadline).getTime() / 1000);
        const tx = await contract.createCampaign(account, form.title, form.description, targetInWei, deadlineDate, form.image);
        await tx.wait();
        
        alert("Tạo chiến dịch thành công! 🤲");
        setForm({ title: "", description: "", target: "", deadline: "", image: "" });
        fetchCampaigns();
      }
    } catch (error) { 
        console.error("Lỗi tạo chiến dịch:", error);
        
        // --- BƯỚC 2: BẮT LỖI TỪ BLOCKCHAIN (Nếu lọt qua bước 1) ---
        if (error.reason && error.reason.includes("The deadline should be a date in the future")) {
            alert("⛔ Lỗi từ Blockchain: Ngày kết thúc không hợp lệ (Phải là tương lai).");
        } else if (error.code === "CALL_EXCEPTION") {
            alert("⛔ Lỗi: Kiểm tra lại dữ liệu nhập vào (Ngày tháng, số tiền...).");
        } else {
            alert("❌ Lỗi: " + (error.reason || error.message));
        }
    } finally { 
        setIsLoading(false); 
    }
  };

  const handleDonate = async (id) => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        const amount = prompt("Nhập số ETH bạn muốn quyên góp:");
        if (!amount || parseFloat(amount) <= 0) return;
        
        const provider = new ethers.BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, signer);
        
        const tx = await contract.donateToCampaign(id, { value: ethers.parseEther(amount) });
        setIsLoading(true);
        await tx.wait();
        alert("Cảm ơn trái tim nhân ái của bạn! ❤️");
        fetchCampaigns();
      }
    } catch (error) { alert("Thất bại: " + error.message); } finally { setIsLoading(false); }
  };

  // Xử lý Hoàn tiền
  const handleRefund = async (id) => {
    if (!window.confirm("Chiến dịch này đã thất bại. Bạn muốn nhận lại tiền quyên góp?")) return;

    setIsLoading(true);
    try {
        const { ethereum } = window;
        if (ethereum) {
            const provider = new ethers.BrowserProvider(ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, signer);

            const tx = await contract.refund(id);
            await tx.wait();
            
            alert("Hoàn tiền thành công! Kiểm tra ví của bạn nhé. 💸");
            fetchCampaigns();
        }
    } catch (error) {
        console.error("Lỗi hoàn tiền:", error);
        if (error.reason && error.reason.includes("You have no contributions")) {
             alert("⛔ Bạn chưa quyên góp cho chiến dịch này hoặc đã rút rồi.");
        } else {
             alert("❌ Lỗi: " + (error.reason || "Giao dịch thất bại"));
        }
    } finally {
        setIsLoading(false);
    }
  };

  const fetchRequests = async (id, owner, donatorsLen) => {
    try {
        const { ethereum } = window;
        if (ethereum) {
            const provider = new ethers.BrowserProvider(ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, signer);
            
            const count = await contract.getRequestsCount(id);
            const requestsData = [];
            
            for(let i = 0; i < count; i++) {
                const req = await contract.getRequestDetails(id, i);
                requestsData.push({
                    id: i,
                    description: req[0],
                    value: ethers.formatEther(req[1]),
                    completed: req[2],
                    approvalCount: Number(req[3]),
                    hasVoted: req[4]
                });
            }
            setRequests(requestsData);
            setCurrentCampaignId(id);
            setCurrentCampaignOwner(owner);
            setDonatorCount(donatorsLen);
            setShowRequestModal(true);
        }
    } catch (error) { console.error("Lỗi lấy requests:", error); }
  }

  const handleCreateRequest = async (e) => {
      e.preventDefault();
      try {
        const { ethereum } = window;
        if (ethereum) {
            const provider = new ethers.BrowserProvider(ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, signer);
            
            const tx = await contract.createRequest(currentCampaignId, requestForm.description, ethers.parseEther(requestForm.value));
            setIsLoading(true);
            await tx.wait();
            alert("Tạo yêu cầu rút tiền thành công! Đợi vote nhé.");
            setRequestForm({ description: "", value: "" });
            fetchRequests(currentCampaignId, currentCampaignOwner, donatorCount);
        }
      } catch (error) { 
        console.error("Lỗi tạo request:", error);
        
        if (error.code === "CALL_EXCEPTION" || error.message.includes("missing revert data")) {
             alert("⛔ Lỗi: Chỉ CHỦ SỞ HỮU chiến dịch mới được quyền tạo yêu cầu rút tiền!");
        } else if (error.reason === "Not enough funds in contract") {
             alert("⚠️ Số dư trong quỹ không đủ để tạo yêu cầu này!");
        } else {
             alert("❌ Lỗi: " + (error.reason || error.message)); 
        }
      } finally { setIsLoading(false); }
  }

  const handleVote = async (requestId) => {
        try {
          const { ethereum } = window;
          if (ethereum) {
              const provider = new ethers.BrowserProvider(ethereum);
              const signer = await provider.getSigner();
              const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, signer);

              const tx = await contract.approveRequest(currentCampaignId, requestId);
              setIsLoading(true);
              await tx.wait();
              alert("Đã bỏ phiếu đồng ý! ✅");
              fetchRequests(currentCampaignId, currentCampaignOwner, donatorCount);
          }
        } catch (error) { 
          console.error("Lỗi Vote:", error);
          
          // --- BẮT LỖI Ở ĐÂY ---
          if (error.code === "CALL_EXCEPTION" || error.message.includes("missing revert data")) {
              alert("⛔ CẢNH BÁO: Bạn KHÔNG PHẢI là người đã quyên góp cho chiến dịch này, nên bạn không có quyền bỏ phiếu!");
          } else if (error.reason === "You have already voted") {
              alert("⚠️ Bạn đã bỏ phiếu cho yêu cầu này rồi!");
          } else {
              alert("❌ Lỗi giao dịch: " + (error.reason || error.message));
          }
        } finally { setIsLoading(false); }
  }

  const handleFinalize = async (requestId) => {
      try {
        const { ethereum } = window;
        if (ethereum) {
            const provider = new ethers.BrowserProvider(ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, signer);

            const tx = await contract.finalizeRequest(currentCampaignId, requestId);
            setIsLoading(true);
            await tx.wait();
            alert("Rút tiền thành công! 💸");
            fetchRequests(currentCampaignId, currentCampaignOwner, donatorCount);
            fetchCampaigns();
        }
      } catch (error) { 
        console.error("Lỗi rút tiền:", error);
        
        if (error.code === "CALL_EXCEPTION" || error.message.includes("missing revert data")) {
             alert("⛔ Không thể rút tiền: Có thể số phiếu bầu CHƯA QUÁ BÁN (>50%) hoặc yêu cầu này đã hoàn thành.");
        } else {
             alert("❌ Lỗi: " + (error.reason || error.message)); 
        }
      } finally { setIsLoading(false); }
  }

  const handleGetDonators = async (id, title) => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.BrowserProvider(ethereum);
        const contract = new ethers.Contract(contractAddress, CrowdFundingABI.abi, provider);

        const result = await contract.getDonators(id);
        let historyList = result[0].map((donator, i) => ({
          type: "donate",
          donator,
          amount: ethers.formatEther(result[1][i]),
          timestamp: null // Donate không lưu time trên chain
        }));

        const filter = contract.filters.RequestPaid(id);
        const events = await contract.queryFilter(filter);

        for (const event of events) {
            // Lấy thông tin Block để biết thời gian thực
            const block = await provider.getBlock(event.blockNumber);
            
            historyList.push({
                type: "withdraw",
                donator: event.args[3], // recipient
                amount: ethers.formatEther(event.args[2]), // amount
                timestamp: block.timestamp // Lấy thời gian từ block
            });
        }

        // Sắp xếp mới nhất lên đầu (nếu có time)
        historyList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        setDonators(historyList);
        setCurrentCampaignTitle(title);
        setShowHistoryModal(true);
      }
    } catch (error) { console.log(error); }
  };

// 1. Lọc theo Tab (All / My Campaigns)
  const filteredByTab = activeTab === "all" 
    ? campaigns 
    : campaigns.filter((camp) => camp.owner.toLowerCase() === account.toLowerCase());

  // 2. Lọc theo Từ khóa tìm kiếm (Search) - MỚI
  const filteredBySearch = filteredByTab.filter((camp) => 
      camp.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 3. Sắp xếp (Sort)
  const displayedCampaigns = [...filteredBySearch].sort((a, b) => {
      switch (sortOption) {
          case "time_asc": return a.deadlineTimestamp - b.deadlineTimestamp;
          case "time_desc": return b.deadlineTimestamp - a.deadlineTimestamp;
          case "target_asc": return parseFloat(a.target) - parseFloat(b.target);
          case "target_desc": return parseFloat(b.target) - parseFloat(a.target);
          default: return b.id - a.id;
      }
  });
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* HERO HEADER - FULL WIDTH */}
      <header style={{ background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", color: "white", padding: "100px 40px", textAlign: "center", width: "100%" }}>
        <h1 style={{ fontSize: "52px", fontWeight: "900", margin: "0 0 20px" }}>🤝 Charity App</h1>
        <p style={{ fontSize: "24px", maxWidth: "900px", margin: "0 auto 40px", opacity: 0.95 }}>
          Nền tảng từ thiện minh bạch với cơ chế bỏ phiếu cộng đồng trên blockchain
        </p>
        {!account ? (
          <button onClick={connectWallet} style={{ ...primaryBtn, padding: "16px 40px", fontSize: "20px" }}>🦊 Kết nối MetaMask</button>
        ) : (
          <div style={userBadge}>👤 {account.slice(0, 6)}...{account.slice(-4)}</div>
        )}
      </header>

      {/* NỘI DUNG CHÍNH - FULL WIDTH */}
      <div style={{ padding: "40px 20px" }}>
        
        {/* FORM TẠO CHIẾN DỊCH */}
        {account && (
          <div style={{ ...cardStyle, maxWidth: "1000px", margin: "0 auto 60px auto" }}>
            <h3 style={{ color: "#2c7a7b", textAlign: "center", marginBottom: "30px", fontSize: "28px" }}>🌱 Tạo Chiến Dịch Mới</h3>
            <form onSubmit={handleCreateCampaign} style={{ display: "grid", gap: "20px", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
              <input placeholder="Tên chiến dịch" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              <input placeholder="Mục tiêu (ETH)" type="number" step="0.0001" required value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} style={inputStyle} />
              <input type="datetime-local" required value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} style={inputStyle} />
              <input placeholder="Link ảnh (URL)" required value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              <textarea placeholder="Mô tả chi tiết..." rows="4" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              <button type="submit" disabled={isLoading} style={{ ...primaryBtn, gridColumn: "1 / -1", padding: "16px" }}>
                {isLoading ? "⏳ Đang xử lý..." : "✨ Khởi Tạo Chiến Dịch"}
              </button>
              <div style={{ gridColumn: "1 / -1", background: "#fff5f5", border: "1px dashed #fc8181", padding: "15px", borderRadius: "10px", display: "flex", gap: "10px", alignItems: "start" }}>
    <span style={{ fontSize: "20px" }}>⚠️</span>
    <p style={{ margin: 0, fontSize: "13px", color: "#c53030", lineHeight: "1.6" }}>
        <strong>Lưu ý quan trọng:</strong> Sau khi khởi tạo, mọi dữ liệu (Hình ảnh, Mô tả, Ví nhận tiền) sẽ được ghi <strong>vĩnh viễn</strong> lên Blockchain và <strong>KHÔNG THỂ</strong> chỉnh sửa hoặc xóa bỏ bởi bất kỳ ai (kể cả Admin hay Chính phủ). Hãy kiểm tra kỹ trước khi bấm nút!
    </p>
</div>
            </form>
          </div>
        )}

        {/* TABS */}
        <div style={{ textAlign: "center", marginBottom: "50px" }}>
          <button onClick={() => setActiveTab("all")} style={{ ...tabStyle, color: activeTab === "all" ? "#38a169" : "#666", borderBottom: activeTab === "all" ? "4px solid #38a169" : "none" }}>
            🌍 Tất Cả Chiến Dịch
          </button>
          <button onClick={() => setActiveTab("my_campaigns")} style={{ ...tabStyle, color: activeTab === "my_campaigns" ? "#38a169" : "#666", borderBottom: activeTab === "my_campaigns" ? "4px solid #38a169" : "none" }}>
            👤 Chiến Dịch Của Tôi
          </button>
        </div>
        {/* Ô TÌM KIẾM MỚI */}
    <div style={{ flex: 1, minWidth: "300px", background: "white", borderRadius: "30px", padding: "10px 20px", boxShadow: "0 5px 15px rgba(0,0,0,0.05)", display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: "20px", marginRight: "10px" }}>🔍</span>
        <input 
            placeholder="Tìm tên chiến dịch..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: "none", outline: "none", width: "100%", fontSize: "16px" }}
        />
        {searchTerm && (
            <button onClick={() => setSearchTerm("")} style={{ border: "none", background: "none", cursor: "pointer", color: "#999", fontSize: "16px" }}>✕</button>
        )}
    </div>
        <div style={{ maxWidth: "1200px", margin: "0 auto 30px", display: "flex", justifyContent: "flex-end", padding: "0 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "white", padding: "10px 20px", borderRadius: "30px", boxShadow: "0 5px 15px rgba(0,0,0,0.05)" }}>
                <span style={{ fontWeight: "bold", color: "#4a5568" }}>🔍 Sắp xếp theo:</span>
                <select 
                    value={sortOption} 
                    onChange={(e) => setSortOption(e.target.value)} 
                    style={{ border: "none", outline: "none", fontSize: "16px", color: "#2c7a7b", fontWeight: "bold", cursor: "pointer", background: "transparent" }}
                >
                    <option value="newest">✨ Mới nhất</option>
                    <option value="time_asc">⏳ Thời gian còn lại (Ít ➝ Nhiều)</option>
                    <option value="time_desc">⏳ Thời gian còn lại (Nhiều ➝ Ít)</option>
                    <option value="target_asc">🎯 Mục tiêu tiền (Thấp ➝ Cao)</option>
                    <option value="target_desc">🎯 Mục tiêu tiền (Cao ➝ Thấp)</option>
                </select>
            </div>
        </div>
        {/* GRID CHIẾN DỊCH - FULL WIDTH */}
        <div style={{ maxWidth: "1800px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "30px" }}>
          {displayedCampaigns.length === 0 ? (
            <p style={{ gridColumn: "1/-1", textAlign: "center", fontSize: "22px", color: "#666" }}>Chưa có chiến dịch nào. Hãy lan tỏa yêu thương! 🌱</p>
          ) : displayedCampaigns.map((camp) => {
              const isExpired = Date.now() > camp.deadlineTimestamp * 1000;
              const isTargetMet = parseFloat(camp.amountCollected) >= parseFloat(camp.target);
              const isCampaignFailed = isExpired && !isTargetMet;
              const progress = Math.min((parseFloat(camp.amountCollected) / parseFloat(camp.target)) * 100, 100);

              return (
                <div key={camp.id} style={{ background: "white", borderRadius: "20px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column" }}>
                  
                  {/* Ảnh và Badge */}
                  <div style={{ position: "relative" }}>
                    <img src={camp.image} style={{ width: "100%", height: "220px", objectFit: "cover" }} onError={(e) => e.target.src = "https://via.placeholder.com/800x400"} />
                    {/* Badge trạng thái */}
                    {parseFloat(camp.amountCollected) >= parseFloat(camp.target) && <span style={{ position: "absolute", top: "15px", right: "15px", padding: "6px 12px", borderRadius: "20px", background: "#48bb78", color: "white", fontSize: "12px", fontWeight: "bold" }}>🎉 Đạt mục tiêu</span>}
                    {isExpired && parseFloat(camp.amountCollected) < parseFloat(camp.target) && <span style={{ position: "absolute", top: "15px", right: "15px", padding: "6px 12px", borderRadius: "20px", background: "#e53e3e", color: "white", fontSize: "12px", fontWeight: "bold" }}>⛔ Đã kết thúc</span>}
                    {isCampaignFailed && <span style={{ position: "absolute", top: "15px", right: "15px", padding: "6px 12px", borderRadius: "20px", background: "#e53e3e", color: "white", fontSize: "12px", fontWeight: "bold" }}>⚠️ Thất bại - Được hoàn tiền</span>}
                  </div>

                  <div style={{ padding: "20px", display: "flex", flexDirection: "column", flex: 1 }}>
                    <h4 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 10px", color: "#2d3748" }}>{camp.title}</h4>
                    <p style={{ color: "#718096", fontSize: "14px", lineHeight: "1.5", marginBottom: "15px", flex: 1 }}>
                      {camp.description.length > 100 ? camp.description.substring(0, 100) + "..." : camp.description}
                    </p>

                    {/* Khu vực Thống kê & Tiến độ */}
                    <div style={{ background: "#f7fafc", padding: "15px", borderRadius: "12px", marginBottom: "15px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px" }}>
                            <span style={{ color: "#4a5568" }}>Mục tiêu: <strong style={{ color: "#2c7a7b" }}>{camp.target} ETH</strong></span>
                            <span style={{ color: "#4a5568" }}>Đã góp: <strong style={{ color: "#38a169" }}>{camp.amountCollected} ETH</strong></span>
                        </div>
                        
                        {/* Thanh tiến trình */}
                        <div style={{ height: "10px", background: "#e2e8f0", borderRadius: "5px", overflow: "hidden", marginBottom: "10px" }}>
                            <div style={{ width: `${progress}%`, height: "100%", background: progress >= 100 ? "#48bb78" : "linear-gradient(90deg, #4facfe, #00f2fe)", transition: "width 0.5s ease" }}></div>
                        </div>

                        {/* --- PHẦN MỚI THÊM: THỜI GIAN --- */}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", paddingTop: "5px", borderTop: "1px dashed #cbd5e0" }}>
                            <div style={{ color: "#718096" }}>
                                📅 Hạn chót:<br/>
                                <span style={{ color: "#2d3748", fontWeight: "600" }}>{camp.deadline}</span> 
                                {/* camp.deadline ở đây đã format sẵn ngày giờ từ hàm fetchCampaigns */}
                            </div>
                            <div style={{ textAlign: "right" }}>
                                ⏱️ Còn lại:<br/>
                                <span style={{ color: isExpired ? "#e53e3e" : "#d69e2e", fontWeight: "bold" }}>
                                    {isExpired ? "Hết giờ" : getRemainingTime(camp.deadlineTimestamp)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Nút bấm */}
                    <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                        {isCampaignFailed ? (
                  // Nút Hoàn tiền (Nếu thất bại)
                  <button 
                      onClick={() => handleRefund(camp.id)} 
                      disabled={isLoading}
                      style={{ ...primaryBtn, flex: 1, background: "#805ad5", boxShadow: "0 4px 14px rgba(128, 90, 213, 0.4)" }}
                  >
                      🔄 Lấy lại tiền
                  </button>
              ) : (
                  // Nút Quyên góp (Nếu đang chạy hoặc thành công)
                  <button 
                      onClick={() => handleDonate(camp.id)} 
                      disabled={isExpired} 
                      style={{ ...primaryBtn, flex: 1, background: isExpired ? "#cbd5e0" : "linear-gradient(135deg, #f56565, #fc8181)", cursor: isExpired ? "not-allowed" : "pointer" }}
                  >
                      {isExpired ? "Đã Đóng" : "❤️ Quyên Góp"}
                  </button>
              )}
                        <button onClick={() => handleGetDonators(camp.id, camp.title)} style={{ ...secondaryBtn, padding: "10px" }}>📊 Lịch Sử</button>
                    </div>
                    
                    {/* Nút Quản lý Quỹ */}
                    <button onClick={() => fetchRequests(camp.id, camp.owner, camp.donatorsCount)} style={{ ...secondaryBtn, width: "100%", marginTop: "10px", background: "#edf2f7", color: "#2c5282", fontSize: "13px" }}>
                        ⚙️ Quản Lý Quỹ (Milestone)
                    </button>
                    {/* KHU VỰC CHIA SẺ (SHARE) */}
<div style={{ marginTop: "15px", paddingTop: "10px", borderTop: "1px solid #eee", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
    <span style={{ fontSize: "13px", color: "#718096" }}>Lan tỏa:</span>
    
    {/* Nút Facebook */}
    <a 
        href={`https://www.facebook.com/sharer/sharer.php?u=${window.location.href}`} 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ textDecoration: "none", background: "#3b5998", color: "white", padding: "5px 10px", borderRadius: "5px", fontSize: "12px", fontWeight: "bold" }}
    >
        FaceBook
    </a>

    {/* Nút Twitter / X */}
    <a 
        href={`https://twitter.com/intent/tweet?text=Hãy ủng hộ chiến dịch "${camp.title}"&url=${window.location.href}`} 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ textDecoration: "none", background: "#000", color: "white", padding: "5px 10px", borderRadius: "5px", fontSize: "12px", fontWeight: "bold" }}
    >
        X (Twitter)
    </a>
</div>
                  </div>
                </div>
              )
          })}
        </div>
      </div>

      {/* MODAL LỊCH SỬ - KHÔNG CẦN SỬA SMART CONTRACT */}
      {showHistoryModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalContent, color: "#333" }}>
            <div style={modalHeader}>
              <h3 style={{ color: "#2c7a7b", margin: 0 }}>📊 Lịch Sử: {currentCampaignTitle}</h3>
              <button onClick={() => setShowHistoryModal(false)} style={closeBtn}>✕</button>
            </div>
            
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {donators.length === 0 ? (
                  <p style={{textAlign:"center", color:"#999", marginTop: "20px"}}>Chưa có giao dịch nào.</p>
              ) : donators.map((item, i) => (
                <div key={i} style={{ 
                    padding: "15px", 
                    borderBottom: "1px solid #e2e8f0", 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    background: item.type === "withdraw" ? "#fff5f5" : "#f7fafc" 
                }}>
                  
                  {/* Cột Trái: Tên + Link Etherscan + Thời gian */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                      
                      {/* Dòng 1: Tên người dùng và Icon Link */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: "bold", fontSize: "15px", color: "#2d3748" }}>
                            {item.type === "withdraw" ? "📢 RÚT TIỀN" : `👤 ${item.donator.slice(0,6)}...${item.donator.slice(-4)}`}
                          </span>
                          
                          {/* LINK ĐẾN VÍ NGƯỜI QUYÊN GÓP (Không cần sửa Sol) */}
                          <a 
                                href={`https://sepolia.etherscan.io/address/${item.donator}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                title="Kiểm tra ví người này trên Etherscan"
                                style={{ textDecoration: "none", fontSize: "14px", cursor: "pointer" }}
                            >
                                🔗
                            </a>
                      </div>
                      
                      {/* Dòng 2: Thời gian (Giữ nguyên logic cũ vì không sửa Sol) */}
                      <span style={{ fontSize: "12px", color: "#718096", marginTop: "4px" }}>
                        {item.timestamp 
                            ? new Date(item.timestamp * 1000).toLocaleString("vi-VN") 
                            : (item.type === "withdraw" ? "Đang cập nhật..." : "Đã xác nhận trên Blockchain") 
                        }
                      </span>
                  </div>

                  {/* Cột Phải: Số tiền */}
                  <strong style={{ 
                      color: item.type === "withdraw" ? "#e53e3e" : "#38a169", 
                      fontSize: "16px",
                      whiteSpace: "nowrap"
                  }}>
                    {item.type === "withdraw" ? "-" : "+"} {item.amount} ETH
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL QUẢN LÝ QUỸ - CHỮ ĐEN RÕ, TABLE ĐẸP */}
      {showRequestModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalContent, maxWidth: "800px", color: "#333" }}>
            <div style={modalHeader}>
              <h3 style={{ color: "#2c7a7b" }}>⚙️ Quản Lý Quỹ (Milestone & Vote)</h3>
              <button onClick={() => setShowRequestModal(false)} style={closeBtn}>✕</button>
            </div>

            {account.toLowerCase() === currentCampaignOwner.toLowerCase() && (
              <div style={{ background: "#f0fff4", padding: "20px", borderRadius: "12px", marginBottom: "25px", border: "1px solid #86efac" }}>
                <h4 style={{ margin: "0 0 15px", color: "#166534" }}>➕ Tạo Yêu Cầu Rút Tiền Mới</h4>
                <form onSubmit={handleCreateRequest} style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <input placeholder="Mục đích sử dụng tiền" required value={requestForm.description} onChange={e => setRequestForm({...requestForm, description: e.target.value})} style={{...inputStyle, flex: "2"}} />
                  <input placeholder="Số ETH" type="number" step="0.001" required value={requestForm.value} onChange={e => setRequestForm({...requestForm, value: e.target.value})} style={{...inputStyle, flex: "1"}} />
                  <button type="submit" disabled={isLoading} style={{...primaryBtn, padding: "12px 20px"}}>Tạo Yêu Cầu</button>
                </form>
              </div>
            )}

            <div style={{ maxHeight: "450px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px" }}>
                <thead style={{ background: "#e6fffa" }}>
                  <tr>
                    <th style={{ padding: "12px", textAlign: "left" }}>Mục đích</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Số tiền</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Phiếu bầu</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Trạng thái</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: "30px", textAlign: "center", color: "#666" }}>Chưa có yêu cầu rút tiền nào</td></tr>
                  ) : requests.map((req) => {
                    const isOwner = account.toLowerCase() === currentCampaignOwner.toLowerCase();
                    const canFinalize = req.approvalCount > (donatorCount / 2);
                    
                    return (
                      <tr key={req.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px" }}>{req.description}</td>
                        <td style={{ padding: "12px", textAlign: "center", fontWeight: "bold" }}>{req.value} ETH</td>
                        <td style={{ padding: "12px", textAlign: "center" }}>{req.approvalCount} / {donatorCount}</td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          {req.completed ? (
        // NẾU ĐÃ RÚT TIỀN -> Hiện Link Etherscan
        <a 
            href={`https://sepolia.etherscan.io/address/${contractAddress}#internaltx`}
            target="_blank"
            rel="noopener noreferrer" 
            title="Bấm để kiểm tra giao dịch chuyển tiền trên Blockchain"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px", color: "#276749", background: "#c6f6d5", padding: "5px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" }}
        >
            💸 ĐÃ GIẢI NGÂN ↗
        </a>
    ) : (
        // NẾU CHƯA RÚT
        <span style={{ color: "orange", background: "#feebc8", padding: "5px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" }}>
            ⏳ Đang chờ duyệt
        </span>
    )}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          {req.completed ? "-" : (
                            <>
                              {!req.hasVoted && !isOwner && (
                                <button onClick={() => handleVote(req.id)} style={{ ...primaryBtn, padding: "8px 16px", fontSize: "14px" }}>👍 Vote</button>
                              )}
                              {isOwner && (
                                canFinalize ? (
                                  <button onClick={() => handleFinalize(req.id)} style={{ ...primaryBtn, background: "#f97316", padding: "8px 16px", fontSize: "14px" }}>💸 Rút Tiền</button>
                                ) : (
                                  <span style={{ color: "#991b1b", fontSize: "14px" }}>Chưa đủ phiếu</span>
                                )
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* --- FOOTER: LINK ETHERSCAN --- */}
<footer style={{ textAlign: "center", padding: "40px 20px", marginTop: "50px", borderTop: "1px solid #e2e8f0", color: "#718096" }}>
    <p style={{ marginBottom: "10px", fontSize: "16px" }}>
        🔒 Ứng dụng hoạt động trên mạng lưới <strong>Ethereum Sepolia (Testnet)</strong>
    </p>
    <a 
        href={`https://sepolia.etherscan.io/address/${contractAddress}#code`} 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "#3182ce", fontWeight: "bold", background: "#ebf8ff", padding: "10px 20px", borderRadius: "30px" }}
    >
        📄 Xem Hợp Đồng Thông Minh trên Etherscan
    </a>
</footer>
    </div>
  );
}

// ==================== STYLES ====================
const cardStyle = { background: "white", borderRadius: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" };

const primaryBtn = { 
  background: "linear-gradient(135deg, #38a169, #48bb78)", 
  color: "white", 
  border: "none", 
  borderRadius: "12px", 
  padding: "12px 20px", 
  cursor: "pointer", 
  fontWeight: "bold", 
  fontSize: "16px",
  transition: "0.3s"
};

const donateBtn = { 
  ...primaryBtn, 
  background: "linear-gradient(135deg, #f56565, #fc8181)",
  boxShadow: "0 6px 20px rgba(245,101,101,0.3)"
};

const secondaryBtn = { 
  background: "#e2e8f0", 
  color: "#4a5568", 
  border: "none", 
  borderRadius: "12px", 
  padding: "12px 20px", 
  cursor: "pointer", 
  fontWeight: "bold", 
  fontSize: "15px"
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
  background: "none", 
  border: "none", 
  fontSize: "20px", 
  fontWeight: "600", 
  padding: "12px 30px", 
  cursor: "pointer"
};

const userBadge = { 
  background: "rgba(255,255,255,0.25)", 
  padding: "14px 32px", 
  borderRadius: "50px", 
  backdropFilter: "blur(10px)", 
  fontWeight: "bold", 
  fontSize: "18px"
};

const modalOverlay = { 
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
  background: "rgba(0,0,0,0.6)", 
  display: "flex", justifyContent: "center", alignItems: "center", 
  zIndex: 1000 
};

const modalContent = { 
  background: "white", 
  padding: "30px", 
  borderRadius: "20px", 
  width: "90%", 
  maxWidth: "600px", 
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)" 
};

const modalHeader = { 
  display: "flex", 
  justifyContent: "space-between", 
  alignItems: "center", 
  marginBottom: "20px", 
  paddingBottom: "15px", 
  borderBottom: "2px solid #e2e8f0" 
};

const closeBtn = { 
  background: "none", 
  border: "none", 
  fontSize: "28px", 
  cursor: "pointer", 
  color: "#666" 
};

export default App;