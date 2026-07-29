# USD/INR Exchange Rate Monitor — Build Walkthrough

## Dashboard Preview

![USD/INR Monitor Dashboard](/Users/subharup/.gemini/antigravity-ide/brain/cc72e10c-8030-4de1-b423-a5b649145926/dashboard_preview_1785340304904.png)

---

## What Was Built

A complete, production-ready, 100% free Cloudflare serverless application with every feature requested.

### File Index

| File | Description |
|---|---|
| [schema.sql](file:///Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor/schema.sql) | D1 schema: `exchange_rates` + `alert_log` tables |
| [wrangler.json](file:///Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor/wrangler.json) | D1 binding, Workers AI binding, cron `0 4 * * *` |
| [src/worker.ts](file:///Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor/src/worker.ts) | Main Worker: cron, AI, D1, alerts, API |
| [frontend/src/App.tsx](file:///Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor/frontend/src/App.tsx) | Root React component with full layout |
| [frontend/src/components/StatCard.tsx](file:///Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor/frontend/src/components/StatCard.tsx) | Glassmorphism stat card with glow state |
| [frontend/src/components/RateChart.tsx](file:///Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor/frontend/src/components/RateChart.tsx) | Chart.js line chart (history + AI forecast) |
| [frontend/src/components/AiInsights.tsx](file:///Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor/frontend/src/components/AiInsights.tsx) | AI analysis panel with prediction grid |
| [frontend/src/components/AlertStatus.tsx](file:///Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor/frontend/src/components/AlertStatus.tsx) | Alert engine status with progress bars |
| [frontend/src/hooks/useDashboard.ts](file:///Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor/frontend/src/hooks/useDashboard.ts) | Data-fetching hook with 5-min auto-refresh |
| [README.md](file:///Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor/README.md) | Full deployment guide |

---

## Deployment Commands (Copy-Paste Ready)

### Step 1 — One-time setup

```bash
cd /Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor

# Create D1 database (copy the database_id from output!)
npx wrangler d1 create usdinr-db

# ⚠️  Paste the database_id into wrangler.json before continuing
```

### Step 2 — Apply schema

```bash
# Production D1:
npx wrangler d1 execute usdinr-db --file=./schema.sql

# Local testing D1:
npx wrangler d1 execute usdinr-db --local --file=./schema.sql
```

### Step 3 — Add secrets

```bash
npx wrangler secret put TELEGRAM_TOKEN       # From @BotFather
npx wrangler secret put TELEGRAM_CHAT_ID     # Your chat/group ID
npx wrangler secret put DISCORD_WEBHOOK      # Discord webhook URL
```

### Step 4 — Local dev

```bash
# Terminal 1
npx wrangler dev

# Terminal 2 — seed data by triggering cron manually
curl -X POST http://localhost:8787/__trigger_cron

# Check API
curl http://localhost:8787/api/dashboard | jq .

# Frontend
cd frontend && npm run dev   # → http://localhost:5173
```

### Step 5 — Deploy

```bash
# Worker
npx wrangler deploy

# Frontend
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=usdinr-monitor
```

---

## Architecture Decisions

### Why `__trigger_cron` endpoint?
Wrangler doesn't auto-fire crons locally without `--test-scheduled`. The POST endpoint lets you seed D1 data immediately during development.

### AI Model Choice
`@cf/meta/llama-3.1-8b-instruct` was chosen for its:
- Speed on Workers AI edge (~1-2s)
- JSON instruction-following ability
- Free tier availability

To switch to DeepSeek R1, change one line in [worker.ts](file:///Users/subharup/.gemini/antigravity-ide/scratch/usdinr-monitor/src/worker.ts#L211):
```ts
"@cf/deepseek-ai/deepseek-r1-distill-qwen-32b"
```

### Forecast Curve
The frontend uses a smooth bezier curve interpolating from current rate → AI predicted low → slight recovery. This visual dampening prevents the chart from looking like a straight diagonal line.

### D1 Batch Inserts
Historical rates are inserted in chunks of 50 using `D1Database.batch()` to stay within D1's per-request limits.

---

## Alert Conditions

| Condition | Channels |
|---|---|
| Current rate ≤ 6-month historical low | Telegram + Discord |
| AI-predicted low ≤ ₹85 (configurable) | Telegram + Discord |

Both conditions evaluated once per day at cron execution.

---

## Total Cost: $0/month ✅

Cloudflare free tier fully covers this workload.
