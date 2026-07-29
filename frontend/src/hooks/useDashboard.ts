import { useState, useEffect, useCallback } from "react";
import { DashboardData } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const API_URL = `${API_BASE_URL}/api/dashboard`;
const REFRESH_INTERVAL_MS = 30 * 1000; // 30 seconds 24/7 live polling

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json: DashboardData = await res.json();
      setData(json);
      setError(null);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const fetchInterval = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(fetchInterval);
  }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (lastUpdated) {
        const elapsed = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
        setSecondsAgo(elapsed);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  return { data, loading, error, lastUpdated, secondsAgo, refresh: fetchData };
}
