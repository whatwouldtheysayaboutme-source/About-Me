// server.js
"use strict";

const express = require("express");
const path = require("path");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const sgMail = require("@sendgrid/mail");

// -----------------------------
// APP INIT (MUST COME BEFORE app.use)
// -----------------------------
const app = express();

// -----------------------------
// CONFIG
// -----------------------------
app.use(cors());
app.use(express.json({ limit: "2mb" })); // bump if you store large base64 photos
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const FROM_EMAIL = process.env.FROM_EMAIL || "";

if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI is not set in environment variables.");
  process.exit(1);
}

// SendGrid is optional (won't crash if missing)
const HAS_SENDGRID = !!process.env.SENDGRID_API_KEY;
if (HAS_SENDGRID) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn("WARNING: SENDGRID_API_KEY not set. Invite emails will not send.");
}

let db;

// -----------------------------
// MODERATION HELPERS
// -----------------------------
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

function normalizeForProfanity(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[@$!1\|\*]/g, "i")
    .replace(/0/g, "o")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsProfanity(text) {
  const normalized = normalizeForProfanity(text);
  if (!normalized) return false;

  const words = normalized.split(" ");
  for (const w of words) {
    if (w && PROFANITY_LIST.includes(w)) return true;
  }

  for (const bad of PROFANITY_LIST) {
    if (normalized.includes(bad)) return true;
  }

  return false;
}

function looksLikeSpam(message) {
  if (!message || typeof message !== "string") return true;
  const text = message.trim();

  if (text.length < 5) return true;
  if (text.length > 5000) return true;

  if (/^(.)\1{9,}$/.test(text.replace(/\s/g, ""))) return true;

  const urlMatches = text.match(/https?:\/\/[^\s]+/gi);
  if (urlMatches && urlMatches.length > 3) return true;

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length > 10) {
    const counts = {};
    for (const w of words) counts[w] = (counts[w] || 0) + 1;
    const maxCount = Math.max(...Object.values(counts));
    if (maxCount / words.length > 0.7) return true;
  }

  return false;
}

