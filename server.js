"use strict";

const express = require("express");
const path = require("path");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const sgMail = require("@sendgrid/mail");

// -----------------------------
// APP INIT (MUST COME FIRST)
// -----------------------------
const app = express();

// -----------------------------
// CONFIG
// -----------------------------
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const FROM_EMAIL = process.env.FROM_EMAIL || "";

if (!MONGODB_URI) {
  console.error("ERROR: MONGODB_URI is not set.");
  process.exit(1);
}

// SendGrid (optional but logged)
const HAS_SENDGRID = !!process.env.SENDGRID_API_KEY;
if (HAS_SENDGRID) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("SendGrid configured");
} else {
  console.warn("WARNING: SENDGRID_API_KEY not set. Emails disabled.");
}

let db;

// -----------------------------
// HELPERS
// -----------------------------
function isValidEmail(email) {
  return typeof email === "string" && /^\S+@\S+\.\S+$/.test(email.trim());
}

// -----------------------------
// CONNECT TO MONGODB
// -----------------------------
async function connectToMongo() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db("about-me");
  console.log("Connected to MongoDB (about-me)");
}

// -----------------------------
// HEALTH
// -----------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// -----------------------------
// REGISTER
// -----------------------------
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const users = db.collection("users");
    const normalizedEmail = email.toLowerCase().trim();

    if (await users.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ ok: false, error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await users.insertOne({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date(),
      photoData: null
    });

    res.json({
      ok: true,
      user: { id: result.insertedId, name, email: normalizedEmail },
      token: "devtoken-" + result.insertedId
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ ok: false });
  }
});

// -----------------------------
// LOGIN
// -----------------------------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = db.collection("users");
    const user = await users.findOne({ email: email.toLowerCase().trim() });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    res.json({
      ok: true,
      user: { id: user._id, name: user.name, email: user.email },
      token: "devtoken-" + user._id
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ ok: false });
  }
});

// -----------------------------
// SEND INVITE EMAIL
// -----------------------------
app.post("/api/send-invite-email", async (req, res) => {
  try {
    const { toEmail, ownerName, inviteUrl } = req.body;

    if (!toEmail || !inviteUrl) {
      return res.status(400).json({ ok: false, error: "Missing data" });
    }

    if (!isValidEmail(toEmail)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    if (!HAS_SENDGRID || !FROM_EMAIL) {
      console.error("Email not configured");
      return res.status(500).json({ ok: false, error: "Email service unavailable" });
    }

    const msg = {
      to: toEmail.trim(),
      from: { email: FROM_EMAIL, name: "About Me" },
      subject: `${ownerName || "A friend"} invited you`,
      text: `Write your message here:\n${inviteUrl}`,
      html: `
        <p><strong>${ownerName || "A friend"}</strong> invited you to write a message.</p>
        <p><a href="${inviteUrl}">Click here to write your message</a></p>
        <p style="font-size:12px;color:#666;">You may ignore this email.</p>
      `
    };

    const response = await sgMail.send(msg);
    console.log("SendGrid SUCCESS:", response[0].statusCode);

    res.json({ ok: true });

  } catch (err) {
    console.error("SendGrid ERROR:", err?.response?.body || err);
    res.status(500).json({ ok: false, error: "Email failed" });
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
