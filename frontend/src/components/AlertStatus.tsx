import { DashboardData } from "../types";

interface AlertStatusProps {
  data: DashboardData;
}

export default function AlertStatus({ data }: AlertStatusProps) {
  const currentRate = data.current_rate;
  const sixMonthLow = data.six_month_low;
  const isAtLow = data.is_at_6mo_low || currentRate <= sixMonthLow + 0.01;
  const distanceToLow = currentRate - sixMonthLow;

  const lowProgress = isAtLow
    ? 100
    : Math.max(5, Math.min(100, Math.round((sixMonthLow / currentRate) * 100)));

  return (
    <div
      className="glass-card p-6 animate-slide-up"
      style={{ animationDelay: "550ms" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
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
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Alert Engine Status</h2>
            <p className="text-slate-500 text-xs">Automated Notifications</p>
          </div>
        </div>
        <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
          Hourly Execution Active (Every 60 mins)
        </span>
      </div>

      <div className="space-y-4">
        {/* Distance to 6-Month Low */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400 text-xs">
              Distance to 6-Month Low (₹{sixMonthLow.toFixed(2)})
            </span>
            <span
              className={`text-xs font-mono font-semibold ${
                isAtLow ? "text-danger-400" : "text-brand-400"
              }`}
            >
              {isAtLow
                ? "LOW DETECTED!"
                : `+₹${distanceToLow.toFixed(2)} to 6-Mo Low`}
            </span>
          </div>
          <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isAtLow
                  ? "bg-danger-500 animate-pulse"
                  : "bg-gradient-to-r from-brand-600 to-brand-400"
              }`}
              style={{ width: `${lowProgress}%` }}
            />
          </div>
        </div>

        {/* Notification Channel Status */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="flex items-center gap-2.5 bg-dark-800/50 rounded-lg px-3 py-2.5 border border-dark-600/40">
            <div className="w-7 h-7 rounded-lg bg-brand-500/20 flex items-center justify-center text-sm">
              ✈️
            </div>
            <div>
              <p className="text-white text-xs font-medium">Telegram Bot</p>
              <p className="text-emerald-400 text-xs font-semibold">Active</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-dark-800/50 rounded-lg px-3 py-2.5 border border-dark-600/40">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm">
              🎮
            </div>
            <div>
              <p className="text-white text-xs font-medium">Discord Webhook</p>
              <p className="text-emerald-400 text-xs font-semibold">Active</p>
            </div>
          </div>
        </div>

        {/* Schedule & Notification rules */}
        <div className="text-xs text-slate-500 border-t border-dark-700 pt-3 mt-3 space-y-1">
          <p className="text-slate-300 font-medium">🔔 Notification Engine Rules:</p>
          <p className="pl-3 text-slate-400">• Cron triggers automatically every hour (0 * * * *)</p>
          <p className="pl-3 text-slate-400">• Dispatches hourly USD/INR rate + Llama 3.1 8B AI forecast</p>
          <p className="pl-3 text-slate-400">• Triggers 🚨 NEW 6-MONTH LOW alert header if rate drops to 180-day minimum</p>
        </div>
      </div>
    </div>
  );
}
