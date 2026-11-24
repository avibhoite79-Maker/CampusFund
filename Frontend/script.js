// ---------- 1. SETTINGS AND VARIABLES ----------

// Address of our backend. Change it to your Vercel backend link after deploying.
const API_URL = "http://localhost:5000";

const SEPOLIA_CHAIN_ID = 11155111n;

let signer;    // the connected MetaMask account (can send transactions)
let contract;  // our smart contract, ready to call
let account;   // address of the connected account

// ---------- 2. SMALL HELPER FUNCTIONS ----------

// Shows a message at the bottom. type = "info", "success" or "error"
function setStatus(message, type) {
  const box = document.getElementById("status");
  box.innerText = message;
  box.className = message ? "toast show " + (type || "info") : "toast";
}

// Makes text safe before putting it on the page
function safe(text) {
  const div = document.createElement("div");
  div.innerText = text;
  return div.innerHTML;
}

// Turns "1.5000" into "1.5"
function eth(value) {
  return Number(ethers.formatEther(value));
}

// ---------- 3. CONNECT METAMASK ----------

async function connectWallet() {
  if (!window.ethereum) {
    setStatus("MetaMask is not installed. Install it and reload this page.", "error");
    return;
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []); // MetaMask popup

    const network = await provider.getNetwork();
    if (network.chainId !== SEPOLIA_CHAIN_ID) {
      setStatus("Switch MetaMask to the Sepolia network, then click Connect again.", "error");
      return;
    }

    signer = await provider.getSigner();
    account = await signer.getAddress();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    document.getElementById("account").innerText = account.slice(0, 6) + "..." + account.slice(-4);
    document.getElementById("connectBtn").innerText = "Connected";
    setStatus("");
    loadCampaigns();
  } catch (error) {
    setStatus("Could not connect: " + (error.shortMessage || error.message), "error");
  }
}

// Reload the page if the user switches account or network in MetaMask
if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => location.reload());
  window.ethereum.on("chainChanged", () => location.reload());
}

// ---------- 4. BACKEND (descriptions) ----------

async function getDescriptions() {
  try {
    const response = await fetch(API_URL + "/api/campaigns");
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return []; // backend not running: the page still works without descriptions
  }
}

// ---------- 5. SHOW CAMPAIGNS (read from the blockchain) ----------

// Draws the ring: outer ring = one segment per milestone, inner ring = funding progress
function ringSvg(total, current, goalReached, percent) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const gap = total > 1 ? 6 : 0;
  const seg = circ / total - gap;

  let arcs = "";
  for (let k = 0; k < total; k++) {
    let cls = "seg next";
    if (k < current) cls = "seg done";
    else if (k === current && goalReached) cls = "seg now";
    arcs +=
      '<circle class="' + cls + '" cx="65" cy="65" r="' + r + '"' +
      ' stroke-dasharray="' + seg + " " + (circ - seg) + '"' +
      ' stroke-dashoffset="' + (-k * circ / total) + '" />';
  }

  const r2 = 38;
  const circ2 = 2 * Math.PI * r2;
  const fundDash = (circ2 * percent) / 100;

  return (
    '<svg class="ring" viewBox="0 0 130 130">' +
    '<g transform="rotate(-90 65 65)">' + arcs +
    '<circle class="fund-track" cx="65" cy="65" r="' + r2 + '" />' +
    '<circle class="fund" cx="65" cy="65" r="' + r2 + '" stroke-dasharray="' + fundDash + " " + circ2 + '" />' +
    "</g>" +
    '<text class="ring-pct" x="65" y="68">' + Math.round(percent) + "%</text>" +
    '<text class="ring-sub" x="65" y="82">funded</text>' +
    "</svg>"
  );
}

