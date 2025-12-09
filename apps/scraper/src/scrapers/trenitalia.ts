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

interface TrenitaliaSolution {
  solution: {
    id: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    trains: {
      trainCategory: string;
      acronym: string;
      name: string;
    }[];
  };
  grids: {
    offers: {
      name: string;
      price: {
        amount: number;
        currency: string;
      };
      serviceName: string;
    }[];
  }[];
}

interface TrenitaliaResponse {
  solutions: TrenitaliaSolution[];
}

// Station codes for Trenitalia
export const TRENITALIA_STATIONS: Record<string, string> = {
  ROMA_TERMINI: "830008409",
  NAPOLI_CENTRALE: "830005043",
  MILANO_CENTRALE: "830000219",
  FIRENZE_SMN: "830000601",
  VENEZIA_SL: "830000827",
  BOLOGNA_CENTRALE: "830000501",
  TORINO_PN: "830000219",
};

function parseDuration(duration: string): number {
  // Format: "PT2H30M" or "PT1H" or "PT45M"
  const hours = duration.match(/(\d+)H/)?.[1] || "0";
  const minutes = duration.match(/(\d+)M/)?.[1] || "0";
  return parseInt(hours) * 60 + parseInt(minutes);
}

export async function scrapeTrenitalia(
  originCode: string,
  destCode: string,
  date: Date
): Promise<TrenitaliaResult[]> {
  const formattedDate = date.toISOString().split("T")[0];

  const url = "https://www.lefrecce.it/Channels.Website.BFF.WEB/website/ticket/solutions";

  const body = {
    departureLocationId: originCode,
    arrivalLocationId: destCode,
    departureTime: `${formattedDate}T06:00:00.000`,
    adults: 1,
    children: 0,
    criteria: {
      frecpiua: false,
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
      console.error(`Trenitalia API error: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as TrenitaliaResponse;
    const results: TrenitaliaResult[] = [];

    for (const sol of data.solutions || []) {
      const train = sol.solution.trains?.[0];
      if (!train) continue;

      const prices: { class: string; price: number }[] = [];

      for (const grid of sol.grids || []) {
        for (const offer of grid.offers || []) {
          if (offer.price?.amount) {
            prices.push({
              class: offer.serviceName || offer.name || "Standard",
              price: offer.price.amount,
            });
          }
        }
      }

      if (prices.length > 0) {
        results.push({
          trainNumber: train.name || train.acronym,
          trainType: train.trainCategory || train.acronym,
          departureTime: new Date(sol.solution.departureTime),
          arrivalTime: new Date(sol.solution.arrivalTime),
          duration: parseDuration(sol.solution.duration),
          prices,
        });
      }
    }

    console.log(
      `Trenitalia: Found ${results.length} trains for ${originCode} -> ${destCode} on ${formattedDate}`
    );
    return results;
  } catch (error) {
    console.error("Trenitalia scraping error:", error);
    return [];
  }
}
