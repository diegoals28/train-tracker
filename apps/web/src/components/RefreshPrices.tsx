"use client";

import { useState, useEffect } from "react";

export function RefreshPrices() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Fetch last update time
    fetch("/api/prices/last-update")
      .then((res) => res.json())
      .then((data) => {
        if (data.lastUpdate) {
          setLastUpdate(data.lastUpdate);
        }
      })
      .catch(() => {});
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setMessage("Actualizando precios... Esto puede tardar varios minutos.");

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 60 }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(
          `Actualizado: ${data.stats.outboundPrices} precios ida, ${data.stats.returnPrices} precios vuelta`
        );
        setLastUpdate(new Date().toISOString());
        // Reload page to show new prices
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setMessage(`Error: ${data.error || "Error desconocido"}`);
      }
    } catch (error) {
      setMessage("Error al actualizar precios");
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className="bg-blue-50 p-2 rounded-lg">
          <svg
            className="w-6 h-6 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500">Actualizar precios</p>
          {lastUpdate && (
            <p className="text-xs text-gray-400">
              Ultima actualiz.: {formatDate(lastUpdate)}
            </p>
          )}
          {message && (
            <p className="text-xs text-blue-600 mt-1">{message}</p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isRefreshing
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {isRefreshing ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Actualizando...
            </span>
          ) : (
            "Actualizar"
          )}
        </button>
      </div>
    </div>
  );
}