async function loadCampaigns() {
  const box = document.getElementById("campaigns");

  try {
    const count = Number(await contract.campaignCount());
    const descriptions = await getDescriptions();

    if (count === 0) {
      box.innerHTML = '<div class="empty">No campaigns yet. Start the first one with the form.</div>';
      return;
    }

    let html = "";

    // newest campaign first
    for (let i = count; i >= 1; i--) {
      const c = await contract.campaigns(i);
      const myDonation = await contract.contributions(i, account);

      const found = descriptions.find((d) => d.campaignId === i);
      const description = found ? found.description : "";

      const current = Number(c.currentMilestone);
      const total = Number(c.milestoneCount);
      const raised = eth(c.raised);
      const goal = eth(c.goal);
      const percent = goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;

      const goalReached = c.raised >= c.goal;
      const ended = Date.now() / 1000 >= Number(c.deadline);
      const isCreator = c.creator.toLowerCase() === account.toLowerCase();
      const deadlineText = new Date(Number(c.deadline) * 1000).toLocaleString();

      // badge that shows the campaign state
      let badge = '<span class="badge">Open for donations</span>';
      if (current >= total) {
        badge = '<span class="badge done">Completed</span>';
      } else if (goalReached) {
        badge = '<span class="badge goal">Goal reached, voting open</span>';
      } else if (ended) {
        badge = '<span class="badge failed">Goal missed, refunds open</span>';
      }

      // milestone steps: shows where the locked money is
      const share = Number((raised / total).toFixed(4));
      let steps = "";
      for (let k = 0; k < total; k++) {
        const m = await contract.getMilestone(i, k);
        let state = "next";
        let info = share + " ETH, locked";

        if (k < current) {
          state = "done";
          info = share + " ETH, released";
        } else if (k === current) {
          state = "current";
          info = goalReached ? share + " ETH, donors are voting" : share + " ETH, locked until the goal is met";
        }

        let votes = "";
        if (state === "current" && goalReached) {
          const yes = eth(m.yesVotes);
          const no = eth(m.noVotes);
          const yesPercent = yes + no > 0 ? (yes / (yes + no)) * 100 : 0;
          votes =
            '<div class="votebar"><span style="width:' + yesPercent + '%"></span></div>' +
            '<div class="step-info">Yes ' + yes + " ETH, No " + no + " ETH</div>";
        }

        steps +=
          '<li class="step ' + state + '">' +
          '<div class="step-title">' + safe(m.description) + "</div>" +
          '<div class="step-info">' + info + "</div>" + votes +
          "</li>";
      }

      // buttons: show only the actions that make sense right now
      let actions = "";
      if (!ended && current < total) {
        actions +=
          '<input id="amount-' + i + '" placeholder="Amount in ETH" />' +
          '<button class="btn primary" onclick="donate(' + i + ')">Donate</button>';
      }
      if (goalReached && current < total) {
        actions +=
          '<button class="btn" onclick="vote(' + i + ', true)">Approve milestone</button>' +
          '<button class="btn danger" onclick="vote(' + i + ', false)">Reject milestone</button>';
        if (isCreator) {
          actions += '<button class="btn primary" onclick="release(' + i + ')">Release funds</button>';
        }
      }
      if (ended && !goalReached && myDonation > 0n) {
        actions += '<button class="btn danger" onclick="refund(' + i + ')">Claim refund</button>';
      }
      if (!goalReached && !ended) {
        actions += '<span class="small">Voting opens when the goal is reached.</span>';
      }
      actions += '<span class="mine">Your donation: ' + eth(myDonation) + " ETH</span>";

      const shortCreator = c.creator.slice(0, 6) + "..." + c.creator.slice(-4);

      html += `
        <article class="card">
          <div class="card-top">
            <div class="ring-wrap">${ringSvg(total, current, goalReached, percent)}</div>
            <div class="card-main">
              <div class="card-head"><h3>${safe(c.title)}</h3>${badge}</div>
              ${description ? '<p class="desc">' + safe(description) + "</p>" : ""}
              <p class="small">Organiser ${shortCreator}${isCreator ? " (you)" : ""} | ${ended ? "Ended " : "Ends "}${deadlineText}</p>
              <div class="raised"><b>${raised} ETH</b><span class="small">of ${goal} ETH goal</span></div>
            </div>
          </div>
          <ul class="steps">${steps}</ul>
          <div class="actions">${actions}</div>
        </article>`;
    }

    box.innerHTML = html;
  } catch (error) {
    box.innerHTML =
      '<div class="empty">Could not load campaigns. Check the contract address in contract.js.</div>';
    setStatus("Error: " + (error.shortMessage || error.message), "error");
  }
}

// ---------- 6. SEND TRANSACTIONS ----------

// One helper used by every button: ask MetaMask, wait, then refresh the list
async function sendTx(action, successMessage) {
  if (!contract) {
    setStatus("Connect MetaMask first.", "error");
    return;
  }
  try {
    setStatus("Approve the transaction in MetaMask...", "info");
    const tx = await action();
    setStatus("Transaction sent. Waiting for confirmation...", "info");
    await tx.wait();
    setStatus(successMessage, "success");
    loadCampaigns();
  } catch (error) {
    setStatus("Failed: " + (error.reason || error.shortMessage || error.message), "error");
  }
}

async function createCampaign() {
  if (!contract) {
    setStatus("Connect MetaMask first.", "error");
    return;
  }

  const title = document.getElementById("title").value;
  const goal = document.getElementById("goal").value;
  const days = document.getElementById("days").value;
  const description = document.getElementById("description").value;
  const milestoneList = document
    .getElementById("milestones")
    .value.split(",")
    .map((m) => m.trim())
    .filter((m) => m !== "");

  if (!title || !goal || !days || milestoneList.length === 0) {
    setStatus("Fill in the title, goal, days and at least one milestone.", "error");
    return;
  }

  try {
    // Step 1: save the campaign on the blockchain
    setStatus("Approve the transaction in MetaMask...", "info");
    const tx = await contract.createCampaign(title, ethers.parseEther(goal), Number(days), milestoneList);
    setStatus("Transaction sent. Waiting for confirmation...", "info");
    await tx.wait();

    // Step 2: save the description in our backend
    const id = Number(await contract.campaignCount());
    try {
      await fetch(API_URL + "/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id, description: description, creator: account }),
      });
    } catch (error) {
      console.log("Backend not available, description not saved");
    }

    setStatus("Campaign created.", "success");
    loadCampaigns();
  } catch (error) {
    setStatus("Failed: " + (error.reason || error.shortMessage || error.message), "error");
  }
}

function donate(id) {
  const amount = document.getElementById("amount-" + id).value;
  if (!amount) {
    setStatus("Enter an amount in ETH first.", "error");
    return;
  }
  sendTx(() => contract.donate(id, { value: ethers.parseEther(amount) }), "Donation sent.");
}

function vote(id, approve) {
  sendTx(() => contract.voteMilestone(id, approve), "Vote recorded.");
}

function release(id) {
  sendTx(() => contract.releaseMilestone(id), "Milestone funds released.");
}

function refund(id) {
  sendTx(() => contract.claimRefund(id), "Refund claimed.");
}
