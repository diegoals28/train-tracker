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

// Check if a train departure time is within the target window
// Trenitalia returns times in Italian timezone (CET = UTC+1 in winter, CEST = UTC+2 in summer)
// We use UTC hours and adjust for Italian time
function isInTimeWindow(departureTime: Date, targetHour: number): boolean {
  // Get UTC hours and add 1 for CET (Italian winter time)
  // In summer it would be +2 for CEST, but for simplicity we use +1
  const utcHour = departureTime.getUTCHours();
  const italianHour = (utcHour + 1) % 24; // Convert UTC to Italian time (CET)
  const minutes = departureTime.getUTCMinutes();

  // Wider window: accept trains departing within 30 minutes of target hour
  // e.g., for targetHour=7: accept 06:30 - 07:30 Italian time
  // e.g., for targetHour=17: accept 16:30 - 17:30 Italian time
  if (italianHour === targetHour - 1 && minutes >= 30) return true;
  if (italianHour === targetHour && minutes <= 30) return true;

  return false;
}

async function scrapeSpecificSchedules() {
  console.log(`Starting scheduled scrape at ${new Date().toISOString()}`);
  console.log("Target schedules:");
  console.log("  - Outbound (Roma -> Napoli): ~07:00");
  console.log("  - Return (Napoli -> Roma): ~17:00");

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

  // Scrape for the next 30 days
  const today = new Date();
  const dates: Date[] = [];
  for (let i = 1; i <= 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }

  let savedOutbound = 0;
  let savedReturn = 0;

  for (const date of dates) {
    const dateStr = date.toISOString().split("T")[0];

    try {
      // Scrape OUTBOUND (Roma -> Napoli) starting at 06:00
      console.log(`\nScraping outbound for ${dateStr}...`);
      const outboundDate = new Date(date);
      outboundDate.setHours(6, 0, 0, 0); // Start search at 06:00

      const outboundResults = await scrapeTrenitalia(
        TRENITALIA_STATIONS[SCHEDULE_CONFIG.outbound.origin],
        TRENITALIA_STATIONS[SCHEDULE_CONFIG.outbound.destination],
        outboundDate
      );

      // Filter and save only trains around 07:00
      for (const train of outboundResults) {
        if (isInTimeWindow(train.departureTime, SCHEDULE_CONFIG.outbound.departureHour)) {
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
              },
            });
            savedOutbound++;
          }
          console.log(`  Saved: ${train.trainNumber} at ${train.departureTime.toISOString()}`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Scrape RETURN (Napoli -> Roma) starting at 16:00
      console.log(`Scraping return for ${dateStr}...`);
      const returnDate = new Date(date);
      returnDate.setHours(16, 0, 0, 0); // Start search at 16:00

      const returnResults = await scrapeTrenitalia(
        TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.origin],
        TRENITALIA_STATIONS[SCHEDULE_CONFIG.return.destination],
        returnDate
      );

      // Filter and save only trains around 17:00
      for (const train of returnResults) {
        if (isInTimeWindow(train.departureTime, SCHEDULE_CONFIG.return.departureHour)) {
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
              },
            });
            savedReturn++;
          }
          console.log(`  Saved: ${train.trainNumber} at ${train.departureTime.toISOString()}`);
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
