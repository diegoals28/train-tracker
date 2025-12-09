"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

interface PriceHistory {
  trainNumber: string;
  trainType: string;
  class: string;
  departureAt: string;
  history: { price: number; scrapedAt: string }[];
}

interface PriceChartProps {
  routeId: string | null;
  departureDate: string;
}

const COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#0891b2",
];

export function PriceChart({ routeId, departureDate }: PriceChartProps) {
  const [data, setData] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!routeId || !departureDate) return;

    setLoading(true);
    fetch(
      `/api/prices/history?routeId=${routeId}&departureDate=${departureDate}`
    )
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching price history:", error);
        setLoading(false);
      });
  }, [routeId, departureDate]);

  if (!routeId) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        Select a route to view price history
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No price data available for this date
      </div>
    );
  }

  // Transform data for chart
  const chartData = data.flatMap((train) =>
    train.history.map((h) => ({
      name: `${train.trainNumber} (${train.class})`,
      date: format(new Date(h.scrapedAt), "dd/MM HH:mm"),
      price: h.price,
      trainNumber: train.trainNumber,
      class: train.class,
    }))
  );

  // Group by scrape date for line chart
  const groupedByDate = chartData.reduce(
    (acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = { date: item.date };
      }
      acc[item.date][item.name] = item.price;
      return acc;
    },
    {} as Record<string, Record<string, number | string>>
  );

  const lineChartData = Object.values(groupedByDate);
  const trainKeys = Array.from(new Set(chartData.map((d) => d.name)));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={lineChartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `€${value}`}
          />
          <Tooltip
            formatter={(value: number) => [`€${value.toFixed(2)}`, "Price"]}
          />
          <Legend />
          {trainKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
