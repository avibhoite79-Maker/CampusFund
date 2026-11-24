// Paste your deployed contract address here (printed by the deploy script)
const CONTRACT_ADDRESS = "0xb4cc2A5F7CeC7bA68ECd91aaC485bd12c958900e";

// ABI = the list of contract functions our website is allowed to call
const CONTRACT_ABI = [
  "function campaignCount() view returns (uint256)",
  "function campaigns(uint256) view returns (address creator, string title, uint256 goal, uint256 deadline, uint256 raised, uint256 released, uint256 milestoneCount, uint256 currentMilestone)",
  "function contributions(uint256, address) view returns (uint256)",
  "function getMilestone(uint256 _id, uint256 _index) view returns (string description, uint256 yesVotes, uint256 noVotes)",
  "function createCampaign(string _title, uint256 _goal, uint256 _durationInDays, string[] _milestoneDescriptions) returns (uint256)",
  "function donate(uint256 _id) payable",
  "function voteMilestone(uint256 _id, bool _approve)",
  "function releaseMilestone(uint256 _id)",
  "function claimRefund(uint256 _id)"
];
