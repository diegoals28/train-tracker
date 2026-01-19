"use client";

import { useState, useEffect } from "react";

export function RefreshPrices() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/prices/last-update")
      .then((res) => res.json())
      .then((data) => {
        if (data.lastUpdate) {
          setLastUpdate(data.lastUpdate);
        }
      })
      .catch(() => {});
  }, []);

  const handleCleanupYoung = async () => {
    if (isCleaning) return;

    setIsCleaning(true);
    setMessage("Limpiando FrecciaYoung...");

    try {
      const response = await fetch("/api/prices/cleanup-young", {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`Eliminados ${data.deleted} precios Young`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage(`Error: ${data.error || "Error"}`);
      }
    } catch (error) {
      setMessage("Error de conexión");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setMessage("Actualizando...");

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 60 }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`OK: ${data.stats.outboundPrices + data.stats.returnPrices} precios`);
        setLastUpdate(new Date().toISOString());
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setMessage(`Error: ${data.error || "Error"}`);
      }
    } catch (error) {
      setMessage("Error de conexión");
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
        <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
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
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">Actualizar</p>
          {lastUpdate && (
            <p className="text-xs text-gray-400 truncate">
              {formatDate(lastUpdate)}
            </p>
          )}
          {message && (
            <p className="text-xs text-blue-600 truncate">{message}</p>
          )}
        </div>
        <button
          onClick={handleCleanupYoung}
          disabled={isCleaning || isRefreshing}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
            isCleaning || isRefreshing
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-red-600 text-white hover:bg-red-700"
          }`}
          title="Eliminar tarifas FrecciaYoung de la base de datos"
        >
          {isCleaning ? "..." : "Limpiar Young"}
        </button>
      </div>
    </div>
  );
}
