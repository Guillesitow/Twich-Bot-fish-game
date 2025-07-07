const Database = require('better-sqlite3');
const db = new Database('economia.db');

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    coins INTEGER DEFAULT 0
  )
`).run();

module.exports = db;
db.prepare(`
  CREATE TABLE IF NOT EXISTS cooldowns (
    username TEXT PRIMARY KEY,
    lastFish INTEGER
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS fishers (
    username TEXT PRIMARY KEY,
    points INTEGER DEFAULT 0
  )
`).run();


