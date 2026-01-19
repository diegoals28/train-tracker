import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Station IDs
const TRENITALIA_STATIONS = {
  ROMA_TERMINI: 830008409,
  NAPOLI_CENTRALE: 830009218,
};

interface TrenitaliaResult {
  trainNumber: string;
  trainType: string;
  departureTime: Date;
  arrivalTime: Date;
  duration: number;
  prices: { class: string; price: number; availableSeats: number | null }[];
  totalAvailable: number | null;
}

function parseDuration(duration: string): number {
  const newFormatMatch = duration.match(/(\d+)h\s*(\d+)?min?/i);
  if (newFormatMatch) {
    const hours = parseInt(newFormatMatch[1]) || 0;
    const minutes = parseInt(newFormatMatch[2]) || 0;
    return hours * 60 + minutes;
  }
  const hours = duration.match(/(\d+)H/)?.[1] || "0";
  const minutes = duration.match(/(\d+)M/)?.[1] || "0";
  return parseInt(hours) * 60 + parseInt(minutes);
}

async function scrapeTrenitalia(
  originCode: number,
  destCode: number,
  date: Date
): Promise<TrenitaliaResult[]> {
  const url =
    "https://www.lefrecce.it/Channels.Website.BFF.WEB/website/ticket/solutions";

  const body = {
    departureLocationId: originCode,
    arrivalLocationId: destCode,
    departureTime: date.toISOString(),
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
    Accept: "application/json",
    "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Origin: "https://www.lefrecce.it",
    Referer: "https://www.lefrecce.it/",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`Trenitalia API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results: TrenitaliaResult[] = [];

    for (const sol of (data as any).solutions || []) {
      const train = sol.solution.trains?.[0];
      if (!train) continue;

      const prices: { class: string; price: number; availableSeats: number | null }[] = [];
      let totalAvailable = 0;

      // Helper to check if offer name indicates youth-only fare
      const isYouthFare = (name: string): boolean => {
        const lower = (name || "").toLowerCase();
        return lower.includes("young") || lower.includes("giovani") || lower.includes("youth");
      };

      for (const grid of sol.grids || []) {
        for (const service of (grid as any).services || []) {
          const offers = (service as any).offers || [];
          let cheapestOffer: any = null;
          let serviceAvailable = 0;

          for (const offer of offers) {
            const available = offer.availableAmount || 0;
            serviceAvailable += available;

            // Skip FrecciaYoung offers by checking offer name
            const offerName = offer.name || offer.serviceName || "";
            if (isYouthFare(offerName)) {
              continue;
            }

            if (
              offer.status === "SALEABLE" &&
              offer.price?.amount &&
              available > 0
            ) {
              if (
                !cheapestOffer ||
                offer.price.amount < cheapestOffer.price.amount
              ) {
                cheapestOffer = offer;
              }
            }
          }

          totalAvailable += serviceAvailable;

          // Skip FrecciaYoung and other youth-only services
          const serviceName = service.name || "Standard";
          if (isYouthFare(serviceName)) {
            continue;
          }

          if (cheapestOffer) {
            prices.push({
              class: serviceName,
              price: cheapestOffer.price.amount,
              availableSeats: cheapestOffer.availableAmount || null,
            });
          } else if (service.minPrice?.amount) {
            prices.push({
              class: serviceName,
              price: service.minPrice.amount,
              availableSeats: null,
            });
          }
        }
      }

      if (prices.length === 0 && sol.solution.price?.amount) {
        prices.push({
          class: "Standard",
          price: sol.solution.price.amount,
          availableSeats: null,
        });
      }

      if (prices.length > 0) {
        results.push({
          trainNumber: train.name || train.acronym || "N/A",
          trainType:
            train.denomination || train.trainCategory || train.acronym || "Trenitalia",
          departureTime: new Date(sol.solution.departureTime),
          arrivalTime: new Date(sol.solution.arrivalTime),
          duration: parseDuration(sol.solution.duration || "0min"),
          prices,
          totalAvailable: totalAvailable > 0 ? totalAvailable : null,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Trenitalia scraping error:", error);
    return [];
  }
}

// DST check
function isEuropeanSummerTime(date: Date): boolean {
  const year = date.getUTCFullYear();
  const march31 = new Date(Date.UTC(year, 2, 31));
  const dstStart = new Date(
    Date.UTC(year, 2, 31 - march31.getUTCDay(), 1, 0, 0)
  );
  const oct31 = new Date(Date.UTC(year, 9, 31));
  const dstEnd = new Date(Date.UTC(year, 9, 31 - oct31.getUTCDay(), 1, 0, 0));
  return date >= dstStart && date < dstEnd;
}

function isExactTimeMatch(departureTime: Date, isReturn: boolean): boolean {
  const utcHour = departureTime.getUTCHours();
  const minutes = departureTime.getUTCMinutes();
  const isSummer = isEuropeanSummerTime(departureTime);

  if (isReturn) {
    if (isSummer) {
      return (utcHour === 14 && minutes >= 55) || (utcHour === 15 && minutes <= 5);
    } else {
      return (utcHour === 15 && minutes >= 55) || (utcHour === 16 && minutes <= 5);
    }
  } else {
    if (isSummer) {
      return utcHour === 5 && minutes === 0;
    } else {
      return utcHour === 6 && minutes === 0;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Optional: Check for a simple API key
    const authHeader = request.headers.get("x-api-key");
    const expectedKey = process.env.SCRAPER_API_KEY;
    if (expectedKey && authHeader !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const daysToScrape = Math.min(body.days || 60, 120); // Default 60 days, max 120

    console.log(`Starting scrape for ${daysToScrape} days...`);

    // Get routes
    const outboundRoute = await db.route.findFirst({
      where: {
        origin: String(TRENITALIA_STATIONS.ROMA_TERMINI),
        destination: String(TRENITALIA_STATIONS.NAPOLI_CENTRALE),
        provider: "TRENITALIA",
        active: true,
      },
    });

    const returnRoute = await db.route.findFirst({
      where: {
        origin: String(TRENITALIA_STATIONS.NAPOLI_CENTRALE),
        destination: String(TRENITALIA_STATIONS.ROMA_TERMINI),
        provider: "TRENITALIA",
        active: true,
      },
    });

    if (!outboundRoute || !returnRoute) {
      return NextResponse.json(
        { error: "Routes not found in database" },
        { status: 500 }
      );
    }

    const today = new Date();
    const dates: Date[] = [];
    for (let i = 1; i <= daysToScrape; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }

    let savedOutbound = 0;
    let savedReturn = 0;
    let errors = 0;

    for (const date of dates) {
      const dateStr = date.toISOString().split("T")[0];

      try {
        // Delete old prices for this date before inserting new ones
        const startOfDay = new Date(dateStr);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(dateStr);
        endOfDay.setUTCHours(23, 59, 59, 999);

        await db.price.deleteMany({
          where: {
            routeId: { in: [outboundRoute.id, returnRoute.id] },
            departureAt: { gte: startOfDay, lte: endOfDay },
          },
        });

        // Scrape outbound (Roma -> Napoli)
        const outboundDate = new Date(date);
        outboundDate.setUTCHours(5, 0, 0, 0);

        const outboundResults = await scrapeTrenitalia(
          TRENITALIA_STATIONS.ROMA_TERMINI,
          TRENITALIA_STATIONS.NAPOLI_CENTRALE,
          outboundDate
        );

        for (const train of outboundResults) {
          if (isExactTimeMatch(train.departureTime, false)) {
            for (const price of train.prices) {
              await db.price.create({
                data: {
                  routeId: outboundRoute.id,
                  departureAt: train.departureTime,
                  trainNumber: train.trainNumber,
                  trainType: train.trainType,
                  price: price.price,
                  class: price.class,
                  duration: train.duration,
                  availableSeats: price.availableSeats,
                  totalAvailable: train.totalAvailable,
                },
              });
              savedOutbound++;
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Scrape return - two queries to cover both DST scenarios
        const returnDateSummer = new Date(date);
        returnDateSummer.setUTCHours(14, 30, 0, 0);
        const returnResultsSummer = await scrapeTrenitalia(
          TRENITALIA_STATIONS.NAPOLI_CENTRALE,
          TRENITALIA_STATIONS.ROMA_TERMINI,
          returnDateSummer
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const returnDateWinter = new Date(date);
        returnDateWinter.setUTCHours(15, 30, 0, 0);
        const returnResultsWinter = await scrapeTrenitalia(
          TRENITALIA_STATIONS.NAPOLI_CENTRALE,
          TRENITALIA_STATIONS.ROMA_TERMINI,
          returnDateWinter
        );

        // Deduplicate
        const seenTrains = new Set<string>();
        const allReturnResults = [...returnResultsSummer, ...returnResultsWinter].filter(
          (train) => {
            const key = `${train.trainNumber}-${train.departureTime.toISOString()}`;
            if (seenTrains.has(key)) return false;
            seenTrains.add(key);
            return true;
          }
        );

        for (const train of allReturnResults) {
          if (isExactTimeMatch(train.departureTime, true)) {
            for (const price of train.prices) {
              await db.price.create({
                data: {
                  routeId: returnRoute.id,
                  departureAt: train.departureTime,
                  trainNumber: train.trainNumber,
                  trainType: train.trainType,
                  price: price.price,
                  class: price.class,
                  duration: train.duration,
                  availableSeats: price.availableSeats,
                  totalAvailable: train.totalAvailable,
                },
              });
              savedReturn++;
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
        console.log(`Scraped ${dateStr}`);
      } catch (error) {
        console.error(`Error scraping ${dateStr}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Scrape completed`,
      stats: {
        daysScraped: daysToScrape,
        outboundPrices: savedOutbound,
        returnPrices: savedReturn,
        errors,
      },
    });
  } catch (error) {
    console.error("Scrape API error:", error);
    return NextResponse.json(
      { error: "Scrape failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to trigger a scrape",
    options: {
      days: "Number of days to scrape (default 60, max 120)",
    },
  });
}
