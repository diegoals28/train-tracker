"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  isBefore,
} from "date-fns";
import { es } from "date-fns/locale";

interface PriceInfo {
  price: number;
  trainNumber: string;
  departureTime: string;
  class: string;
}

interface CalendarData {
  [date: string]: {
    outbound: PriceInfo | null;
    return: PriceInfo | null;
  };
}

interface SelectedDate {
  date: string;
  outbound: PriceInfo | null;
  return: PriceInfo | null;
}

interface PriceCalendarProps {
  onSelectionChange: (selectedDates: SelectedDate[]) => void;
}

export function PriceCalendar({ onSelectionChange }: PriceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarData>({});
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(addMonths(currentMonth, 1)); // Fetch 2 months

    try {
      const response = await fetch(
        `/api/calendar?startDate=${format(start, "yyyy-MM-dd")}&endDate=${format(end, "yyyy-MM-dd")}`
      );
      const data = await response.json();
      setCalendarData(data.calendarData || {});
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  useEffect(() => {
    const selected: SelectedDate[] = Array.from(selectedDates)
      .sort()
      .map((date) => ({
        date,
        outbound: calendarData[date]?.outbound || null,
        return: calendarData[date]?.return || null,
      }));
    onSelectionChange(selected);
  }, [selectedDates, calendarData, onSelectionChange]);

  const toggleDate = (dateStr: string) => {
    const newSelected = new Set(selectedDates);
    if (newSelected.has(dateStr)) {
      newSelected.delete(dateStr);
    } else {
      newSelected.add(dateStr);
    }
    setSelectedDates(newSelected);
  };

  const clearSelection = () => {
    setSelectedDates(new Set());
  };

  const renderMonth = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-center mb-4 text-gray-800">
          {format(monthDate, "MMMM yyyy", { locale: es })}
        </h3>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-gray-500 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const isCurrentMonth = isSameMonth(day, monthDate);
            const isPast = isBefore(day, new Date()) && !isToday(day);
            const dayData = calendarData[dateStr];
            const isSelected = selectedDates.has(dateStr);
            const isHovered = hoveredDate === dateStr;
            const hasData = dayData?.outbound || dayData?.return;

            return (
              <div
                key={dateStr}
                className={`
                  relative min-h-[60px] p-1 rounded-md cursor-pointer transition-all
                  ${!isCurrentMonth ? "bg-gray-50 opacity-50" : ""}
                  ${isPast ? "bg-gray-100 cursor-not-allowed opacity-50" : ""}
                  ${isSelected ? "ring-2 ring-blue-500 bg-blue-50" : ""}
                  ${isHovered && !isPast ? "bg-yellow-50" : ""}
                  ${isToday(day) ? "border-2 border-blue-400" : "border border-gray-200"}
                  ${hasData && !isPast ? "hover:bg-green-50" : ""}
                `}
                onMouseEnter={() => !isPast && setHoveredDate(dateStr)}
                onMouseLeave={() => setHoveredDate(null)}
                onClick={() => !isPast && isCurrentMonth && hasData && toggleDate(dateStr)}
              >
                <div className="text-xs font-medium text-gray-700">
                  {format(day, "d")}
                </div>

                {isCurrentMonth && !isPast && dayData && (
                  <div className="mt-1 space-y-0.5">
                    {dayData.outbound && (
                      <div className="text-[10px] bg-green-100 text-green-800 rounded px-1 truncate">
                        €{dayData.outbound.price.toFixed(0)}
                      </div>
                    )}
                    {dayData.return && (
                      <div className="text-[10px] bg-blue-100 text-blue-800 rounded px-1 truncate">
                        €{dayData.return.price.toFixed(0)}
                      </div>
                    )}
                  </div>
                )}

                {/* Hover tooltip */}
                {isHovered && dayData && !isPast && (
                  <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
                    <div className="font-semibold mb-2">
                      {format(day, "EEEE d MMMM", { locale: es })}
                    </div>
                    {dayData.outbound ? (
                      <div className="mb-2">
                        <div className="text-green-300 font-medium">Roma → Napoli (07:00)</div>
                        <div>Tren: {dayData.outbound.trainNumber}</div>
                        <div>Clase: {dayData.outbound.class}</div>
                        <div className="text-lg font-bold text-green-300">
                          €{dayData.outbound.price.toFixed(2)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400 mb-2">Sin datos ida</div>
                    )}
                    {dayData.return ? (
                      <div>
                        <div className="text-blue-300 font-medium">Napoli → Roma (17:00)</div>
                        <div>Tren: {dayData.return.trainNumber}</div>
                        <div>Clase: {dayData.return.class}</div>
                        <div className="text-lg font-bold text-blue-300">
                          €{dayData.return.price.toFixed(2)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-400">Sin datos vuelta</div>
                    )}
                    {dayData.outbound && dayData.return && (
                      <div className="mt-2 pt-2 border-t border-gray-600">
                        <div className="text-yellow-300 font-bold">
                          Total: €{(dayData.outbound.price + dayData.return.price).toFixed(2)}
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
                      <div className="border-8 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
        >
          ← Anterior
        </button>
        <div className="flex items-center gap-4">
          {selectedDates.size > 0 && (
            <button
              onClick={clearSelection}
              className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded"
            >
              Limpiar selección ({selectedDates.size})
            </button>
          )}
        </div>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium"
        >
          Siguiente →
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 rounded"></div>
          <span>Ida (Roma → Napoli 07:00)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 rounded"></div>
          <span>Vuelta (Napoli → Roma 17:00)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 ring-2 ring-blue-500 rounded"></div>
          <span>Seleccionado</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Cargando precios...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderMonth(currentMonth)}
          {renderMonth(addMonths(currentMonth, 1))}
        </div>
      )}
    </div>
  );
}
