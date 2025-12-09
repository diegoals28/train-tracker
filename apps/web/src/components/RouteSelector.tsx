"use client";

import { useEffect, useState } from "react";

interface Route {
  id: string;
  originName: string;
  destName: string;
  provider: string;
}

interface RouteSelectorProps {
  selectedRouteId: string | null;
  onRouteSelect: (routeId: string) => void;
}

export function RouteSelector({
  selectedRouteId,
  onRouteSelect,
}: RouteSelectorProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/routes")
      .then((res) => res.json())
      .then((data) => {
        setRoutes(data);
        if (data.length > 0 && !selectedRouteId) {
          onRouteSelect(data[0].id);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching routes:", error);
        setLoading(false);
      });
  }, [selectedRouteId, onRouteSelect]);

  if (loading) {
    return (
      <div className="animate-pulse h-10 bg-gray-200 rounded w-64"></div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        No routes configured. Run the scraper first.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {routes.map((route) => (
        <button
          key={route.id}
          onClick={() => onRouteSelect(route.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedRouteId === route.id
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                route.provider === "TRENITALIA" ? "bg-red-500" : "bg-yellow-500"
              }`}
            />
            {route.originName} → {route.destName}
          </span>
        </button>
      ))}
    </div>
  );
}
