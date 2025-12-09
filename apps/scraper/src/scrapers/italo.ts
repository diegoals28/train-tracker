import { fetchWithProxy } from "../proxy.js";

export interface ItaloResult {
  trainNumber: string;
  trainType: string;
  departureTime: Date;
  arrivalTime: Date;
  duration: number; // minutes
  prices: {
    class: string;
    price: number;
  }[];
}

interface ItaloTrain {
  TrainNumber: string;
  DepartureTime: string;
  ArrivalTime: string;
  Duration: string;
  Destination: string;
  Origin: string;
  LowCostFares?: {
    FareName: string;
    Price: number;
    Currency: string;
  }[];
  Fares?: {
    FareName: string;
    Price: number;
    SeatClass: string;
  }[];
}

interface ItaloResponse {
  Journeys?: ItaloTrain[];
  OutboundJourneys?: ItaloTrain[];
}

// Station codes for Italo
export const ITALO_STATIONS: Record<string, string> = {
  ROMA_TERMINI: "ROT",
  ROMA_TIBURTINA: "RTI",
  NAPOLI_CENTRALE: "NAC",
  NAPOLI_AFRAGOLA: "NAA",
  MILANO_CENTRALE: "MIC",
  MILANO_ROGOREDO: "MIR",
  FIRENZE_SMN: "FIS",
  VENEZIA_MESTRE: "VEM",
  BOLOGNA_CENTRALE: "BOC",
  TORINO_PN: "TOP",
};

function parseDuration(duration: string): number {
  // Format: "02:30" or "1:45"
  const parts = duration.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
}

export async function scrapeItalo(
  originCode: string,
  destCode: string,
  date: Date
): Promise<ItaloResult[]> {
  const formattedDate = date.toISOString().split("T")[0];

  // Italo API endpoint
  const url = "https://italoinviaggio.italotreno.it/api/booking/search";

  const body = {
    DepartureStation: originCode,
    ArrivalStation: destCode,
    DepartureDate: formattedDate,
    ReturnDate: null,
    Adults: 1,
    Children: 0,
    Infants: 0,
    YoungAdults: 0,
    Seniors: 0,
    CartaFreccia: null,
    DiscountCards: [],
    IsOneWay: true,
  };

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Language": "it-IT,it;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Origin: "https://www.italotreno.it",
    Referer: "https://www.italotreno.it/",
  };

  try {
    const response = await fetchWithProxy(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`Italo API error: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as ItaloResponse;
    const journeys = data.Journeys || data.OutboundJourneys || [];
    const results: ItaloResult[] = [];

    for (const journey of journeys) {
      const prices: { class: string; price: number }[] = [];

      // Low cost fares
      for (const fare of journey.LowCostFares || []) {
        if (fare.Price) {
          prices.push({
            class: fare.FareName || "Low Cost",
            price: fare.Price,
          });
        }
      }

      // Regular fares
      for (const fare of journey.Fares || []) {
        if (fare.Price) {
          prices.push({
            class: `${fare.SeatClass || ""} ${fare.FareName || ""}`.trim() || "Standard",
            price: fare.Price,
          });
        }
      }

      if (prices.length > 0) {
        results.push({
          trainNumber: journey.TrainNumber,
          trainType: "Italo",
          departureTime: new Date(journey.DepartureTime),
          arrivalTime: new Date(journey.ArrivalTime),
          duration: parseDuration(journey.Duration),
          prices,
        });
      }
    }

    console.log(
      `Italo: Found ${results.length} trains for ${originCode} -> ${destCode} on ${formattedDate}`
    );
    return results;
  } catch (error) {
    console.error("Italo scraping error:", error);
    return [];
  }
}
