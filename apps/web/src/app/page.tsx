"use client";

import { useState } from "react";
import { RouteSelector } from "@/components/RouteSelector";
import { PriceChart } from "@/components/PriceChart";
import { PriceTable } from "@/components/PriceTable";
import { format, addDays } from "date-fns";

export default function Home() {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    format(addDays(new Date(), 7), "yyyy-MM-dd")
  );

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Train Price Tracker
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor prices for Trenitalia and Italo trains
          </p>
        </div>

        {/* Route Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            Select Route
          </h2>
          <RouteSelector
            selectedRouteId={selectedRouteId}
            onRouteSelect={setSelectedRouteId}
          />
        </div>

        {/* Price History Chart */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Price History
            </h2>
            <div className="mt-2 sm:mt-0">
              <label className="text-sm text-gray-500 mr-2">
                Departure Date:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
                max={format(addDays(new Date(), 90), "yyyy-MM-dd")}
                className="border border-gray-300 rounded px-3 py-1 text-sm"
              />
            </div>
          </div>
          <PriceChart routeId={selectedRouteId} departureDate={selectedDate} />
        </div>

        {/* Price Table */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Upcoming Trains
          </h2>
          <PriceTable routeId={selectedRouteId} />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Data is updated daily. Prices shown are the latest available.
          </p>
          <p className="mt-1 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
              Trenitalia
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-yellow-500"></span>
              Italo
            </span>
          </p>
        </div>
      </div>
    </main>
  );
}
