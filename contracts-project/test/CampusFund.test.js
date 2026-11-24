const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CampusFund", function () {

  // ---------- SETUP ----------
  // This runs before each test: deploys a fresh contract and creates one campaign
  // (goal 10 ETH, 7 days, 3 milestones)
  async function deployFixture() {
    const [creator, donor1, donor2, stranger] = await ethers.getSigners();

    const CampusFund = await ethers.getContractFactory("CampusFund");
    const fund = await CampusFund.deploy();
    await fund.waitForDeployment();

    await fund
      .connect(creator)
      .createCampaign("Tech Fest", ethers.parseEther("10"), 7, [
        "Book venue",
        "Book speakers",
        "Run event",
      ]);

    return { fund, creator, donor1, donor2, stranger };
  }

  // Helper: donor1 gives 6 ETH + donor2 gives 4 ETH = goal reached
  async function fundCampaign(fund, donor1, donor2) {
    await fund.connect(donor1).donate(1, { value: ethers.parseEther("6") });
    await fund.connect(donor2).donate(1, { value: ethers.parseEther("4") });
  }

  // ---------- TESTS ----------

  it("1. creates a campaign", async function () {
    const { fund, creator } = await loadFixture(deployFixture);
    const c = await fund.campaigns(1);
    expect(c.title).to.equal("Tech Fest");
    expect(c.creator).to.equal(creator.address);
    expect(c.goal).to.equal(ethers.parseEther("10"));
    expect(await fund.campaignCount()).to.equal(1);
  });

  it("2. accepts a donation and records it", async function () {
    const { fund, donor1 } = await loadFixture(deployFixture);
    await fund.connect(donor1).donate(1, { value: ethers.parseEther("3") });
    expect(await fund.contributions(1, donor1.address)).to.equal(ethers.parseEther("3"));
    const c = await fund.campaigns(1);
    expect(c.raised).to.equal(ethers.parseEther("3"));
  });

  it("3. rejects a donation of 0 ETH", async function () {
    const { fund, donor1 } = await loadFixture(deployFixture);
    await expect(
      fund.connect(donor1).donate(1, { value: 0 })
    ).to.be.revertedWith("Send some ETH");
  });

  it("4. blocks voting before the goal is reached", async function () {
    const { fund, donor1 } = await loadFixture(deployFixture);
    await fund.connect(donor1).donate(1, { value: ethers.parseEther("3") });
    await expect(
      fund.connect(donor1).voteMilestone(1, true)
    ).to.be.revertedWith("Goal not reached yet");
  });

  it("5. happy path: donate, vote, creator gets first milestone money", async function () {
    const { fund, creator, donor1, donor2 } = await loadFixture(deployFixture);
    await fundCampaign(fund, donor1, donor2);

    // donor1 (6 ETH weight) votes yes, donor2 (4 ETH weight) votes no
    await fund.connect(donor1).voteMilestone(1, true);
    await fund.connect(donor2).voteMilestone(1, false);

    // each milestone gets 10 / 3 of the raised money
    const share = ethers.parseEther("10") / 3n;

    await expect(fund.connect(creator).releaseMilestone(1)).to.changeEtherBalance(
      creator,
      share
    );

    const c = await fund.campaigns(1);
    expect(c.currentMilestone).to.equal(1); // moved to milestone 2
  });

  it("6. blocks double voting", async function () {
    const { fund, donor1, donor2 } = await loadFixture(deployFixture);
    await fundCampaign(fund, donor1, donor2);
    await fund.connect(donor1).voteMilestone(1, true);
    await expect(
      fund.connect(donor1).voteMilestone(1, true)
    ).to.be.revertedWith("Already voted");
  });

  it("7. blocks a non-donor from voting", async function () {
    const { fund, donor1, donor2, stranger } = await loadFixture(deployFixture);
    await fundCampaign(fund, donor1, donor2);
    await expect(
      fund.connect(stranger).voteMilestone(1, true)
    ).to.be.revertedWith("Only donors can vote");
  });

  it("8. blocks a non-creator from withdrawing", async function () {
    const { fund, donor1, donor2, stranger } = await loadFixture(deployFixture);
    await fundCampaign(fund, donor1, donor2);
    await fund.connect(donor1).voteMilestone(1, true);
    await expect(
      fund.connect(stranger).releaseMilestone(1)
    ).to.be.revertedWith("Only creator can withdraw");
  });

  it("9. blocks withdrawal when donors have not approved", async function () {
    const { fund, creator, donor1, donor2 } = await loadFixture(deployFixture);
    await fundCampaign(fund, donor1, donor2);
    await expect(
      fund.connect(creator).releaseMilestone(1)
    ).to.be.revertedWith("Donors have not approved");
  });

  it("10. refunds donors when the goal is not reached by the deadline", async function () {
    const { fund, donor1 } = await loadFixture(deployFixture);
    await fund.connect(donor1).donate(1, { value: ethers.parseEther("3") });

    // move time forward 8 days (deadline was 7 days)
    await time.increase(8 * 24 * 60 * 60);

    await expect(fund.connect(donor1).claimRefund(1)).to.changeEtherBalance(
      donor1,
      ethers.parseEther("3")
    );
  });

  it("11. blocks a second refund claim", async function () {
    const { fund, donor1 } = await loadFixture(deployFixture);
    await fund.connect(donor1).donate(1, { value: ethers.parseEther("3") });
    await time.increase(8 * 24 * 60 * 60);

    await fund.connect(donor1).claimRefund(1);
    await expect(
      fund.connect(donor1).claimRefund(1)
    ).to.be.revertedWith("Nothing to refund");
  });

  it("12. blocks refunds when the goal was reached", async function () {
    const { fund, donor1, donor2 } = await loadFixture(deployFixture);
    await fundCampaign(fund, donor1, donor2);
    await time.increase(8 * 24 * 60 * 60);

    await expect(
      fund.connect(donor1).claimRefund(1)
    ).to.be.revertedWith("Goal was reached, no refund");
  });
});
