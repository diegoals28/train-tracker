import { fetchWithProxy } from "../proxy.js";

export interface TrenitaliaResult {
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

interface TrenitaliaOffer {
  name: string;
  serviceName: string;
  price: {
    amount: number;
    currency: string;
  };
}

interface TrenitaliaService {
  name: string;
  offers: TrenitaliaOffer[];
  minPrice: {
    amount: number;
    currency: string;
  };
}

interface TrenitaliaGrid {
  services: TrenitaliaService[];
}

interface TrenitaliaSolution {
  solution: {
    id: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    price: {
      amount: number;
      currency: string;
    };
    trains: {
      trainCategory: string;
      acronym: string;
      name: string;
      denomination: string;
    }[];
  };
  grids: TrenitaliaGrid[];
}

interface TrenitaliaResponse {
  solutions: TrenitaliaSolution[];
}

interface LocationResult {
  id: number;
  name: string;
}

// Station IDs for Trenitalia (numeric IDs required by new API)
// Get IDs from: https://www.lefrecce.it/Channels.Website.BFF.WEB/website/locations/search?name=STATION_NAME&limit=5
export const TRENITALIA_STATIONS: Record<string, number> = {
  ROMA_TERMINI: 830008409,
  NAPOLI_CENTRALE: 830009218,
  MILANO_CENTRALE: 830008300,
  FIRENZE_SMN: 830000601,
  VENEZIA_SL: 830000827,
  BOLOGNA_CENTRALE: 830005100,
  TORINO_PN: 830000219,
};

function parseDuration(duration: string): number {
  // Format: "2h 33min" or "PT2H30M" or "1h" or "45min"
  // Try new format first: "2h 33min"
  const newFormatMatch = duration.match(/(\d+)h\s*(\d+)?min?/i);
  if (newFormatMatch) {
    const hours = parseInt(newFormatMatch[1]) || 0;
    const minutes = parseInt(newFormatMatch[2]) || 0;
    return hours * 60 + minutes;
  }

  // Try ISO format: "PT2H30M"
  const hours = duration.match(/(\d+)H/)?.[1] || "0";
  const minutes = duration.match(/(\d+)M/)?.[1] || "0";
  return parseInt(hours) * 60 + parseInt(minutes);
}

export async function scrapeTrenitalia(
  originCode: number,
  destCode: number,
  date: Date
): Promise<TrenitaliaResult[]> {
  // Use the time from the passed date parameter instead of hardcoding 06:00
  const departureTime = new Date(date);

  const url = "https://www.lefrecce.it/Channels.Website.BFF.WEB/website/ticket/solutions";

  const body = {
    departureLocationId: originCode,
    arrivalLocationId: destCode,
    departureTime: departureTime.toISOString(),
    adults: 1,
    children: 0,
    criteria: {
      frecceOnly: false,
      regionalOnly: false,
      noChanges: false,
      order: "DEPARTURE_DATE",
      limit: 20,
      offset: 0,
    },
    advancedSearchRequest: {
      bestFare: false,
    },
  };

  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Origin": "https://www.lefrecce.it",
    "Referer": "https://www.lefrecce.it/",
  };

  try {
    const response = await fetchWithProxy(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Trenitalia API error: ${response.status}`, text.substring(0, 200));
      return [];
    }

    const data = (await response.json()) as TrenitaliaResponse;
    const results: TrenitaliaResult[] = [];

    for (const sol of data.solutions || []) {
      const train = sol.solution.trains?.[0];
      if (!train) continue;

      const prices: { class: string; price: number }[] = [];

      // Extract prices from grids -> services -> offers
      for (const grid of sol.grids || []) {
        for (const service of grid.services || []) {
          // Get the minimum price for each service class
          if (service.minPrice?.amount) {
            prices.push({
              class: service.name || "Standard",
              price: service.minPrice.amount,
            });
          }
        }
      }

      // If no grid prices, use the solution price
      if (prices.length === 0 && sol.solution.price?.amount) {
        prices.push({
          class: "Standard",
          price: sol.solution.price.amount,
        });
      }

      if (prices.length > 0) {
        results.push({
          trainNumber: train.name || train.acronym || "N/A",
          trainType: train.denomination || train.trainCategory || train.acronym || "Trenitalia",
          departureTime: new Date(sol.solution.departureTime),
          arrivalTime: new Date(sol.solution.arrivalTime),
          duration: parseDuration(sol.solution.duration || "0min"),
          prices,
        });
      }
    }

    console.log(
      `Trenitalia: Found ${results.length} trains for ${originCode} -> ${destCode} on ${date.toISOString().split("T")[0]}`
    );
    return results;
  } catch (error) {
    console.error("Trenitalia scraping error:", error);
    return [];
  }
}
