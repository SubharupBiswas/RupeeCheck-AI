import { useState } from "react";
import StatCard, { StatCardSkeleton } from "./components/StatCard";
import RateChart from "./components/RateChart";
import AiInsights from "./components/AiInsights";
import AlertStatus from "./components/AlertStatus";
import { useDashboard } from "./hooks/useDashboard";

// ── Icon helpers ───────────────────────────────────────────────────────────

function CurrencyIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function TrendDownIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181"
      />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const { data, loading, error, lastUpdated, refresh } = useDashboard();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="bg-radial-glow min-h-screen text-white">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-dark-700/60 sticky top-0 z-50 backdrop-blur-xl bg-dark-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-brand-500/30">
              ₹
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">
                USD/INR Monitor
              </h1>
              <p className="text-slate-500 text-xs">Powered by Cloudflare Workers AI</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live indicator */}
            {data && !loading && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                <span className="live-dot">Live</span>
                {lastUpdated && (
                  <span className="text-slate-600">
                    Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}

            {/* Refresh button */}
            <button
              id="refresh-btn"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white border border-dark-600 hover:border-brand-500/40 rounded-lg px-3 py-1.5 transition-all duration-200 hover:bg-brand-500/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshIcon spinning={refreshing} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 bg-danger-500/10 border border-danger-500/30 text-danger-400 rounded-xl px-4 py-3 text-sm animate-fade-in">
            <span className="text-base">⚠️</span>
            <span>
              <strong>API Error:</strong> {error}. Make sure the Worker is running and CORS is
              enabled.
            </span>
          </div>
        )}

        {/* ── Stat Cards ──────────────────────────────────────────────── */}
        <section aria-label="Key Metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <>
              <StatCardSkeleton animationDelay="0ms" />
              <StatCardSkeleton animationDelay="100ms" />
              <StatCardSkeleton animationDelay="200ms" />
            </>
          ) : data ? (
            <>
              <StatCard
                id="current-rate-card"
                title="Current Rate"
                value={`₹${data.current_rate.toFixed(2)}`}
                subtitle={`1 USD as of ${data.current_date}`}
                icon={<CurrencyIcon />}
                isHighlight={data.is_at_6mo_low}
                badge={data.is_at_6mo_low ? "6-Month Low 🎯" : undefined}
                trend={data.current_rate <= data.six_month_low + 1 ? "down" : "neutral"}
                animationDelay="0ms"
              />
              <StatCard
                id="six-month-low-card"
                title="6-Month Historical Low"
                value={`₹${data.six_month_low.toFixed(2)}`}
                subtitle="Lowest rate in the past 180 days"
                icon={<TrendDownIcon />}
                trend="down"
                animationDelay="100ms"
              />
              <StatCard
                id="ai-prediction-card"
                title="AI Predicted Low"
                value={`₹${data.predicted_lowest_rate.toFixed(2)}`}
                subtitle={`Expected: ${data.predicted_date}`}
                icon={<BrainIcon />}
                trend="down"
                animationDelay="200ms"
              />
            </>
          ) : null}
        </section>

        {/* ── Chart ───────────────────────────────────────────────────── */}
        {data && <RateChart data={data} />}
        {loading && (
          <div className="glass-card p-6">
            <div className="skeleton h-6 w-48 rounded mb-6" />
            <div className="skeleton h-72 md:h-96 w-full rounded-lg" />
          </div>
        )}

        {/* ── Bottom Grid: AI Insights + Alert Status ──────────────────── */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AiInsights data={data} />
            <AlertStatus data={data} />
          </div>
        )}
        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-6 space-y-3">
              <div className="skeleton h-6 w-44 rounded" />
              <div className="skeleton h-24 w-full rounded-xl" />
              <div className="skeleton h-16 w-full rounded-xl" />
            </div>
            <div className="glass-card p-6 space-y-3">
              <div className="skeleton h-6 w-44 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-4 w-full rounded" />
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="text-center text-slate-700 text-xs pb-6 space-y-1">
          <p>
            🔥 100% free · Cloudflare Workers + D1 + Workers AI · Data by{" "}
            <a
              href="https://api.frankfurter.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-brand-400 transition-colors"
            >
              Frankfurter API
            </a>
          </p>
          <p>Hourly Cron (0 * * * *) · Notifications via Telegram & Discord</p>
        </footer>
      </main>
    </div>
  );
}
