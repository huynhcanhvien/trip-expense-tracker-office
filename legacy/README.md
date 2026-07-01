# 🌸 Petal — Trip Bill Splitter

A cute, pastel-pink bill splitter for trips. Create a trip, invite your friends,
add expenses by typing them or **snapping a photo of a receipt** (auto-read with
AI), and Petal works out the total and exactly **who owes whom**.

## Features

- 💗 **Real accounts** — sign up / log in, trips sync across devices
- 🧳 **Trips** with cute emojis & per-trip currency
- 👯 **Invite by email** — registered friends join instantly; others auto-join when they sign up
- 🧾 **Add expenses** by text, or 📷 **scan a receipt** to auto-fill amount/merchant/category
- ⚖️ **Split equally** or ✍️ **custom amounts** per person
- 🪄 **Settle up** — minimal "A pays B" suggestions, computed automatically

## Tech

- **Backend:** Node + Express, SQLite (`better-sqlite3`), JWT auth
- **Frontend:** React + Vite
- **OCR:** Claude vision API (optional)

## Getting started

```bash
# 1. Install everything (root, server, client)
npm install
npm run install:all

# 2. Configure the server
cp server/.env.example server/.env
#    edit server/.env — set JWT_SECRET, and ANTHROPIC_API_KEY if you want receipt scanning

# 3. Run both server + client
npm run dev
```

Then open **http://localhost:5173**. The API runs on port 4000 (proxied by Vite).

### Receipt scanning (optional)

Set `ANTHROPIC_API_KEY` in `server/.env` to enable AI receipt reading. Without a
key, you can still attach receipt photos — you just type the amount yourself.

## Data

Everything is stored locally in `server/data/app.db` (SQLite). Uploaded receipt
images live in `server/uploads/`. Both are git-ignored.
