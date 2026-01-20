import cron from "node-cron";
import { PrismaClient, Provider } from "@prisma/client";

const db = new PrismaClient();
import {
  scrapeTrenitalia,
  TRENITALIA_STATIONS,
} from "./scrapers/trenitalia.js";

// Specific schedule configuration
const SCHEDULE_CONFIG = {
  // Roma -> Napoli: departure at 07:00
  outbound: {
    origin: "ROMA_TERMINI",
    destination: "NAPOLI_CENTRALE",
    originName: "Roma Termini",
    destName: "Napoli Centrale",
    departureHour: 7, // 07:00
  },
  // Napoli -> Roma: departure at 17:00
  return: {
    origin: "NAPOLI_CENTRALE",
    destination: "ROMA_TERMINI",
    originName: "Napoli Centrale",
    destName: "Roma Termini",
    departureHour: 17, // 17:00
  },
};

async function ensureRoutesExist() {
  console.log("Ensuring routes exist in database...");

  // Create outbound route (Roma -> Napoli)
  await db.route.upsert({
    where: {
      origin_destination_provider: {
        origin: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.outbound.origin]),
        destination: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.outbound.destination]),
        provider: Provider.TRENITALIA,
      },
    },
    create: {
      origin: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.outbound.origin]),
      destination: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.outbound.destination]),
      originName: SCHEDULE_CONFIG.outbound.originName,
      destName: SCHEDULE_CONFIG.outbound.destName,
      provider: Provider.TRENITALIA,
    },
    update: {},
  });

  // Create return route (Napoli -> Roma)
  await db.route.upsert({
    where: {
      origin_destination_provider: {
        origin: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.origin]),
        destination: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.destination]),
        provider: Provider.TRENITALIA,
      },
    },
    create: {
      origin: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.origin]),
      destination: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.destination]),
      originName: SCHEDULE_CONFIG.return.originName,
      destName: SCHEDULE_CONFIG.return.destName,
      provider: Provider.TRENITALIA,
    },
    update: {},
  });

  console.log("Routes initialized");
}

// Check if a date is in European Summer Time (CEST)
// DST starts last Sunday of March at 02:00 local time
// DST ends last Sunday of October at 03:00 local time
function isEuropeanSummerTime(date: Date): boolean {
  const year = date.getUTCFullYear();

  // Find last Sunday of March
  const march31 = new Date(Date.UTC(year, 2, 31));
  const dstStart = new Date(Date.UTC(year, 2, 31 - march31.getUTCDay(), 1, 0, 0)); // 01:00 UTC = 02:00 CET

  // Find last Sunday of October
  const oct31 = new Date(Date.UTC(year, 9, 31));
  const dstEnd = new Date(Date.UTC(year, 9, 31 - oct31.getUTCDay(), 1, 0, 0)); // 01:00 UTC = 02:00 CEST = 03:00 CET

  return date >= dstStart && date < dstEnd;
}

// Check if a train departure time matches the target schedule
// Trenitalia returns times in Italian timezone
// CET (winter) = UTC+1, CEST (summer) = UTC+2
// For outbound: 07:00 Italian = 06:00 UTC (winter) or 05:00 UTC (summer)
// For return: 16:55, 17:00, 17:05 Italian = 15:55, 16:00, 16:05 UTC (winter) or 14:55, 15:00, 15:05 UTC (summer)
function isExactTimeMatch(departureTime: Date, isReturn: boolean): boolean {
  const utcHour = departureTime.getUTCHours();
  const minutes = departureTime.getUTCMinutes();
  const isSummer = isEuropeanSummerTime(departureTime);

  if (isReturn) {
    // Return: ONLY 16:55, 17:00, 17:05 Italian time (exact matches)
    if (isSummer) {
      // Summer (CEST): 14:55, 15:00, 15:05 UTC exactly
      return (utcHour === 14 && minutes === 55) ||
             (utcHour === 15 && (minutes === 0 || minutes === 5));
    } else {
      // Winter (CET): 15:55, 16:00, 16:05 UTC exactly
      return (utcHour === 15 && minutes === 55) ||
             (utcHour === 16 && (minutes === 0 || minutes === 5));
    }
  } else {
    // Outbound: 07:00 Italian time
    if (isSummer) {
      // Summer (CEST): 05:00 UTC
      return utcHour === 5 && minutes === 0;
    } else {
      // Winter (CET): 06:00 UTC
      return utcHour === 6 && minutes === 0;
    }
  }
}

