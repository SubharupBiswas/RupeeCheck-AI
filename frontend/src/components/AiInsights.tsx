import { DashboardData } from "../types";

interface AiInsightsProps {
  data: DashboardData;
}

export default function AiInsights({ data }: AiInsightsProps) {
  return (
    <div
      className="glass-card p-6 animate-slide-up"
      style={{ animationDelay: "450ms" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">
            AI Market Intelligence
          </h2>
          <p className="text-slate-500 text-xs">
            Powered by Cloudflare Workers AI · Llama 3.1 8B
          </p>
        </div>
        <div className="ml-auto">
          <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full font-medium">
            Free AI Edge
          </span>
        </div>
      </div>

      <div className="space-y-5">
        {/* AI Analysis Text */}
        <div className="bg-dark-800/60 border border-dark-600/60 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-brand-500 rounded-l-xl" />
          <p className="text-slate-300 text-sm leading-relaxed pl-4 italic">
            "{data.ai_analysis}"
          </p>
        </div>

        {/* Prediction details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-dark-800/40 rounded-xl p-4 border border-dark-600/40">
            <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-2">
              Predicted Low
            </p>
            <p className="rate-display text-gold-400 text-2xl font-bold">
              ₹{data.predicted_lowest_rate.toFixed(2)}
            </p>
            <p className="text-slate-400 text-xs mt-1">per 1 USD</p>
          </div>
          <div className="bg-dark-800/40 rounded-xl p-4 border border-dark-600/40">
            <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-2">
              Expected Window
            </p>
            <p className="text-slate-200 text-sm font-medium leading-snug">
              {data.predicted_date}
            </p>
            <p className="text-slate-400 text-xs mt-1">30-day horizon</p>
          </div>
        </div>

        {/* 6-Month Low Alert Indicator */}
        {data.is_at_6mo_low && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <div className="text-emerald-400 text-xl">🎯</div>
            <div>
              <p className="text-emerald-400 text-sm font-semibold">
                6-Month Lowest Rate Level Active!
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                Current rate is at or near the 180-day historical minimum. High-priority alerts dispatched.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
