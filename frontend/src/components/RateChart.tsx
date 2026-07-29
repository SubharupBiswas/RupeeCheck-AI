import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { DashboardData } from "../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface RateChartProps {
  data: DashboardData;
}

export default function RateChart({ data }: RateChartProps) {
  const historyLabels = data.history.map((h) => h.date);
  const historyValues = data.history.map((h) => h.rate);

  const forecastLabels = data.forecast.map((f) => f.date);
  const forecastValues = data.forecast.map((f) => f.rate);

  // Combine labels (history + forecast)
  const allLabels = [...historyLabels, ...forecastLabels];

  // Pad history dataset with nulls for forecast period
  const historicalDataset = [
    ...historyValues,
    ...Array(forecastLabels.length).fill(null),
  ];

  // Pad forecast dataset with nulls for history period, then actual forecast
  const forecastDataset = [
    ...Array(historyLabels.length - 1).fill(null),
    historyValues[historyValues.length - 1], // connect at last history point
    ...forecastValues,
  ];

  // 6-month low threshold line
  const sixMonthLowDataset = allLabels.map(() => data.six_month_low);

  const datasets: any[] = [
    {
      id: "history",
      label: "USD/INR Rate (Historical)",
      data: historicalDataset,
      borderColor: "#0ea5e9",
      backgroundColor: "rgba(14, 165, 233, 0.08)",
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: "#0ea5e9",
      tension: 0.4,
      fill: "origin",
      spanGaps: false,
      order: 1,
    },
    {
      id: "forecast",
      label: "AI Forecast",
      data: forecastDataset,
      borderColor: "#f59e0b",
      backgroundColor: "rgba(245, 158, 11, 0.05)",
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: "#f59e0b",
      tension: 0.4,
      fill: false,
      spanGaps: false,
      order: 2,
    },
    {
      id: "6mo_low",
      label: "6-Month Low",
      data: sixMonthLowDataset,
      borderColor: "rgba(239, 68, 68, 0.5)",
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderDash: [3, 3],
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0,
      fill: false,
      order: 3,
    },
  ];

  if (data.alert_threshold) {
    datasets.push({
      id: "threshold",
      label: `Alert Threshold (₹${data.alert_threshold})`,
      data: allLabels.map(() => data.alert_threshold),
      borderColor: "rgba(251, 191, 36, 0.3)",
      backgroundColor: "transparent",
      borderWidth: 1,
      borderDash: [2, 6],
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0,
      fill: false,
      order: 4,
    });
  }

  const chartData = {
    labels: allLabels,
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      // Legend disabled — HTML legend rendered in component header above chart
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(6, 13, 24, 0.95)",
        borderColor: "rgba(14, 165, 233, 0.3)",
        borderWidth: 1,
        titleColor: "#94a3b8",
        bodyColor: "#e2e8f0",
        padding: 12,
        cornerRadius: 10,
        titleFont: { family: "Inter", size: 11 },
        bodyFont: { family: "JetBrains Mono", size: 13, weight: "bold" as const },
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            if (ctx.parsed.y === null) return "";
            return ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(22, 43, 74, 0.6)",
          drawTicks: false,
        },
        ticks: {
          color: "#64748b", // slate-500 — WCAG AA compliant on dark bg
          font: { size: 11, family: "Inter" },
          maxTicksLimit: 10,
          maxRotation: 0,
          padding: 6, // prevent x-tick clipping at canvas edge
        },
        border: { color: "rgba(22, 43, 74, 0.8)" },
      },
      y: {
        grid: {
          color: "rgba(22, 43, 74, 0.6)",
          drawTicks: false,
        },
        ticks: {
          color: "#64748b", // slate-500 — WCAG AA compliant on dark bg
          font: { size: 11, family: "JetBrains Mono" },
          callback: (val: string | number) => `₹${Number(val).toFixed(1)}`,
          padding: 8, // prevent y-tick label clipping at canvas edge
        },
        border: { color: "rgba(22, 43, 74, 0.8)" },
      },
    },
    animation: {
      duration: 800,
      easing: "easeInOutQuart" as const,
    },
  };

  return (
    <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: "300ms" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-semibold text-lg">USD/INR Rate Chart</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Historical trajectory + AI forecast curve
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-brand-500 rounded inline-block" />
            History
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-gold-500 inline-block" />
            AI Forecast
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t border-dashed border-danger-500 inline-block" />
            6-Mo Low
          </span>
        </div>
      </div>
      <div className="h-72 md:h-96">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
