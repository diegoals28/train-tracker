"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";

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

interface SelectedDatesPanelProps {
  selectedDates: SelectedDate[];
}

export function SelectedDatesPanel({ selectedDates }: SelectedDatesPanelProps) {
  const exportToExcel = () => {
    if (selectedDates.length === 0) return;

    const data = selectedDates.map((item) => ({
      Fecha: format(new Date(item.date), "EEEE d MMMM yyyy", { locale: es }),
      "Ida - Tren": item.outbound?.trainNumber || "N/A",
      "Ida - Hora": item.outbound
        ? format(new Date(item.outbound.departureTime), "HH:mm")
        : "N/A",
      "Ida - Clase": item.outbound?.class || "N/A",
      "Ida - Precio (€)": item.outbound?.price || 0,
      "Vuelta - Tren": item.return?.trainNumber || "N/A",
      "Vuelta - Hora": item.return
        ? format(new Date(item.return.departureTime), "HH:mm")
        : "N/A",
      "Vuelta - Clase": item.return?.class || "N/A",
      "Vuelta - Precio (€)": item.return?.price || 0,
      "Total (€)": (item.outbound?.price || 0) + (item.return?.price || 0),
    }));

    // Calculate totals
    const totals = selectedDates.reduce(
      (acc, item) => ({
        outbound: acc.outbound + (item.outbound?.price || 0),
        return: acc.return + (item.return?.price || 0),
      }),
      { outbound: 0, return: 0 }
    );

    // Add summary row
    data.push({
      Fecha: "TOTAL",
      "Ida - Tren": "",
      "Ida - Hora": "",
      "Ida - Clase": "",
      "Ida - Precio (€)": totals.outbound,
      "Vuelta - Tren": "",
      "Vuelta - Hora": "",
      "Vuelta - Clase": "",
      "Vuelta - Precio (€)": totals.return,
      "Total (€)": totals.outbound + totals.return,
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Precios Trenes");

    // Auto-size columns
    const colWidths = [
      { wch: 25 }, // Fecha
      { wch: 12 }, // Ida - Tren
      { wch: 10 }, // Ida - Hora
      { wch: 20 }, // Ida - Clase
      { wch: 15 }, // Ida - Precio
      { wch: 12 }, // Vuelta - Tren
      { wch: 10 }, // Vuelta - Hora
      { wch: 20 }, // Vuelta - Clase
      { wch: 15 }, // Vuelta - Precio
      { wch: 12 }, // Total
    ];
    worksheet["!cols"] = colWidths;

    // Generate filename with date range
    const startDate = selectedDates[0]?.date || "fechas";
    const endDate = selectedDates[selectedDates.length - 1]?.date || "";
    const filename = `precios_trenes_${startDate}_${endDate}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  const totalOutbound = selectedDates.reduce(
    (sum, d) => sum + (d.outbound?.price || 0),
    0
  );
  const totalReturn = selectedDates.reduce(
    (sum, d) => sum + (d.return?.price || 0),
    0
  );
  const grandTotal = totalOutbound + totalReturn;

  if (selectedDates.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="font-medium">No hay fechas seleccionadas</p>
        <p className="text-sm mt-1">
          Haz clic en las fechas del calendario para seleccionarlas
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Fechas Seleccionadas ({selectedDates.length})
        </h3>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Exportar a Excel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Fecha
              </th>
              <th className="px-4 py-3 text-left font-medium text-green-600">
                Ida (Roma → Napoli)
              </th>
              <th className="px-4 py-3 text-right font-medium text-green-600">
                Precio Ida
              </th>
              <th className="px-4 py-3 text-left font-medium text-blue-600">
                Vuelta (Napoli → Roma)
              </th>
              <th className="px-4 py-3 text-right font-medium text-blue-600">
                Precio Vuelta
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-900">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {selectedDates.map((item) => (
              <tr key={item.date} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {format(new Date(item.date), "EEE d MMM", { locale: es })}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {item.outbound ? (
                    <div>
                      <span className="font-medium">
                        {format(new Date(item.outbound.departureTime), "HH:mm")}
                      </span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span>{item.outbound.trainNumber}</span>
                      <div className="text-xs text-gray-400">
                        {item.outbound.class}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-green-600">
                  {item.outbound ? `€${item.outbound.price.toFixed(2)}` : "-"}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {item.return ? (
                    <div>
                      <span className="font-medium">
                        {format(new Date(item.return.departureTime), "HH:mm")}
                      </span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span>{item.return.trainNumber}</span>
                      <div className="text-xs text-gray-400">
                        {item.return.class}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-blue-600">
                  {item.return ? `€${item.return.price.toFixed(2)}` : "-"}
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  €
                  {(
                    (item.outbound?.price || 0) + (item.return?.price || 0)
                  ).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 font-semibold">
            <tr>
              <td className="px-4 py-3 text-gray-900">TOTAL</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-right text-green-600">
                €{totalOutbound.toFixed(2)}
              </td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-right text-blue-600">
                €{totalReturn.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-lg text-gray-900">
                €{grandTotal.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
