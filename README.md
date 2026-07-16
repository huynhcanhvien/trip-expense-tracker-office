# Trip Expense Tracker

Split trip bills fairly. Create a trip, add people, log expenses (split evenly or
by custom amounts), and see the **net balance per person** — who owes and who's
owed. No accounts: a trip is shared by link, and anyone with the link can view
and add expenses. Receipts can be scanned from a photo with a local vision model.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **libSQL / Turso** for storage (with a local-file fallback for offline dev)
- **Ollama + `qwen2.5vl:3b`** for on-device receipt OCR (no external API)
- **sharp** for image normalization
- **Vitest** (unit) + **Playwright** (e2e)

---

## Prerequisites

- **Node.js 20+** (developed on 24)
- **Ollama** — only needed for the "Scan receipt" feature ([ollama.com](https://ollama.com))
- A **Turso** database is optional — without one, the app uses a local SQLite file (`local.db`)

---

## Quick start (local development)

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.local.example .env.local
#    The defaults work offline — no editing required for a first run.

# 3. Set up the database schema
npm run migrate
#    With TURSO_DATABASE_URL unset, this creates/updates the local file `local.db`.

# 4. (Optional) Start the receipt scanner backend
brew install ollama         # or see ollama.com for other platforms
ollama serve                # leave running in another terminal
ollama pull qwen2.5vl:3b    # ~3.2 GB, one-time download

# 5. Run the dev server
npm run dev
```

Open **http://localhost:3000**. Create a trip, add yourself, and start logging
expenses. (Skip step 4 if you don't need photo scanning — everything else works
without it.)

---

## Environment variables

Copy `.env.local.example` → `.env.local` (gitignored). All values are optional
for local dev.

| Variable | Default | Purpose |
|---|---|---|
| `TURSO_DATABASE_URL` | _(empty)_ | Turso/libSQL URL. Empty → local file `local.db`. |
| `TURSO_AUTH_TOKEN` | _(empty)_ | Turso auth token (only with a remote URL). |
| `APP_URL` | `http://localhost:3000` | Base URL used to build shareable trip links. |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server for receipt OCR. |
| `OCR_MODEL` | `qwen2.5vl:3b` | Vision model used to read receipts. |
| `STORAGE_ADAPTER` | `local` | Receipt photo storage. Only `local` is implemented today (see [Deployment](#deployment)). |

---

## Receipt scanning (OCR)

The "Scan receipt" flow sends the uploaded photo to a **local vision model**
(`qwen2.5vl:3b`) via Ollama, which returns the amount, merchant, and date in one
shot — images never leave the machine, and there's no API key or per-call cost.

- Requires `ollama serve` running with the model pulled (see step 4 above).
- If Ollama is unreachable or the model is missing, the API returns a clear error
  and the upload is discarded — the rest of the app is unaffected.

**Model comparison harness.** [`scripts/ocr-compare/`](scripts/ocr-compare/)
benchmarks Gemini, Ollama VLMs, and PaddleOCR on the same image — see its
[README](scripts/ocr-compare/README.md) to evaluate alternatives.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) on :3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run migrate` | Apply `src/db/schema.sql` to the database |
| `npm run lint` | ESLint |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run e2e` | Run Playwright end-to-end tests |

---

## Production build (single host)

```bash
npm run build
npm run start   # serves on :3000 (set PORT to change)
```

Before running in production, set in the environment:

- `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` — a real database (don't ship the
  local file), and run `npm run migrate` against it once.
- `APP_URL` — your public URL, so shareable trip links are correct.
- `OLLAMA_URL` — pointing at a reachable Ollama instance if you want OCR.

---

## Deployment

This is a standard full-stack Next.js app — **UI, API routes, and server actions
deploy as one unit.** There is no separate frontend/backend to deploy.

**Two things to know before you publish:**

1. **Receipt photos currently persist to the local filesystem** (`public/uploads/`).
   That works on a single long-lived host with a persistent disk, but **not** on
   serverless or multi-instance setups. For those, implement an object-storage
   adapter (an `r2`/`s3` branch is stubbed in [`src/lib/storage.ts`](src/lib/storage.ts)).
2. **OCR needs Ollama reachable at `OLLAMA_URL`.** The model wants real compute
   (a GPU host is ideal); it cannot run inside a serverless function. Point
   `OLLAMA_URL` at a dedicated instance, or swap the OCR provider for a hosted
   vision API (see the comparison harness).

### Recommended shape (AWS)

- **App** → containerize with Next.js `output: "standalone"` and run on **AWS
  App Runner** or **ECS/Fargate** (needs a Node runtime for `sharp` + `fs`).
- **Database** → **Turso** (managed; already supported) — no AWS DB required.
- **Receipt storage** → **S3** (implement the storage adapter first).
- **OCR** → run **Ollama on a GPU instance** (e.g. EC2 `g5`), or switch to a
  hosted vision model (Amazon Bedrock / Gemini) to avoid managing a GPU.

### Simplest path (any container host)

If you don't need horizontal scaling, a single container/VM with a mounted
volume for `public/uploads` + Ollama running alongside works out of the box —
just set the env vars above and run `npm run build && npm run start`.

> Next.js also deploys to **Vercel** with one click, but note the two caveats
> above: filesystem uploads and a self-hosted Ollama don't fit Vercel's
> serverless model — you'd need S3-backed storage and a hosted OCR provider first.
