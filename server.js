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
    db = client.db('about-me'); 
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

    return res.json({ ok: true, userId: result.insertedId });
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
      }
    });
  } catch (err) {
    console.error('/api/login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

async function start() {
  await connectToMongo();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
