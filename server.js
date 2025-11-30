// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

let db;

// CONNECT TO MONGO
async function connectToMongo() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db('about-me'); // database name
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Mongo connection error:', err);
    process.exit(1);
  }
}

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'API running' });
});

// USERS COUNT ROUTE (optional, for your own stats)
app.get('/api/users/count', async (req, res) => {
  try {
    const users = db.collection('users');
    const count = await users.countDocuments();
    return res.json({ ok: true, count });
  } catch (err) {
    console.error('/api/users/count error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// REGISTER ROUTE
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required.' });
    }

    const users = db.collection('users');
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await users.insertOne({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date(),
    });

    return res.json({
      ok: true,
      user: {
        id: result.insertedId,
        name: name.trim(),
        email: normalizedEmail,
      },
    });
  } catch (err) {
    console.error('/api/register error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN ROUTE
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }

    const users = db.collection('users');
    const normalizedEmail = email.toLowerCase().trim();

    const user = await users.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    return res.json({
      ok: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('/api/login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// TRIBUTES: save a new tribute
app.post('/api/tributes', async (req, res) => {
  try {
    const { toName, fromName, message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ ok: false, error: 'Message is required.' });
    }

    const tributes = db.collection('tributes');

    const doc = {
      toName: toName && typeof toName === 'string' ? toName.trim() : null,
      fromName: fromName && typeof fromName === 'string' ? fromName.trim() : null,
      message: message.trim(),
      createdAt: new Date(),
    };

    await tributes.insertOne(doc);

    return res.json({ ok: true });
  } catch (err) {
    console.error('/api/tributes error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// TRIBUTES: list tributes, e.g. /api/tributes?to=Bobby
app.get('/api/tributes', async (req, res) => {
  try {
    const { to } = req.query;
    const tributes = db.collection('tributes');

    const query = {};
    if (to && typeof to === 'string') {
      query.toName = to.trim();
    }

    const items = await tributes
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return res.json({ ok: true, tributes: items });
  } catch (err) {
    console.error('/api/tributes GET error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

async function start() {
  await connectToMongo();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
