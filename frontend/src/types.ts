// Shared TypeScript types for the frontend

export interface HistoryPoint {
  date: string;
  rate: number;
}

export interface DashboardData {
  current_rate: number;
  current_date: string;
  last_updated_timestamp?: string;
  six_month_low: number;
  is_at_6mo_low: boolean;
  predicted_lowest_rate: number;
  predicted_date: string;
  ai_analysis: string;
  history: HistoryPoint[];
  forecast: HistoryPoint[];
  alert_threshold?: number;
}
