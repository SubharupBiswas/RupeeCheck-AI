import React from "react";

interface StatCardProps {
  id?: string;
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  isHighlight?: boolean;
  badge?: string;
  trend?: "up" | "down" | "neutral";
  animationDelay?: string;
}

export default function StatCard({
  id,
  title,
  value,
  subtitle,
  icon,
  isHighlight = false,
  badge,
  trend,
  animationDelay = "0ms",
}: StatCardProps) {
  return (
    <div
      id={id}
      className={`glass-card p-6 flex flex-col gap-3 relative overflow-hidden transition-all duration-300 hover:scale-[1.02] animate-slide-up ${
        isHighlight ? "card-glow-green" : ""
      }`}
      style={{ animationDelay }}
    >
      {/* Background glow orb */}
      <div
        className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-20 ${
          isHighlight
            ? "bg-success-500"
            : trend === "down"
            ? "bg-brand-500"
            : "bg-gold-500"
        }`}
      />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-lg ${
              isHighlight
                ? "bg-success-500/20 text-success-400"
                : trend === "down"
                ? "bg-brand-500/20 text-brand-400"
                : "bg-gold-500/20 text-gold-400"
            }`}
          >
            {icon}
          </div>
          <span className="text-slate-400 text-sm font-medium">{title}</span>
        </div>
        {badge && <span className="badge-low">{badge}</span>}
      </div>

      {/* Value */}
      <div className="relative z-10">
        <div
          className={`rate-display text-3xl font-bold tracking-tight ${
            isHighlight
              ? "text-success-400"
              : trend === "down"
              ? "text-brand-400"
              : "text-gold-400"
          }`}
        >
          {value}
        </div>
        {subtitle && (
          <p className="text-slate-500 text-xs mt-1.5">{subtitle}</p>
        )}
      </div>

      {/* Trend arrow */}
      {trend && trend !== "neutral" && (
        <div
          className={`absolute bottom-4 right-4 opacity-10 text-5xl font-black ${
            trend === "down" ? "text-success-400 rotate-45" : "text-danger-400 -rotate-45"
          }`}
        >
          {trend === "down" ? "↓" : "↑"}
        </div>
      )}
    </div>
  );
}

// Skeleton placeholder
export function StatCardSkeleton({ animationDelay = "0ms" }: { animationDelay?: string }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-3" style={{ animationDelay }}>
      <div className="flex items-center gap-2.5">
        <div className="skeleton w-9 h-9 rounded-lg" />
        <div className="skeleton h-4 w-32 rounded" />
      </div>
      <div className="skeleton h-9 w-44 rounded" />
      <div className="skeleton h-3 w-24 rounded" />
    </div>
  );
}
