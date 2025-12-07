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
// SAVE TRIBUTE
// -----------------------------
app.post("/api/tributes", async (req, res) => {
  try {
    const { toName, fromName, message } = req.body;

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

    // Optional: try to find a user whose name matches toName
    let recipientId = null;
    if (cleanedToName) {
      const recipient = await users.findOne({ name: cleanedToName });
      if (recipient) recipientId = recipient._id;
    }

    const doc = {
      toName: cleanedToName,
      fromName: cleanedFromName,
      message: message.trim(),
      recipientId: recipientId || null, // future-proof, not required for frontend
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

    // ✅ look up by recipientId OR by toName (covers old + new tributes)
    const results = await tributes
      .find({
        $or: [
          { recipientId: user._id },
          { toName: user.name }
        ]
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

// DELETE ACCOUNT
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

    // Delete tributes addressed to this user
    await tributes.deleteMany({
      $or: [
        { recipientId: user._id },
        { toName: user.name }
      ],
    });

    // Delete the user
    await users.deleteOne({ _id: user._id });

    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/account DELETE error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// -----------------------------
// GENERIC LIST TRIBUTES (by ?to=Name)
// This is what your frontend is using now.
// -----------------------------
app.get("/api/tributes", async (req, res) => {
  try {
    const { to } = req.query;
    const tributes = db.collection("tributes");

    const query = {};
    if (to && typeof to === "string") {
      query.toName = to.trim();
    }

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
// FEEDBACK ENDPOINT
// -----------------------------
app.post("/api/feedback", async (req, res) => {
  try {
    const { email, message } = req.body;

    if (!message) {
      return res.json({ ok: false, error: "Missing message." });
    }

    // Right now you just log it. Later you could store in DB or send email.
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
// START SERVER
// -----------------------------
async function start() {
  await connectToMongo();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
