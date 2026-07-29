/**
 * USD/INR Exchange Rate Monitor — Cloudflare Worker
 *
 * Features:
 *  - Real-time USD/INR spot rates via Open Exchange Rates API (https://open.er-api.com/v6/latest/USD)
 *  - Hourly Cron Trigger (0 * * * *): fetch rates, run Workers AI forecast, store in D1, dispatch Telegram & Discord notifications
 *  - GET /api/dashboard  → Real-time 24/7 payload for React frontend (auto-seeds if database is empty)
 *  - GET /health         → health-check ping
 *  - POST /__trigger_cron → manual trigger for testing
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface Env {
  DB: D1Database;
  AI: Ai;
  TELEGRAM_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DISCORD_WEBHOOK?: string;
}

interface RateRow {
  id: number;
  date: string;
  rate: number;
  is_6mo_low: number;
  predicted_lowest_rate: number | null;
  predicted_date: string | null;
  ai_analysis: string | null;
  created_at: string;
}

interface FrankfurterResponse {
  amount: number;
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, { INR: number }>;
}

interface OpenErApiResponse {
  result: string;
  time_last_update_utc?: string;
  time_last_update_unix?: number;
  rates?: Record<string, number>;
}

interface AiForecast {
  predicted_lowest_rate: number;
  predicted_date_range: string;
  rationale: string;
}

interface DashboardPayload {
  current_rate: number;
  current_date: string;
  last_updated_timestamp: string;
  six_month_low: number;
  is_at_6mo_low: boolean;
  predicted_lowest_rate: number;
  predicted_date: string;
  ai_analysis: string;
  history: Array<{ date: string; rate: number }>;
  forecast: Array<{ date: string; rate: number }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FRANKFURTER_BASE = "https://api.frankfurter.app";
const OPEN_ER_API = "https://open.er-api.com/v6/latest/USD";
const TELEGRAM_API = "https://api.telegram.org";
const HISTORY_DAYS = 180;
const MA_DAYS = 30;
const FORECAST_DAYS = 30;

// ─── Main Worker Export ───────────────────────────────────────────────────────

export default {
  // ── HTTP Handler ──────────────────────────────────────────────────────────
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (url.pathname === "/api/dashboard") {
      try {
        const payload = await buildDashboardPayload(env);
        return new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err) {
        console.error("Dashboard error:", err);
        return new Response(JSON.stringify({ error: "Failed to build dashboard payload" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Manual cron trigger for local testing
    if (url.pathname === "/__trigger_cron" && request.method === "POST") {
      await runHourlyCron(env);
      return new Response(JSON.stringify({ ok: true, message: "Hourly cron executed successfully" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },

  // ── Scheduled Handler (Cron 0 * * * *) ───────────────────────────────────
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runHourlyCron(env));
  },
} satisfies ExportedHandler<Env>;

// ─── Core Cron Logic ─────────────────────────────────────────────────────────

async function runHourlyCron(env: Env): Promise<void> {
  console.log("[Cron] Starting hourly USD/INR update and forecast execution…");

  // 1. Fetch historical rates (last 180 days)
  const historicalRates = await fetchHistoricalRates(HISTORY_DAYS);
  if (!historicalRates || historicalRates.length === 0) {
    console.error("[Cron] Failed to fetch historical rates from Frankfurter API");
    return;
  }

  // Also fetch live spot rate if available
  const liveSpot = await fetchLiveSpotRate();
  const today = historicalRates[historicalRates.length - 1];
  const activeSpotRate = liveSpot.rate > 0 ? liveSpot.rate : today.rate;

  const sixMonthLow = Math.min(...historicalRates.map((r) => r.rate));
  const isAtLow = activeSpotRate <= sixMonthLow + 0.01;

  // 2. Compute key metrics
  const recentRates = historicalRates.slice(-MA_DAYS).map((r) => r.rate);
  const movingAverage = recentRates.reduce((a, b) => a + b, 0) / recentRates.length;
  const velocity = computeVelocity(historicalRates);
  const volatility = computeVolatility(recentRates);

  // 3. Workers AI Forecast & Fallback Pipeline
  let forecast: AiForecast;
  try {
    forecast = await runAiForecast(env.AI, historicalRates, movingAverage, velocity, volatility);
    console.log("[Cron] Workers AI forecast successfully generated.");
  } catch (err) {
    console.warn("[Cron] Workers AI call unavailable or failed. Generating rolling average fallback:", err);
    forecast = generateFallbackForecast(historicalRates, activeSpotRate);
  }

  // 4. Upsert snapshot into D1
  await env.DB.prepare(
    `INSERT INTO exchange_rates
       (date, rate, is_6mo_low, predicted_lowest_rate, predicted_date, ai_analysis)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       rate = excluded.rate,
       is_6mo_low = excluded.is_6mo_low,
       predicted_lowest_rate = excluded.predicted_lowest_rate,
       predicted_date = excluded.predicted_date,
       ai_analysis = excluded.ai_analysis`
  )
    .bind(
      today.date,
      activeSpotRate,
      isAtLow ? 1 : 0,
      forecast.predicted_lowest_rate,
      forecast.predicted_date_range,
      forecast.rationale
    )
    .run();

  // Bulk upsert older historical records
  const insertChunks = chunkArray(historicalRates.slice(0, -1), 50);
  for (const chunk of insertChunks) {
    const stmts = chunk.map((r) =>
      env.DB.prepare(
        `INSERT INTO exchange_rates (date, rate, is_6mo_low)
         VALUES (?, ?, 0)
         ON CONFLICT(date) DO NOTHING`
      ).bind(r.date, r.rate)
    );
    await env.DB.batch(stmts);
  }

  console.log(`[Cron] Stored ${historicalRates.length} rates in D1. Spot Rate: ₹${activeSpotRate}/USD`);

  // 5. Hourly Summary Notification (Telegram & Discord)
  const header = isAtLow
    ? "🚨 NEW 6-MONTH LOWEST USD/INR RATE DETECTED! 🚨"
    : "📊 Hourly USD/INR Market Summary & AI Forecast";

  const formattedMessage = buildHourlyMessage(
    header,
    activeSpotRate,
    sixMonthLow,
    forecast.predicted_lowest_rate,
    forecast.predicted_date_range,
    forecast.rationale
  );

  const telegramToken = env.TELEGRAM_TOKEN || "";
  const telegramChatId = env.TELEGRAM_CHAT_ID || "";
  const discordWebhook = env.DISCORD_WEBHOOK || "";

  const [telegramRes, discordRes] = await Promise.allSettled([
    sendTelegramAlert(telegramToken, telegramChatId, formattedMessage),
    sendDiscordAlert(discordWebhook, header, activeSpotRate, sixMonthLow, forecast),
  ]);

  const telegramSuccess = telegramRes.status === "fulfilled" && telegramRes.value;
  const discordSuccess = discordRes.status === "fulfilled" && discordRes.value;

  // Log notifications to D1 alert_log
  const logStmts = [
    env.DB.prepare(
      `INSERT INTO alert_log (channel, message, status) VALUES (?, ?, ?)`
    ).bind("telegram", formattedMessage, telegramSuccess ? "success" : "failed"),
    env.DB.prepare(
      `INSERT INTO alert_log (channel, message, status) VALUES (?, ?, ?)`
    ).bind("discord", formattedMessage, discordSuccess ? "success" : "failed"),
  ];
  await env.DB.batch(logStmts);

  console.log("[Cron] Hourly update & notification sequence complete.");
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function fetchLiveSpotRate(): Promise<{ rate: number; timestamp: string }> {
  try {
    const res = await fetch(OPEN_ER_API, {
      headers: { "User-Agent": "usdinr-monitor/1.0" },
    });
    if (res.ok) {
      const data: OpenErApiResponse = await res.json();
      if (data.rates && typeof data.rates.INR === "number") {
        return {
          rate: parseFloat(data.rates.INR.toFixed(2)),
          timestamp: data.time_last_update_utc || new Date().toUTCString(),
        };
      }
    }
  } catch (err) {
    console.warn("[Spot API] Failed to fetch instant rate from open.er-api.com:", err);
  }
  return { rate: 0, timestamp: new Date().toUTCString() };
}

async function fetchHistoricalRates(
  days: number
): Promise<Array<{ date: string; rate: number }>> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const start = formatDate(startDate);
  const end = formatDate(endDate);

  const url = `${FRANKFURTER_BASE}/${start}..${end}?from=USD&to=INR`;
  const response = await fetch(url, {
    headers: { "User-Agent": "usdinr-monitor/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Frankfurter API error: ${response.status} ${response.statusText}`);
  }

  const data: FrankfurterResponse = await response.json();

  return Object.entries(data.rates)
    .map(([date, values]) => ({ date, rate: values.INR }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Analytics & Fallback Engine ──────────────────────────────────────────────

function computeVelocity(rates: Array<{ date: string; rate: number }>): number {
  if (rates.length < 8) return 0;
  const last7 = rates.slice(-7);
  const first = last7[0].rate;
  const last = last7[last7.length - 1].rate;
  return parseFloat(((last - first) / 7).toFixed(4));
}

function computeVolatility(rates: number[]): number {
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
  return parseFloat(Math.sqrt(variance).toFixed(4));
}

function generateFallbackForecast(
  history: Array<{ date: string; rate: number }>,
  currentRate: number
): AiForecast {
  const recent30 = history.slice(-30).map((r) => r.rate);
  const ma30 = recent30.length > 0
    ? recent30.reduce((a, b) => a + b, 0) / recent30.length
    : currentRate;
  const min30 = recent30.length > 0 ? Math.min(...recent30) : currentRate;
  const velocity = computeVelocity(history);

  const predicted_lowest_rate = parseFloat((Math.min(min30, currentRate) - Math.abs(velocity * 5) - 0.15).toFixed(2));

  const d1 = new Date();
  d1.setDate(d1.getDate() + 7);
  const d2 = new Date();
  d2.setDate(d2.getDate() + 15);
  const predicted_date_range = `${formatDate(d1)} to ${formatDate(d2)}`;

  const trendDesc = velocity <= 0
    ? "demonstrating steady strength against the USD"
    : "showing mild consolidation pressure";

  const rationale = `The USD/INR pair is currently ${trendDesc} with a 30-day moving average of ₹${ma30.toFixed(2)}. Technical momentum analysis indicates a potential localized rate low near ₹${predicted_lowest_rate.toFixed(2)} over the next 2-3 weeks.`;

  return {
    predicted_lowest_rate,
    predicted_date_range,
    rationale,
  };
}

// ─── Workers AI Forecast ──────────────────────────────────────────────────────

async function runAiForecast(
  ai: Ai,
  rates: Array<{ date: string; rate: number }>,
  movingAverage: number,
  velocity: number,
  volatility: number
): Promise<AiForecast> {
  const last30 = rates.slice(-30);
  const ratesSummary = last30
    .map((r) => `${r.date}: ${r.rate.toFixed(2)}`)
    .join("\n");

  const sixMonthLow = Math.min(...rates.map((r) => r.rate));
  const sixMonthHigh = Math.max(...rates.map((r) => r.rate));
  const currentRate = rates[rates.length - 1].rate;

  const prompt = `You are a financial analyst specializing in foreign exchange markets. Analyze the USD/INR exchange rate data below and provide a short-term forecast.

## Current Market Data
- Current USD/INR Rate: ${currentRate.toFixed(2)}
- 30-Day Moving Average: ${movingAverage.toFixed(2)}
- 7-Day Price Velocity: ${velocity > 0 ? "+" : ""}${velocity} INR/day (${velocity > 0 ? "USD strengthening" : "USD weakening"})
- 30-Day Volatility (Std Dev): ${volatility}
- 6-Month Low: ${sixMonthLow.toFixed(2)}
- 6-Month High: ${sixMonthHigh.toFixed(2)}

## Last 30 Days Price Action (USD/INR)
${ratesSummary}

## Instructions
Based on this price action, momentum, and volatility, provide your forecast as a JSON object ONLY (no explanation outside JSON):

{
  "predicted_lowest_rate": <number: the estimated lowest USD/INR rate in the next 30 days, e.g. 83.50>,
  "predicted_date_range": "<string: estimated date range, e.g. '2026-08-10 to 2026-08-17'>",
  "rationale": "<string: exactly 2 sentences explaining the market trend and your reasoning>"
}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiResponse = await (ai as any).run("@cf/meta/llama-3.1-8b-instruct", {
    prompt,
    max_tokens: 350,
    temperature: 0.3,
  });

  let text = "";
  if (typeof aiResponse === "object" && aiResponse !== null) {
    const r = aiResponse as Record<string, unknown>;
    if (typeof r["response"] === "string") {
      text = r["response"];
    } else if (typeof r["result"] === "string") {
      text = r["result"];
    }
  }

  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`AI response did not contain valid JSON. Raw: ${text.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const predictedLow = parseFloat(parsed.predicted_lowest_rate ?? parsed.predicted_low);
  const predictedDate = parsed.predicted_date_range ?? parsed.predicted_date ?? parsed.date_range;
  const rationale = parsed.rationale ?? parsed.ai_analysis ?? parsed.analysis;

  if (isNaN(predictedLow) || !predictedDate || !rationale) {
    throw new Error("AI JSON missing required fields");
  }

  return {
    predicted_lowest_rate: parseFloat(predictedLow.toFixed(2)),
    predicted_date_range: String(predictedDate),
    rationale: String(rationale),
  };
}

// ─── Dashboard API (24/7 Live Real-Time Payload) ──────────────────────────────

async function buildDashboardPayload(env: Env): Promise<DashboardPayload> {
  // 1. Fetch live instant spot rate
  const liveSpot = await fetchLiveSpotRate();

  // 2. Fetch stored history from D1
  let historyRows = await env.DB.prepare(
    `SELECT date, rate FROM exchange_rates
     ORDER BY date DESC LIMIT 90`
  ).all<{ date: string; rate: number }>();

  let history = (historyRows.results ?? []).reverse();

  // Auto-seed if database is empty
  if (history.length === 0) {
    console.log("[Dashboard] Database is empty. Auto-triggering seed cron process...");
    try {
      await runHourlyCron(env);
      historyRows = await env.DB.prepare(
        `SELECT date, rate FROM exchange_rates
         ORDER BY date DESC LIMIT 90`
      ).all<{ date: string; rate: number }>();
      history = (historyRows.results ?? []).reverse();
    } catch (err) {
      console.error("[Dashboard] Auto-seed cron failed:", err);
    }
  }

  // Fallback history if database still empty
  if (history.length === 0) {
    const liveRates = await fetchHistoricalRates(7);
    const today = liveRates[liveRates.length - 1];
    const spotRate = liveSpot.rate > 0 ? liveSpot.rate : today.rate;
    const fallback = generateFallbackForecast(liveRates, spotRate);
    return {
      current_rate: spotRate,
      current_date: today.date,
      last_updated_timestamp: liveSpot.timestamp,
      six_month_low: spotRate,
      is_at_6mo_low: false,
      predicted_lowest_rate: fallback.predicted_lowest_rate,
      predicted_date: fallback.predicted_date_range,
      ai_analysis: fallback.rationale,
      history: liveRates,
      forecast: buildLinearForecast(spotRate, 0, FORECAST_DAYS, fallback.predicted_lowest_rate),
    };
  }

  // Latest stored row for forecast metadata
  const latestRow = await env.DB.prepare(
    `SELECT * FROM exchange_rates ORDER BY date DESC LIMIT 1`
  ).first<RateRow>();

  // 6-month historical low calculation
  const sixMonthLowRow = await env.DB.prepare(
    `SELECT MIN(rate) as min_rate FROM exchange_rates
     WHERE date >= date('now', '-180 days')`
  ).first<{ min_rate: number }>();

  const sixMonthLow = sixMonthLowRow?.min_rate ?? history[0].rate;
  const currentRate = liveSpot.rate > 0 ? liveSpot.rate : (latestRow?.rate ?? history[history.length - 1].rate);
  const isAtLow = currentRate <= sixMonthLow + 0.01;

  let predictedLowest = latestRow?.predicted_lowest_rate ?? null;
  let predictedDate = latestRow?.predicted_date ?? null;
  let aiAnalysis = latestRow?.ai_analysis ?? null;

  if (predictedLowest === null || predictedDate === null || aiAnalysis === null) {
    const fallback = generateFallbackForecast(history, currentRate);
    predictedLowest = predictedLowest ?? fallback.predicted_lowest_rate;
    predictedDate = predictedDate ?? fallback.predicted_date_range;
    aiAnalysis = aiAnalysis ?? fallback.rationale;
  }

  const velocity = computeVelocity(history);
  const forecast = buildLinearForecast(
    currentRate,
    velocity,
    FORECAST_DAYS,
    predictedLowest
  );

  return {
    current_rate: currentRate,
    current_date: latestRow?.date ?? history[history.length - 1].date,
    last_updated_timestamp: liveSpot.timestamp,
    six_month_low: parseFloat(sixMonthLow.toFixed(2)),
    is_at_6mo_low: isAtLow,
    predicted_lowest_rate: predictedLowest,
    predicted_date: predictedDate,
    ai_analysis: aiAnalysis,
    history,
    forecast,
  };
}

function buildLinearForecast(
  startRate: number,
  velocity: number,
  days: number,
  targetLow?: number
): Array<{ date: string; rate: number }> {
  const result: Array<{ date: string; rate: number }> = [];
  const today = new Date();

  const dampedVelocity = velocity * 0.7;
  const midPoint = Math.floor(days / 2);

  for (let i = 1; i <= days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);

    let rate: number;
    if (targetLow !== undefined) {
      if (i <= midPoint) {
        rate = startRate + (targetLow - startRate) * (i / midPoint);
      } else {
        const recovery = (startRate - targetLow) * 0.3;
        rate = targetLow + recovery * ((i - midPoint) / midPoint);
      }
    } else {
      rate = startRate + dampedVelocity * i;
    }

    result.push({
      date: formatDate(d),
      rate: parseFloat(rate.toFixed(2)),
    });
  }

  return result;
}

// ─── Notification Helpers ────────────────────────────────────────────────────

function buildHourlyMessage(
  header: string,
  currentRate: number,
  sixMonthLow: number,
  predictedLowestRate: number,
  predictedDateRange: string,
  aiRationale: string
): string {
  return [
    header,
    "",
    `💵 Spot Rate (1 USD): ₹${currentRate.toFixed(2)}`,
    `📉 6-Month Historical Low: ₹${sixMonthLow.toFixed(2)}`,
    `🔮 AI Predicted Low: ₹${predictedLowestRate.toFixed(2)} (Target: ${predictedDateRange})`,
    "",
    `💡 1-Hour Market Summary: ${aiRationale}`,
  ].join("\n");
}

async function sendTelegramAlert(
  token: string,
  chatId: string,
  message: string
): Promise<boolean> {
  if (!token || !chatId) {
    console.warn("[Telegram] Token or Chat ID not provided — skipping dispatch");
    return false;
  }

  try {
    const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Telegram] Dispatch failed (${res.status}): ${body}`);
      return false;
    }
    console.log("[Telegram] Dispatch successful");
    return true;
  } catch (err) {
    console.error("[Telegram] Network exception during dispatch:", err);
    return false;
  }
}

async function sendDiscordAlert(
  webhookUrl: string,
  header: string,
  currentRate: number,
  sixMonthLow: number,
  forecast: AiForecast
): Promise<boolean> {
  if (!webhookUrl) {
    console.warn("[Discord] Webhook URL not provided — skipping dispatch");
    return false;
  }

  try {
    const embed = {
      title: header,
      color: currentRate <= sixMonthLow + 0.01 ? 0x00ff88 : 0x0ea5e9,
      fields: [
        { name: "💵 Spot Rate (1 USD)", value: `₹${currentRate.toFixed(2)}`, inline: true },
        { name: "📉 6-Month Historical Low", value: `₹${sixMonthLow.toFixed(2)}`, inline: true },
        { name: "🔮 AI Predicted Low", value: `₹${forecast.predicted_lowest_rate.toFixed(2)}`, inline: true },
        { name: "📅 Expected Target Range", value: forecast.predicted_date_range, inline: false },
        { name: "💡 1-Hour Market Summary", value: forecast.rationale, inline: false },
      ],
      footer: { text: "RupeeCheck-AI Live Spot Monitor • " + new Date().toUTCString() },
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Discord] Dispatch failed (${res.status}): ${body}`);
      return false;
    }
    console.log("[Discord] Dispatch successful");
    return true;
  } catch (err) {
    console.error("[Discord] Network exception during dispatch:", err);
    return false;
  }
}

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
