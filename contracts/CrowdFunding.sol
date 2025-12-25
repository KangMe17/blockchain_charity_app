// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract CrowdFunding {
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
        bool claimed; 
    }

    mapping(uint256 => Campaign) public campaigns;
    uint256 public numberOfCampaigns = 0;

    event FundsWithdrawn(uint256 indexed campaignId, address indexed owner, uint256 amount, uint256 timestamp);

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
        campaign.claimed = false; // Ban đầu chưa rút tiền

        numberOfCampaigns++;
        return numberOfCampaigns - 1;
    }

    function donateToCampaign(uint256 _id) public payable {
        uint256 amount = msg.value;
        Campaign storage campaign = campaigns[_id];
        
        // Chỉ cho quyên góp nếu chưa hết hạn
        require(block.timestamp < campaign.deadline, "Campaign Ended");

        campaign.donators.push(msg.sender);
        campaign.donations.push(amount);
        campaign.amountCollected = campaign.amountCollected + amount;
        
        // LƯU Ý: Đã xóa dòng chuyển tiền ngay lập tức. Tiền giờ nằm trong Contract.
    }

    // TÍNH NĂNG MỚI (Ý 4): Rút tiền
    function withdraw(uint256 _id) public {
        Campaign storage campaign = campaigns[_id];

        require(msg.sender == campaign.owner, "Only owner can withdraw");
        require(campaign.amountCollected > 0, "No funds to withdraw");
        require(!campaign.claimed, "Funds already claimed");

        uint256 amount = campaign.amountCollected;
        campaign.claimed = true;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Failed to send Ether");

        // ---> THÊM DÒNG NÀY ĐỂ GHI LỊCH SỬ <---
        emit FundsWithdrawn(_id, msg.sender, amount, block.timestamp);
    }

    function getDonators(uint256 _id) view public returns (address[] memory, uint256[] memory) {
        return (campaigns[_id].donators, campaigns[_id].donations);
    }

    function getCampaigns() public view returns (Campaign[] memory) {
        Campaign[] memory allCampaigns = new Campaign[](numberOfCampaigns);
        for(uint i = 0; i < numberOfCampaigns; i++) {
            Campaign storage item = campaigns[i];
            allCampaigns[i] = item;
        }
        return allCampaigns;
    }
}