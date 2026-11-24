// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// CampusFund: milestone-based crowdfunding.
// Donor money stays in this contract and is released step by step
// only after donors vote "yes" for each milestone.

contract CampusFund {

    // ---------- 1. DATA ----------

    struct Campaign {
        address creator;          // who started the campaign
        string title;
        uint256 goal;             // target amount in wei
        uint256 deadline;         // time (seconds) until donations are open
        uint256 raised;           // total donated so far
        uint256 released;         // total already paid to creator
        uint256 milestoneCount;   // how many milestones
        uint256 currentMilestone; // which milestone is being voted on now
    }

    struct Milestone {
        string description;
        uint256 yesVotes;         // total weight of "yes" votes
        uint256 noVotes;          // total weight of "no" votes
    }

    uint256 public campaignCount;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Milestone[]) private milestones;

    // campaign id => donor => amount donated
    mapping(uint256 => mapping(address => uint256)) public contributions;

    // campaign id => milestone number => donor => has voted?
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted;

    // ---------- 2. EVENTS (the backend listens to these) ----------

    event CampaignCreated(uint256 indexed id, address indexed creator, string title, uint256 goal, uint256 deadline);
    event Donated(uint256 indexed id, address indexed donor, uint256 amount);
    event Voted(uint256 indexed id, uint256 milestone, address indexed donor, bool approve, uint256 weight);
    event FundsReleased(uint256 indexed id, uint256 milestone, uint256 amount);
    event Refunded(uint256 indexed id, address indexed donor, uint256 amount);

    // ---------- 3. FUNCTIONS ----------

    // Creator starts a new campaign
    function createCampaign(
        string memory _title,
        uint256 _goal,
        uint256 _durationInDays,
        string[] memory _milestoneDescriptions
    ) public returns (uint256) {
        require(_goal > 0, "Goal must be more than 0");
        require(
            _milestoneDescriptions.length >= 1 && _milestoneDescriptions.length <= 5,
            "Use 1 to 5 milestones"
        );

        campaignCount++;
        uint256 id = campaignCount;

        Campaign storage c = campaigns[id];
        c.creator = msg.sender;
        c.title = _title;
        c.goal = _goal;
        c.deadline = block.timestamp + (_durationInDays * 1 days);
        c.milestoneCount = _milestoneDescriptions.length;

        for (uint256 i = 0; i < _milestoneDescriptions.length; i++) {
            milestones[id].push(Milestone(_milestoneDescriptions[i], 0, 0));
        }

        emit CampaignCreated(id, msg.sender, _title, _goal, c.deadline);
        return id;
    }

    // Anyone can donate ETH to a campaign
    function donate(uint256 _id) public payable {
        Campaign storage c = campaigns[_id];
        require(c.creator != address(0), "Campaign does not exist");
        require(block.timestamp < c.deadline, "Campaign has ended");
        require(msg.value > 0, "Send some ETH");

        c.raised += msg.value;
        contributions[_id][msg.sender] += msg.value;

        emit Donated(_id, msg.sender, msg.value);
    }

    // Donors vote on the current milestone.
    // More donation = more voting weight.
    function voteMilestone(uint256 _id, bool _approve) public {
        Campaign storage c = campaigns[_id];
        require(c.raised >= c.goal, "Goal not reached yet");
        require(c.currentMilestone < c.milestoneCount, "All milestones done");

        uint256 weight = contributions[_id][msg.sender];
        require(weight > 0, "Only donors can vote");
        require(!hasVoted[_id][c.currentMilestone][msg.sender], "Already voted");

        hasVoted[_id][c.currentMilestone][msg.sender] = true;

        Milestone storage m = milestones[_id][c.currentMilestone];
        if (_approve) {
            m.yesVotes += weight;
        } else {
            m.noVotes += weight;
        }

        emit Voted(_id, c.currentMilestone, msg.sender, _approve, weight);
    }

    // Creator takes the money for the current milestone if donors approved
    function releaseMilestone(uint256 _id) public {
        Campaign storage c = campaigns[_id];
        require(msg.sender == c.creator, "Only creator can withdraw");
        require(c.raised >= c.goal, "Goal not reached yet");
        require(c.currentMilestone < c.milestoneCount, "All milestones done");

        Milestone storage m = milestones[_id][c.currentMilestone];
        require(m.yesVotes > m.noVotes, "Donors have not approved");

        // Each milestone gets an equal share. The last one gets the remainder.
        uint256 amount;
        if (c.currentMilestone == c.milestoneCount - 1) {
            amount = c.raised - c.released;
        } else {
            amount = c.raised / c.milestoneCount;
        }

        // Update state BEFORE sending money (prevents reentrancy attack)
        uint256 doneMilestone = c.currentMilestone;
        c.released += amount;
        c.currentMilestone++;

        (bool sent, ) = c.creator.call{value: amount}("");
        require(sent, "Transfer failed");

        emit FundsReleased(_id, doneMilestone, amount);
    }

    // If the goal was not reached by the deadline, donors get money back
    function claimRefund(uint256 _id) public {
        Campaign storage c = campaigns[_id];
        require(block.timestamp >= c.deadline, "Campaign still running");
        require(c.raised < c.goal, "Goal was reached, no refund");

        uint256 amount = contributions[_id][msg.sender];
        require(amount > 0, "Nothing to refund");

        // Set to 0 BEFORE sending money (prevents reentrancy attack)
        contributions[_id][msg.sender] = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Refund failed");

        emit Refunded(_id, msg.sender, amount);
    }

    // ---------- 4. READ-ONLY HELPERS (free to call) ----------

    function getMilestone(uint256 _id, uint256 _index)
        public
        view
        returns (string memory description, uint256 yesVotes, uint256 noVotes)
    {
        Milestone storage m = milestones[_id][_index];
        return (m.description, m.yesVotes, m.noVotes);
    }
}
