// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve static files (front-end)
app.use(express.static(path.join(__dirname, "public")));

// ----- MONGODB CONNECTION -----
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set in environment variables.");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ----- MONGOOSE MODEL -----
const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    relation: { type: String, trim: true },
    text: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

// ----- API ROUTES -----

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", time: new Date().toISOString() });
});

// Get latest messages
app.get("/api/messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(50);
    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Create new message
app.post("/api/messages", async (req, res) => {
  try {
    const { name, relation, text } = req.body;

    if (!name || !text) {
      return res
        .status(400)
        .json({ error: "Name and message text are required." });
    }

    const msg = new Message({ name, relation, text });
    await msg.save();

    res.status(201).json(msg);
  } catch (err) {
    console.error("Error creating message:", err);
    res.status(500).json({ error: "Failed to save message" });
  }
});

// Fallback to front-end (for root URL)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ----- START SERVER -----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
