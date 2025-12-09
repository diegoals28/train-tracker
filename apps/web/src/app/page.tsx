"use client";

import { useState, useCallback } from "react";
import { PriceCalendar } from "@/components/PriceCalendar";
import { SelectedDatesPanel } from "@/components/SelectedDatesPanel";

interface PriceInfo {
  price: number;
  trainNumber: string;
  departureTime: string;
  class: string;
}

interface SelectedDate {
  date: string;
  outbound: PriceInfo | null;
  return: PriceInfo | null;
}

export default function Home() {
  const [selectedDates, setSelectedDates] = useState<SelectedDate[]>([]);

  const handleSelectionChange = useCallback((dates: SelectedDate[]) => {
    setSelectedDates(dates);
  }, []);

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="bg-red-600 text-white p-3 rounded-lg">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Roma ↔ Napoli Train Tracker
              </h1>
              <p className="text-gray-600">
                Compara precios para el tren de las 07:00 (ida) y 17:00 (vuelta)
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Ida</p>
                <p className="font-semibold text-gray-900">Roma Termini → Napoli</p>
                <p className="text-xs text-green-600">Salida: ~07:00</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vuelta</p>
                <p className="font-semibold text-gray-900">Napoli → Roma Termini</p>
                <p className="text-xs text-blue-600">Salida: ~17:00</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Instrucciones</p>
                <p className="text-xs text-gray-600">
                  Pasa el mouse sobre las fechas para ver precios.
                  Haz clic para seleccionar y luego exporta a Excel.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="mb-6">
          <PriceCalendar onSelectionChange={handleSelectionChange} />
        </div>

        {/* Selected Dates Panel */}
        <div>
          <SelectedDatesPanel selectedDates={selectedDates} />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Los precios se actualizan diariamente a las 06:00 AM.
          </p>
          <p className="mt-1">
            Se muestran los precios más bajos disponibles para cada horario.
          </p>
        </div>
      </div>
    </main>
  );
}
