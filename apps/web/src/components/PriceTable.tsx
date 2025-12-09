"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

interface Price {
  id: string;
  trainNumber: string;
  trainType: string;
  departureAt: string;
  price: string;
  class: string;
  duration: number | null;
  scrapedAt: string;
  route: {
    provider: string;
  };
}

interface PriceTableProps {
  routeId: string | null;
}

export function PriceTable({ routeId }: PriceTableProps) {
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!routeId) return;

    setLoading(true);
    fetch(`/api/prices?routeId=${routeId}&days=7`)
      .then((res) => res.json())
      .then((data) => {
        // Get unique prices per train/class (most recent scrape)
        const uniquePrices = Object.values(
          data.reduce(
            (acc: Record<string, Price>, price: Price) => {
              const key = `${price.trainNumber}-${price.class}-${price.departureAt}`;
              if (!acc[key] || new Date(price.scrapedAt) > new Date(acc[key].scrapedAt)) {
                acc[key] = price;
              }
              return acc;
            },
            {}
          )
        ) as Price[];

        setPrices(
          uniquePrices.sort(
            (a, b) =>
              new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime()
          )
        );
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching prices:", error);
        setLoading(false);
      });
  }, [routeId]);

  if (!routeId) {
    return (
      <div className="text-gray-500 text-center py-8">
        Select a route to view prices
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (prices.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        No prices found. Run the scraper to collect data.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Train
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Class
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Price
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {prices.map((price) => (
            <tr key={price.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {format(new Date(price.departureAt), "dd/MM/yyyy HH:mm")}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                {price.trainNumber}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    price.route.provider === "TRENITALIA"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {price.trainType}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {price.class}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {price.duration
                  ? `${Math.floor(price.duration / 60)}h ${price.duration % 60}m`
                  : "-"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                €{parseFloat(price.price).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
