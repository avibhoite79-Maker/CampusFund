# CampusFund
CampusFund is a crowdfunding website made on the Ethereum blockchain. It is our semester project.

In normal crowdfunding, people donate money and just trust the organiser to use it properly. In CampusFund the money does not go to the organiser directly. It stays inside a smart contract and is given to the organiser step by step (milestone by milestone), only when the donors vote that the work for that step is done.

## Live links
- Website: https://campusfund-frontend.vercel.app
- Backend: https://collegefund-gamma.vercel.app
- Network: Sepolia test network (you need MetaMask and some free Sepolia ETH)
- Contract address: 0xb4cc2A5F7CeC7bA68ECd91aaC485bd12c958900e

## How it works
1. The organiser creates a campaign with a title, a goal in ETH, number of days and 1 to 5 milestones.
2. Donors send ETH to the campaign. The ETH is held by the smart contract.
3. When the goal is reached, donors can vote yes or no for the current milestone. A donor who gave more ETH has more voting weight.
4. If yes votes are more than no votes, the organiser can click "Release funds" and gets that milestone's share of the money.
5. The same happens for the next milestone, until all are done.
6. If the goal is not reached before the deadline, every donor can take their money back (refund).

## Features
- Create a campaign
- Donate ETH
- Vote on milestones (weighted by donation)
- Organiser withdraws money milestone by milestone
- Refund if the goal is not reached
- Campaign descriptions are saved in the backend

## Technologies used
- Solidity and Hardhat for the smart contract and testing
- HTML, CSS and JavaScript for the website
- ethers.js to connect the website with MetaMask and the contract
- Node.js and Express for the backend
- Sepolia testnet for deployment
- GitHub and Vercel for code and hosting

## Folders
```
CampusFund
|-- contracts-project   smart contract (CampusFund.sol), tests and deploy script
|-- Frontend            the website (index.html, style.css, script.js, contract.js)
|-- backend             Express server that stores campaign descriptions
```

## Why we need a backend
Storing long text on the blockchain costs gas, so we keep only money, votes and campaign rules on the blockchain. The description of each campaign is saved by the backend (in a db.json file) using the same campaign id as the contract.
Backend routes:

- GET /api/campaigns : get all descriptions
- GET /api/campaigns/:id : get one description
- POST /api/campaigns : save a description

## How to run it on your computer
Smart contract:
```
cd contracts-project
npm install
npx hardhat test
```
To deploy, make a .env file in contracts-project with Sepolia_rpc_url and Private_key, then run:

```
npx hardhat run scripts/deploy.js --network sepolia
```

Backend:

```
cd backend
npm install
node index.js
```

Website:

Open Frontend/index.html with the Live Server extension in VS Code. Put the contract address in Frontend/contract.js and set MetaMask to the Sepolia network.

## Testing
We wrote 12 tests in Hardhat. They check creating a campaign, donating, voting, double voting, withdrawing by a non-organiser, refunds and the case where the goal is not reached. All 12 tests pass.

## Security points
- The contract updates the balances before it sends ETH (this stops the reentrancy attack).
- Only the organiser can release funds.
- A donor can vote only once per milestone.
- The private key is kept in a .env file which is not uploaded to GitHub.

## Limitations
- If donors reject a milestone, there is no refund of the remaining money yet.
- The organiser can also donate to his own campaign and vote.
- On Vercel the backend file storage is temporary, so descriptions can disappear after some time. The campaigns, donations and votes are safe because they are on the blockchain.

## Future scope
- Refund of remaining money when a milestone is rejected
- Stop the organiser from voting on his own campaign
- Store images on IPFS
- Use a real database in the backend
- Payments in stablecoins

## Team
- Team Members:Avesh Bhoite, Sayali Suryawanshi, Tanuja Shirke.
- Course:Bsc(Blockchain Technology).
- College:Department of Technology,Savitribai Phule Pune University.