async function scrapeSpecificSchedules() {
  console.log(`Starting scheduled scrape at ${new Date().toISOString()}`);
  console.log("Target schedules:");
  console.log("  - Outbound (Roma -> Napoli): 07:00");
  console.log("  - Return (Napoli -> Roma): 16:55, 17:00, 17:05");

  // Get routes from database
  const outboundRoute = await db.route.findFirst({
    where: {
      origin: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.outbound.origin]),
      destination: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.outbound.destination]),
      provider: Provider.TRENITALIA,
      active: true,
    },
  });

  const returnRoute = await db.route.findFirst({
    where: {
      origin: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.origin]),
      destination: String(TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.destination]),
      provider: Provider.TRENITALIA,
      active: true,
    },
  });

  if (!outboundRoute || !returnRoute) {
    console.error("Routes not found in database!");
    return;
  }

  // Scrape for the next 120 days
  const today = new Date();
  const dates: Date[] = [];
  for (let i = 1; i <= 120; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }

  let savedOutbound = 0;
  let savedReturn = 0;

  for (const date of dates) {
    const dateStr = date.toISOString().split("T")[0];

    try {
      // Scrape OUTBOUND (Roma -> Napoli) starting at 05:00 UTC
      // This captures 07:00 Italian in both winter (06:00 UTC) and summer (05:00 UTC)
      console.log(`\nScraping outbound for ${dateStr}...`);
      const outboundDate = new Date(date);
      outboundDate.setUTCHours(5, 0, 0, 0);

      const outboundResults = await scrapeTrenitalia(
        TRENITALIA_STATIONS[SCHEDULE_CONFIG.outbound.origin],
        TRENITALIA_STATIONS[SCHEDULE_CONFIG.outbound.destination],
        outboundDate
      );

      // Filter and save ONLY trains at exactly 07:00 (06:00 UTC)
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
          console.log(`  Saved: ${train.trainNumber} at ${train.departureTime.toISOString()} (seats: ${train.totalAvailable ?? 'N/A'})`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Scrape RETURN (Napoli -> Roma) - make TWO queries to cover both seasons
      // Summer (CEST): 16:55-17:05 Italian = 14:55-15:05 UTC - query at 14:30 UTC
      // Winter (CET): 16:55-17:05 Italian = 15:55-16:05 UTC - query at 15:30 UTC
      console.log(`Scraping return for ${dateStr}...`);

      // Query 1: For summer time (14:30 UTC to catch 14:55-15:05 UTC)
      const returnDateSummer = new Date(date);
      returnDateSummer.setUTCHours(14, 30, 0, 0);

      const returnResultsSummer = await scrapeTrenitalia(
        TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.origin],
        TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.destination],
        returnDateSummer
      );

      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Query 2: For winter time (15:30 UTC to catch 15:55-16:05 UTC)
      const returnDateWinter = new Date(date);
      returnDateWinter.setUTCHours(15, 30, 0, 0);

      const returnResultsWinter = await scrapeTrenitalia(
        TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.origin],
        TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.destination],
        returnDateWinter
      );

      // Combine results and deduplicate by train number + departure time
      const seenTrains = new Set<string>();
      const allReturnResults = [...returnResultsSummer, ...returnResultsWinter].filter(train => {
        const key = `${train.trainNumber}-${train.departureTime.toISOString()}`;
        if (seenTrains.has(key)) return false;
        seenTrains.add(key);
        return true;
      });

      // Filter and save ONLY trains at 16:55-17:05 Italian time
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
          console.log(`  Saved: ${train.trainNumber} at ${train.departureTime.toISOString()} (seats: ${train.totalAvailable ?? 'N/A'})`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error scraping for date ${dateStr}:`, error);
    }
  }

  console.log(`\nScrape completed at ${new Date().toISOString()}`);
  console.log(`Saved ${savedOutbound} outbound prices (07:00)`);
  console.log(`Saved ${savedReturn} return prices (17:00)`);
}

async function main() {
  console.log("Train Price Tracker - Scraper starting...");
  console.log("Focused on Roma <-> Napoli schedules:");
  console.log("  - Ida: 07:00 (Roma Termini -> Napoli Centrale)");
  console.log("  - Vuelta: 17:00 (Napoli Centrale -> Roma Termini)");

  // Initialize routes
  await ensureRoutesExist();

  // Run immediately on start
  const runOnStart = process.env.RUN_ON_START === "true";
  if (runOnStart) {
    await scrapeSpecificSchedules();
  }

  // Schedule daily scraping at 6:00 AM
  const cronSchedule = process.env.SCRAPE_CRON || "0 6 * * *";
  console.log(`Scheduling scraper with cron: ${cronSchedule}`);

  cron.schedule(cronSchedule, async () => {
    try {
      await scrapeSpecificSchedules();
    } catch (error) {
      console.error("Scheduled scrape failed:", error);
    }
  });

  console.log("Scraper is running. Waiting for scheduled execution...");

  // Keep the process alive
  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await db.$disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
