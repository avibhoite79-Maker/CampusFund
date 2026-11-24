const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());          // lets our website (another address) call this backend
app.use(express.json());  // lets the backend read JSON sent by the website

// ---------- 1. DATA STORAGE ----------
// We keep campaign descriptions in a simple file called db.json.
// (On Vercel only the /tmp folder can be written, so we use that there.)
const DB_FILE = process.env.VERCEL ? "/tmp/db.json" : path.join(__dirname, "db.json");

// Read all saved descriptions (an empty list if the file does not exist yet)
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (error) {
    return [];
  }
}

// Save the whole list back to the file
function saveData(list) {
  fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2));
}

// ---------- 2. ROUTES (the API) ----------

// Test route: open the backend link in a browser to check it is running
app.get("/", (req, res) => {
  res.send("CampusFund backend is running");
});

// Get all campaign descriptions
app.get("/api/campaigns", (req, res) => {
  res.json(readData());
});

// Get one campaign's description
app.get("/api/campaigns/:id", (req, res) => {
  const item = readData().find((c) => c.campaignId === Number(req.params.id));
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

// Save (or update) a campaign's description
app.post("/api/campaigns", (req, res) => {
  const { campaignId, description, imageUrl, creator } = req.body;

  if (campaignId === undefined || !description) {
    return res.status(400).json({ error: "campaignId and description are required" });
  }

  const record = {
    campaignId: Number(campaignId),
    description: description,
    imageUrl: imageUrl || "",
    creator: creator || "",
  };

  const list = readData();
  const index = list.findIndex((c) => c.campaignId === record.campaignId);

  if (index >= 0) {
    list[index] = record;   // already exists: update it
  } else {
    list.push(record);      // new campaign: add it
  }

  try {
    saveData(list);
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: "Could not save campaign" });
  }
});

// ---------- 3. START THE SERVER ----------
// Vercel uses the exported app. On your computer we start it ourselves.
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log("Backend running on port " + PORT));
}
