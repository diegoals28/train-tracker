"use client";

import { useState } from "react";
import { format, addDays } from "date-fns";
import * as XLSX from "xlsx";

interface HistoryRecord {
  departureDate: string;
  scrapedAt: string;
  direction: string;
  trainNumber: string;
  trainType: string;
  class: string;
  price: number;
  availableSeats: number | null;
  totalAvailable: number | null;
}

export function HistoryDownload() {
  const [loading, setLoading] = useState(false);
  const [daysAhead, setDaysAhead] = useState(30);

  const downloadHistory = async () => {
    setLoading(true);
    try {
      const startDate = format(new Date(), "yyyy-MM-dd");
      const endDate = format(addDays(new Date(), daysAhead), "yyyy-MM-dd");

      const response = await fetch(
        `/api/prices/export?startDate=${startDate}&endDate=${endDate}`
      );
      const result = await response.json();

      if (!result.data || result.data.length === 0) {
        alert("No hay datos históricos disponibles para el período seleccionado.");
        return;
      }

      // Group by departure date -> scrape time -> train time, finding min price
      type TrainData = { price: number; seats: number | null; total: number | null };
      type ScrapeData = Record<string, TrainData>; // "07:00" | "17:00" | "17:05"
      type DayData = Record<string, ScrapeData>; // scrape datetime -> trains

      const grouped: Record<string, DayData> = {};

      for (const record of result.data as HistoryRecord[]) {
        const departureDate = record.departureDate;
        const scrapeTime = format(new Date(record.scrapedAt), "MM-dd HH:mm");

        // Extract train time from direction
        let trainTime = "";
        if (record.direction.includes("07:00")) trainTime = "07:00";
        else if (record.direction.includes("17:05")) trainTime = "17:05";
        else if (record.direction.includes("17:00")) trainTime = "17:00";
        else continue;

        if (!grouped[departureDate]) grouped[departureDate] = {};
        if (!grouped[departureDate][scrapeTime]) grouped[departureDate][scrapeTime] = {};

        const existing = grouped[departureDate][scrapeTime][trainTime];
        if (!existing || record.price < existing.price) {
          grouped[departureDate][scrapeTime][trainTime] = {
            price: record.price,
            seats: record.availableSeats,
            total: record.totalAvailable,
          };
        }
      }

      // Build simplified Excel
      const excelData: Record<string, string | number>[] = [];
      const departureDates = Object.keys(grouped).sort();

      for (const date of departureDates) {
        // Header row for this date
        excelData.push({
          "Fecha": date,
          "Consulta": "",
          "07:00 €": "",
          "07:00 Disp": "",
          "17:00 €": "",
          "17:00 Disp": "",
          "17:05 €": "",
          "17:05 Disp": "",
        });

        const scrapeTimes = Object.keys(grouped[date]).sort();
        for (const scrapeTime of scrapeTimes) {
          const trains = grouped[date][scrapeTime];
          excelData.push({
            "Fecha": "",
            "Consulta": scrapeTime,
            "07:00 €": trains["07:00"]?.price ?? "-",
            "07:00 Disp": trains["07:00"] ? `${trains["07:00"].seats ?? "?"}/${trains["07:00"].total ?? "?"}` : "-",
            "17:00 €": trains["17:00"]?.price ?? "-",
            "17:00 Disp": trains["17:00"] ? `${trains["17:00"].seats ?? "?"}/${trains["17:00"].total ?? "?"}` : "-",
            "17:05 €": trains["17:05"]?.price ?? "-",
            "17:05 Disp": trains["17:05"] ? `${trains["17:05"].seats ?? "?"}/${trains["17:05"].total ?? "?"}` : "-",
          });
        }

        // Empty row separator
        excelData.push({
          "Fecha": "", "Consulta": "", "07:00 €": "", "07:00 Disp": "",
          "17:00 €": "", "17:00 Disp": "", "17:05 €": "", "17:05 Disp": "",
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Histórico");

      // Column widths
      const colWidths = [
        { wch: 12 }, // Fecha
        { wch: 12 }, // Consulta
        { wch: 8 },  // 07:00 €
        { wch: 8 },  // 07:00 Disp
        { wch: 8 },  // 17:00 €
        { wch: 8 },  // 17:00 Disp
        { wch: 8 },  // 17:05 €
        { wch: 8 },  // 17:05 Disp
      ];
      worksheet["!cols"] = colWidths;

      const filename = `historico_precios_${startDate}_${endDate}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error("Error downloading history:", error);
      alert("Error al descargar el histórico. Por favor, intente de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-50 p-2 rounded-lg flex-shrink-0">
          <svg
            className="w-6 h-6 text-brand-green"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">Histórico</p>
          <select
            value={daysAhead}
            onChange={(e) => setDaysAhead(Number(e.target.value))}
            className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-green"
          >
            <option value={7}>7 días</option>
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
            <option value={60}>60 días</option>
          </select>
        </div>
        <button
          onClick={downloadHistory}
          disabled={loading}
          className="px-3 py-1.5 bg-brand-green hover:bg-brand-green-dark disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-xs flex-shrink-0"
        >
          {loading ? "..." : "Excel"}
        </button>
      </div>
    </div>
  );
}
