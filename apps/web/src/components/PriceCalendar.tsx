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
  availableSeats: number | null;
  totalAvailable: number | null;
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
  const [monthsToShow, setMonthsToShow] = useState(3);

  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    const start = startOfMonth(currentMonth);
    // Fetch all available data (12 months ahead) regardless of visible months
    const end = endOfMonth(addMonths(currentMonth, 11));

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
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-center mb-4 text-gray-900">
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
                  relative min-h-[60px] p-1 rounded-lg cursor-pointer transition-all
                  ${!isCurrentMonth ? "bg-gray-50 opacity-50" : ""}
                  ${isPast ? "bg-gray-100 cursor-not-allowed opacity-50" : ""}
                  ${isSelected ? "ring-2 ring-brand-orange bg-orange-50" : ""}
                  ${isHovered && !isPast ? "bg-orange-50/50" : ""}
                  ${isToday(day) ? "border-2 border-brand-orange" : "border border-gray-200"}
                  ${hasData && !isPast ? "hover:bg-orange-50/30" : ""}
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
                      <div className="text-[10px] bg-orange-100 text-brand-orange rounded px-1 truncate font-medium">
                        €{dayData.outbound.price.toFixed(0)}
                      </div>
                    )}
                    {dayData.return && (
                      <div className="text-[10px] bg-emerald-100 text-brand-green rounded px-1 truncate font-medium">
                        €{dayData.return.price.toFixed(0)}
                      </div>
                    )}
                  </div>
                )}

                {/* Hover tooltip */}
                {isHovered && dayData && !isPast && (
                  <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-lg">
                    <div className="font-semibold mb-2">
                      {format(day, "EEEE d MMMM", { locale: es })}
                    </div>
                    {dayData.outbound ? (
                      <div className="mb-2">
                        <div className="text-orange-300 font-medium">Roma → Napoli (07:00)</div>
                        <div>Tren: {dayData.outbound.trainNumber}</div>
                        <div>Clase: {dayData.outbound.class}</div>
                        <div className="text-lg font-bold text-orange-300">
                          €{dayData.outbound.price.toFixed(2)}
                        </div>
                        {dayData.outbound.availableSeats !== null && (
                          <div className="text-orange-200 text-[10px]">
                            Billetes clase: {dayData.outbound.availableSeats}
                          </div>
                        )}
                        {dayData.outbound.totalAvailable !== null && (
                          <div className="text-gray-300 text-[10px]">
                            Total disponibles: {dayData.outbound.totalAvailable}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-400 mb-2">Sin datos ida</div>
                    )}
                    {dayData.return ? (
                      <div>
                        <div className="text-emerald-300 font-medium">Napoli → Roma (16:55-17:05)</div>
                        <div>Tren: {dayData.return.trainNumber}</div>
                        <div>Clase: {dayData.return.class}</div>
                        <div className="text-lg font-bold text-emerald-300">
                          €{dayData.return.price.toFixed(2)}
                        </div>
                        {dayData.return.availableSeats !== null && (
                          <div className="text-emerald-200 text-[10px]">
                            Billetes clase: {dayData.return.availableSeats}
                          </div>
                        )}
                        {dayData.return.totalAvailable !== null && (
                          <div className="text-gray-300 text-[10px]">
                            Total disponibles: {dayData.return.totalAvailable}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-400">Sin datos vuelta</div>
                    )}
                    {dayData.outbound && dayData.return && (
                      <div className="mt-2 pt-2 border-t border-gray-600">
                        <div className="text-white font-bold">
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
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, monthsToShow))}
            className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-700 font-medium text-sm"
          >
            ← {monthsToShow} meses
          </button>
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-700 font-medium text-sm"
          >
            ← 1 mes
          </button>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={monthsToShow}
            onChange={(e) => setMonthsToShow(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <option value={2}>2 meses</option>
            <option value={3}>3 meses</option>
            <option value={4}>4 meses</option>
            <option value={6}>6 meses</option>
          </select>
          {selectedDates.size > 0 && (
            <button
              onClick={clearSelection}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
            >
              Limpiar ({selectedDates.size})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-700 font-medium text-sm"
          >
            1 mes →
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, monthsToShow))}
            className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-700 font-medium text-sm"
          >
            {monthsToShow} meses →
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-100 rounded"></div>
          <span className="text-gray-600">Ida (Roma → Napoli 07:00)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-emerald-100 rounded"></div>
          <span className="text-gray-600">Vuelta (Napoli → Roma 16:55-17:05)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 ring-2 ring-brand-orange rounded"></div>
          <span className="text-gray-600">Seleccionado</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
          <p className="mt-2 text-gray-500">Cargando precios...</p>
        </div>
      ) : (
        <div className={`grid gap-6 ${monthsToShow <= 2 ? 'grid-cols-1 md:grid-cols-2' : monthsToShow === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {Array.from({ length: monthsToShow }, (_, i) =>
            renderMonth(addMonths(currentMonth, i))
          )}
        </div>
      )}
    </div>
  );
}
