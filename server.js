// server.js
const express = require("express");
const path = require("path");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");

const app = express();

// -----------------------------
// CONFIG
// -----------------------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI is not set in environment variables.");
  process.exit(1);
}

let db;

// -----------------------------
// MODERATION HELPERS
// -----------------------------

// A moderate profanity list (not exhaustive, but solid for v1)
// You can add/remove words as you choose.
const PROFANITY_LIST = [
  "fuck",
  "fck",
  "fuk",
  "shit",
  "bitch",
  "bastard",
  "asshole",
  "dick",
  "cunt",
  "slut",
  "whore",
  "motherfucker",
  "mf",
  "faggot",
  "fag",
  "retard",
  "retarded",
  "nigger",
  "nigga",
  "cock",
  "pussy",
  "twat",
  "damn",
  "goddamn",
];

// Loosen up the text so f@ck, f*ck, f u c k all normalize to "fuck".
function normalizeForProfanity(text) {
  if (!text || typeof text !== "string") return "";

  return text
    .toLowerCase()
    .replace(/[@$!1\|\*]/g, "i")   // @, $, !, 1, |, * → i-ish
    .replace(/0/g, "o")           // 0 → o
    .replace(/3/g, "e")           // 3 → e
    .replace(/4/g, "a")           // 4 → a
    .replace(/5/g, "s")           // 5 → s
    .replace(/[^a-z0-9\s]/g, " ") // strip other symbols
    .replace(/\s+/g, " ");        // collapse spaces
}

function containsProfanity(text) {
  const normalized = normalizeForProfanity(text);
  if (!normalized) return false;

  // Simple word-based check
  const words = normalized.split(" ");
  for (const w of words) {
    if (!w) continue;
    if (PROFANITY_LIST.includes(w)) {
      return true;
    }
  }

  // Also check substrings for some strong words
  for (const bad of PROFANITY_LIST) {
    if (normalized.includes(bad)) {
      return true;
    }
  }

  return false;
}

// Very basic spam checks
function looksLikeSpam(message) {
  if (!message || typeof message !== "string") return true;
  const text = message.trim();

  // Too short to be meaningful
  if (text.length < 5) return true;

  // Very long = suspicious (simple upper bound)
  if (text.length > 5000) return true;

  // Same character repeated too much: "aaaaaa", "!!!!!!!", etc.
  if (/^(.)\1{9,}$/.test(text.replace(/\s/g, ""))) {
    return true;
  }

  // Too many URLs
  const urlMatches = text.match(/https?:\/\/[^\s]+/gi);
  if (urlMatches && urlMatches.length > 3) {
    return true;
  }

  // One word repeated over and over
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length > 10) {
    const counts = {};
    for (const w of words) {
      counts[w] = (counts[w] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(counts));
    // if one word is > 70% of the message, it's probably spammy
    if (maxCount / words.length > 0.7) return true;
  }

  return false;
}


// -----------------------------
// CONNECT TO MONGODB
// -----------------------------
async function connectToMongo() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db("about-me");
    console.log("Connected to MongoDB (about-me)");
  } catch (err) {
    console.error("Mongo connection error:", err);
    process.exit(1);
  }
}

// -----------------------------
// HEALTH CHECK
// -----------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API running" });
});

