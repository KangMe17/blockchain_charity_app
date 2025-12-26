// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract CrowdFunding {
    struct Request {
        string description;
        uint256 value;
        address recipient;
        bool completed;
        uint256 approvalCount;
        mapping(address => bool) approvals; // Lưu danh sách người đã vote
    }

    struct Campaign {
        address owner;
        string title;
        string description;
        uint256 target;
        uint256 deadline;
        uint256 amountCollected;
        string image;
        address[] donators;
        uint256[] donations;
        // Đã xóa biến 'claimed' vì bây giờ rút tiền nhiều lần
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Request[]) public requests; // Mapping lưu danh sách Request của từng chiến dịch
    mapping(uint256 => mapping(address => uint256)) public contributions;
    uint256 public numberOfCampaigns = 0;

    // Sự kiện khi tiền được rút thành công qua Request
    event RequestPaid(uint256 indexed campaignId, uint256 requestId, uint256 amount, address recipient);
    event RefundIssued(uint256 indexed campaignId, address indexed donator, uint256 amount);
    function createCampaign(address _owner, string memory _title, string memory _description, uint256 _target, uint256 _deadline, string memory _image) public returns (uint256) {
        Campaign storage campaign = campaigns[numberOfCampaigns];
        require(_deadline > block.timestamp, "The deadline should be a date in the future.");

        campaign.owner = _owner;
        campaign.title = _title;
        campaign.description = _description;
        campaign.target = _target;
        campaign.deadline = _deadline;
        campaign.amountCollected = 0;
        campaign.image = _image;

        numberOfCampaigns++;
        return numberOfCampaigns - 1;
    }

    function donateToCampaign(uint256 _id) public payable {
        uint256 amount = msg.value;
        Campaign storage campaign = campaigns[_id];

        require(block.timestamp < campaign.deadline, "Campaign Ended");

        campaign.donators.push(msg.sender);
        campaign.donations.push(amount);
        campaign.amountCollected = campaign.amountCollected + amount;
        contributions[_id][msg.sender] += amount;
    }

    // --- TÍNH NĂNG: HOÀN TIỀN (REFUND) ---
    function refund(uint256 _id) public {
        Campaign storage campaign = campaigns[_id];

        // 1. Kiểm tra điều kiện: Phải Hết hạn VÀ Không đạt mục tiêu
        require(block.timestamp > campaign.deadline, "Campaign has not ended yet");
        require(campaign.amountCollected < campaign.target, "Campaign target was met, cannot refund");

        // 2. Kiểm tra xem người gọi hàm có tiền để nhận lại không
        uint256 contributedAmount = contributions[_id][msg.sender];
        require(contributedAmount > 0, "You have no contributions to refund");

        // 3. Reset số dư của họ về 0 TRƯỚC khi chuyển tiền (Chống lỗi Re-entrancy)
        contributions[_id][msg.sender] = 0;

        // 4. Trả lại tiền
        (bool sent, ) = payable(msg.sender).call{value: contributedAmount}("");
        require(sent, "Failed to send Ether");

        emit RefundIssued(_id, msg.sender, contributedAmount);
    }

    // --- TÍNH NĂNG: QUẢN LÝ DÒNG TIỀN (Milestone) ---

    // 1. Chủ dự án tạo yêu cầu rút tiền
    function createRequest(uint256 _id, string memory _description, uint256 _value) public {
        Campaign storage campaign = campaigns[_id];
        require(msg.sender == campaign.owner, "Only owner can create requests");
        // Kiểm tra số dư trong contract của chiến dịch này có đủ không
        // (Lưu ý: logic đơn giản này giả định contract chứa đủ ETH, thực tế nên quản lý balance riêng từng camp)
        require(_value <= address(this).balance, "Not enough funds in contract");

        Request storage newRequest = requests[_id].push(); 
        newRequest.description = _description;
        newRequest.value = _value;
        newRequest.recipient = msg.sender;
        newRequest.completed = false;
        newRequest.approvalCount = 0;
    }

    // 2. Người quyên góp bỏ phiếu (Approve)
    function approveRequest(uint256 _id, uint256 _requestId) public {
        Campaign storage campaign = campaigns[_id];
        Request storage request = requests[_id][_requestId];

        // Kiểm tra xem người gọi hàm có phải là Donator không
        bool isDonator = false;
        for(uint i=0; i < campaign.donators.length; i++) {
            if(campaign.donators[i] == msg.sender) {
                isDonator = true;
                break;
            }
        }
        require(isDonator, "You are not a donator");
        require(!request.approvals[msg.sender], "You have already voted");
        require(!request.completed, "Request already completed");

        request.approvals[msg.sender] = true;
        request.approvalCount++;
    }

    // 3. Rút tiền (Finalize) - Chỉ rút được khi > 50% người đồng ý
    function finalizeRequest(uint256 _id, uint256 _requestId) public {
        Campaign storage campaign = campaigns[_id];
        Request storage request = requests[_id][_requestId];

        require(msg.sender == campaign.owner, "Only owner can finalize");
        require(!request.completed, "Request already completed");
        
        // Logic quan trọng: Phải quá bán (>50%) số người donate đồng ý
        require(request.approvalCount > (campaign.donators.length / 2), "Not enough approvals");

        // Chuyển tiền
        (bool sent, ) = payable(msg.sender).call{value: request.value}("");
        require(sent, "Failed to send Ether");

        request.completed = true;
        
        emit RequestPaid(_id, _requestId, request.value, msg.sender);
    }

    // 4. Lấy danh sách người quyên góp (Giữ nguyên)
    function getDonators(uint256 _id) view public returns (address[] memory, uint256[] memory) {
        return (campaigns[_id].donators, campaigns[_id].donations);
    }

    // 5. Lấy danh sách chiến dịch (Giữ nguyên)
    function getCampaigns() public view returns (Campaign[] memory) {
        Campaign[] memory allCampaigns = new Campaign[](numberOfCampaigns);
        for(uint i = 0; i < numberOfCampaigns; i++) {
            Campaign storage item = campaigns[i];
            allCampaigns[i] = item;
        }
        return allCampaigns;
    }

    // 6. Các hàm hỗ trợ Frontend lấy dữ liệu Request
    function getRequestsCount(uint256 _id) public view returns (uint256) {
        return requests[_id].length;
    }

    function getRequestDetails(uint256 _id, uint256 _requestId) public view returns (
        string memory description,
        uint256 value,
        bool completed,
        uint256 approvalCount,
        bool hasVoted
    ) {
        Request storage request = requests[_id][_requestId];
        return (
            request.description,
            request.value,
            request.completed,
            request.approvalCount,
            request.approvals[msg.sender] // Kiểm tra người xem đã vote chưa
        );
    }
}