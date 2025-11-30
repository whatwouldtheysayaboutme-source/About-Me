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
  try