// -----------------------------
// USERS COUNT
// -----------------------------
app.get("/api/users/count", async (req, res) => {
  try {
    const users = db.collection("users");
    const count = await users.countDocuments();
    return res.json({ ok: true, count });
  } catch (err) {
    console.error("/api/users/count error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// REGISTER
// -----------------------------
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ ok: false, error: "Name, email, and password required." });
    }

    const users = db.collection("users");
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return res
        .status(409)
        .json({ ok: false, error: "Email already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

  const result = await users.insertOne({
  name: name.trim(),
  email: normalizedEmail,
  passwordHash,
  createdAt: new Date(),
  photoData: null, // will hold their profile photo (data URL or URL)
});


    const user = {
      id: result.insertedId,
      name: name.trim(),
      email: normalizedEmail,
    };

    return res.json({
      ok: true,
      user,
      token: "devtoken-" + result.insertedId,
    });
  } catch (err) {
    console.error("/api/register error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// LOGIN
// -----------------------------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, error: "Email and password required." });
    }

    const users = db.collection("users");
    const normalizedEmail = email.toLowerCase().trim();

    const user = await users.findOne({ email: normalizedEmail });
    if (!user) {
      return res
        .status(401)
        .json({ ok: false, error: "Invalid email or password." });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res
        .status(401)
        .json({ ok: false, error: "Invalid email or password." });
    }

    return res.json({
      ok: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token: "devtoken-" + user._id,
    });
  } catch (err) {
    console.error("/api/login error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// SAVE TRIBUTE  (stores isPublic)
// -----------------------------
app.post("/api/tributes", async (req, res) => {
  try {
    const { toName, fromName, message, isPublic } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res
        .status(400)
        .json({ ok: false, error: "Message is required." });
    }

    const tributes = db.collection("tributes");
    const users = db.collection("users");

    const cleanedToName =
      toName && typeof toName === "string" ? toName.trim() : null;
    const cleanedFromName =
      fromName && typeof fromName === "string" ? fromName.trim() : null;

    // Normalize isPublic: default true unless explicitly false
    let isPublicFlag = true;
    if (typeof isPublic === "boolean") {
      isPublicFlag = isPublic;
    }

    // Try to find a user whose name matches toName
    let recipientId = null;
    if (cleanedToName) {
      const recipient = await users.findOne({ name: cleanedToName });
      if (recipient) recipientId = recipient._id;
    }

    const doc = {
      toName: cleanedToName,
      fromName: cleanedFromName,
      message: message.trim(),
      recipientId: recipientId || null,
      isPublic: isPublicFlag,          // <--- store privacy flag
      createdAt: new Date(),
    };

    await tributes.insertOne(doc);

    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/tributes POST error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// LIST TRIBUTES FOR LOGGED-IN USER
// (shows BOTH public & private tributes)
// -----------------------------
app.get("/api/my-tributes", async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing userId in query string." });
    }

    const users = db.collection("users");
    let user;

    try {
      user = await users.findOne({ _id: new ObjectId(userId) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Invalid userId." });
    }

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found." });
    }

    const tributes = db.collection("tributes");

    const results = await tributes
      .find({
        $or: [{ recipientId: user._id }, { toName: user.name }],
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return res.json({ ok: true, tributes: results });
  } catch (err) {
    console.error("/api/my-tributes error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// GENERIC LIST TRIBUTES (by ?to=Name)
// Only returns PUBLIC tributes
// -----------------------------
app.get("/api/tributes", async (req, res) => {
  try {
    const { to } = req.query;
    const tributes = db.collection("tributes");

    const query = {};

    if (to && typeof to === "string") {
      query.toName = to.trim();
    }

    // Only show public tributes when listing generically
    // (treat docs with no isPublic as public for backward compatibility)
    query.isPublic = { $ne: false };

    const items = await tributes
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return res.json({ ok: true, tributes: items });
  } catch (err) {
    console.error("/api/tributes GET error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// DELETE ACCOUNT
// -----------------------------
app.delete("/api/account", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing userId." });
    }

    const users = db.collection("users");
    const tributes = db.collection("tributes");

    let user;
    try {
      user = await users.findOne({ _id: new ObjectId(userId) });
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Invalid userId." });
    }

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found." });
    }

    await tributes.deleteMany({
      $or: [{ recipientId: user._id }, { toName: user.name }],
    });

    await users.deleteOne({ _id: user._id });

    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/account DELETE error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});
// -----------------------------
// UPDATE PROFILE PHOTO
// -----------------------------
app.post("/api/profile-photo", async (req, res) => {
  try {
    const { userId, photoData } = req.body;

    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing userId." });
    }

    const users = db.collection("users");

    let userObjectId;
    try {
      userObjectId = new ObjectId(userId);
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Invalid userId." });
    }

    // photoData can be a data URL (from uploaded file) or a normal URL
    await users.updateOne(
      { _id: userObjectId },
      { $set: { photoData: photoData || null } }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/profile-photo error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// FEEDBACK ENDPOINT
// -----------------------------
app.post("/api/feedback", async (req, res) => {
  try {
    const { email, message } = req.body;

    if (!message) {
      return res.json({ ok: false, error: "Missing message." });
    }

    console.log("Feedback received:", {
      email: email || "(no email)",
      message,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/feedback error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});
// -----------------------------
// LOOK UP USER BY NAME (for invites)
// -----------------------------
app.get("/api/user-by-name", async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ ok: false, error: "Missing name." });
    }

    const users = db.collection("users");
    const user = await users.findOne({ name: name.trim() });

    if (!user) {
      return res.json({ ok: true, user: null });
    }

    return res.json({
      ok: true,
      user: {
        id: user._id,
        name: user.name,
        photoData: user.photoData || null,
      },
    });
  } catch (err) {
    console.error("/api/user-by-name error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// START SERVER
// -----------------------------
async function start() {
  await connectToMongo();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