function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  return /^\S+@\S+\.\S+$/.test(email.trim());
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
    const normalizedEmail = String(email).toLowerCase().trim();

    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Email already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await users.insertOne({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date(),
      photoData: null,
    });

    return res.json({
      ok: true,
      user: { id: result.insertedId, name: String(name).trim(), email: normalizedEmail },
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
      return res.status(400).json({ ok: false, error: "Email and password required." });
    }

    const users = db.collection("users");
    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await users.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ ok: false, error: "Invalid email or password." });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ ok: false, error: "Invalid email or password." });
    }

    return res.json({
      ok: true,
      user: { id: user._id, name: user.name, email: user.email },
      token: "devtoken-" + user._id,
    });
  } catch (err) {
    console.error("/api/login error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// SAVE TRIBUTE (stores isPublic + moderation)
// -----------------------------
app.post("/api/tributes", async (req, res) => {
  try {
    const { toName, fromName, message, isPublic, hpField } = req.body;

    // Honeypot
    if (hpField && typeof hpField === "string" && hpField.trim() !== "") {
      return res.json({ ok: true });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ ok: false, error: "Message is required." });
    }

    if (containsProfanity(message)) {
      return res.status(400).json({
        ok: false,
        error: "This message looks like it contains offensive language. Please rephrase it in a positive, respectful way.",
      });
    }

    if (looksLikeSpam(message)) {
      return res.status(400).json({
        ok: false,
        error: "This message looks like spam or very low-quality text. Please write something more meaningful.",
      });
    }

    const tributes = db.collection("tributes");
    const users = db.collection("users");

    const cleanedToName = toName && typeof toName === "string" ? toName.trim() : null;
    const cleanedFromName =
      fromName && typeof fromName === "string" ? fromName.trim() : null;

    let isPublicFlag = true;
    if (typeof isPublic === "boolean") isPublicFlag = isPublic;

    let recipientId = null;
    if (cleanedToName) {
      const recipient = await users.findOne({ name: cleanedToName });
      if (recipient) recipientId = recipient._id;
    }

    await tributes.insertOne({
      toName: cleanedToName,
      fromName: cleanedFromName,
      message: message.trim(),
      recipientId: recipientId || null,
      isPublic: isPublicFlag,
      createdAt: new Date(),
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/tributes POST error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// LIST TRIBUTES FOR LOGGED-IN USER (public + private)
// -----------------------------
app.get("/api/my-tributes", async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing userId in query string." });
    }

    const users = db.collection("users");
    let user;
    try {
      user = await users.findOne({ _id: new ObjectId(userId) });
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid userId." });
    }

    if (!user) return res.status(404).json({ ok: false, error: "User not found." });

    const tributes = db.collection("tributes");
    const results = await tributes
      .find({ $or: [{ recipientId: user._id }, { toName: user.name }] })
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
// GENERIC LIST TRIBUTES (by ?to=Name) - PUBLIC ONLY
// -----------------------------
app.get("/api/tributes", async (req, res) => {
  try {
    const { to } = req.query;
    const tributes = db.collection("tributes");

    const query = {};
    if (to && typeof to === "string") query.toName = to.trim();

    // show only public (and treat missing isPublic as public)
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
    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId." });

    const users = db.collection("users");
    const tributes = db.collection("tributes");

    let user;
    try {
      user = await users.findOne({ _id: new ObjectId(userId) });
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid userId." });
    }
    if (!user) return res.status(404).json({ ok: false, error: "User not found." });

    await tributes.deleteMany({ $or: [{ recipientId: user._id }, { toName: user.name }] });
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
    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId." });

    let userObjectId;
    try {
      userObjectId = new ObjectId(userId);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid userId." });
    }

    const users = db.collection("users");
    await users.updateOne({ _id: userObjectId }, { $set: { photoData: photoData || null } });

    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/profile-photo error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// FEEDBACK ENDPOINT (with moderation)
// -----------------------------
app.post("/api/feedback", async (req, res) => {
  try {
    const { email, message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.json({ ok: false, error: "Missing message." });
    }

    if (containsProfanity(message)) {
      return res.json({
        ok: false,
        error: "Please keep feedback respectful. This looks like it contains offensive language.",
      });
    }

    if (looksLikeSpam(message)) {
      return res.json({
        ok: false,
        error: "This feedback looks like spam. Please add more detail or context.",
      });
    }

    console.log("Feedback received:", { email: email || "(no email)", message });
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

    if (!user) return res.json({ ok: true, user: null });

    return res.json({
      ok: true,
      user: { id: user._id, name: user.name, photoData: user.photoData || null },
    });
  } catch (err) {
    console.error("/api/user-by-name error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// SEND INVITE EMAIL (simple v1)
// -----------------------------
app.post("/api/send-invite-email", async (req, res) => {
  try {
    const { toEmail, ownerName, inviteUrl } = req.body;

    if (!toEmail || !inviteUrl) {
      return res.status(400).json({ ok: false, error: "Missing email or invite link." });
    }

    if (!isValidEmail(toEmail)) {
      return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
    }

    if (!HAS_SENDGRID) {
      return res.status(400).json({
        ok: false,
        error: "Email sending is not configured (missing SENDGRID_API_KEY).",
      });
    }

    if (!FROM_EMAIL) {
      return res.status(400).json({
        ok: false,
        error: "Email sending is not configured (missing FROM_EMAIL).",
      });
    }

    await sgMail.send({
      to: toEmail.trim(),
      from: FROM_EMAIL,
      subject: `${ownerName || "A friend"} invited you to write a message`,
      text: `Use this private link:\n\n${inviteUrl}`,
      html: `
        <p><strong>${ownerName || "A friend"}</strong> invited you to write a message.</p>
        <p><a href="${inviteUrl}">Click here to write your message</a></p>
        <p style="font-size:12px;color:#666;">If you didn’t expect this, you can ignore this email.</p>
      `,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Send invite email failed:", err);
    return res.status(500).json({ ok: false, error: "Failed to send email." });
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
