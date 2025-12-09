import cron from "node-cron";
import { PrismaClient, Provider } from "@prisma/client";

const db = new PrismaClient();
import {
  scrapeTrenitalia,
  TRENITALIA_STATIONS,
} from "./scrapers/trenitalia.js";
import { scrapeItalo, ITALO_STATIONS } from "./scrapers/italo.js";

// Initial routes to monitor
const INITIAL_ROUTES = [
  {
    origin: "ROMA_TERMINI",
    destination: "NAPOLI_CENTRALE",
    originName: "Roma Termini",
    destName: "Napoli Centrale",
  },
  {
    origin: "NAPOLI_CENTRALE",
    destination: "ROMA_TERMINI",
    originName: "Napoli Centrale",
    destName: "Roma Termini",
  },
];

async function ensureRoutesExist() {
  console.log("Ensuring routes exist in database...");

  for (const route of INITIAL_ROUTES) {
    // Create Trenitalia route (store numeric ID as string)
    await db.route.upsert({
      where: {
        origin_destination_provider: {
          origin: String(TRENITALIA_STATIONS[route.origin]),
          destination: String(TRENITALIA_STATIONS[route.destination]),
          provider: Provider.TRENITALIA,
        },
      },
      create: {
        origin: String(TRENITALIA_STATIONS[route.origin]),
        destination: String(TRENITALIA_STATIONS[route.destination]),
        originName: route.originName,
        destName: route.destName,
        provider: Provider.TRENITALIA,
      },
      update: {},
    });

    // Create Italo route
    await db.route.upsert({
      where: {
        origin_destination_provider: {
          origin: ITALO_STATIONS[route.origin],
          destination: ITALO_STATIONS[route.destination],
          provider: Provider.ITALO,
        },
      },
      create: {
        origin: ITALO_STATIONS[route.origin],
        destination: ITALO_STATIONS[route.destination],
        originName: route.originName,
        destName: route.destName,
        provider: Provider.ITALO,
      },
      update: {},
    });
  }

  console.log("Routes initialized");
}

async function scrapeAllRoutes() {
  console.log(`Starting scrape at ${new Date().toISOString()}`);

  const routes = await db.route.findMany({
    where: { active: true },
  });

  console.log(`Found ${routes.length} active routes to scrape`);

  // Scrape for the next 30 days
  const today = new Date();
  const dates: Date[] = [];
  for (let i = 1; i <= 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }

  for (const route of routes) {
    console.log(
      `Scraping ${route.originName} -> ${route.destName} (${route.provider})`
    );

    for (const date of dates) {
      try {
        let results;

        if (route.provider === Provider.TRENITALIA) {
          // Trenitalia uses numeric IDs
          results = await scrapeTrenitalia(parseInt(route.origin), parseInt(route.destination), date);
        } else {
          // Italo uses string codes
          results = await scrapeItalo(route.origin, route.destination, date);
        }

        // Save prices to database
        for (const train of results) {
          for (const price of train.prices) {
            await db.price.create({
              data: {
                routeId: route.id,
                departureAt: train.departureTime,
                trainNumber: train.trainNumber,
                trainType: train.trainType,
                price: price.price,
                class: price.class,
                duration: train.duration,
              },
            });
          }
        }

        // Add delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(
          `Error scraping ${route.provider} for date ${date.toISOString()}:`,
          error
        );
      }
    }
  }

  console.log(`Scrape completed at ${new Date().toISOString()}`);
}

async function main() {
  console.log("Train Price Tracker - Scraper starting...");

  // Initialize routes
  await ensureRoutesExist();

  // Run immediately on start
  const runOnStart = process.env.RUN_ON_START === "true";
  if (runOnStart) {
    await scrapeAllRoutes();
  }

  // Schedule daily scraping at 6:00 AM
  const cronSchedule = process.env.SCRAPE_CRON || "0 6 * * *";
  console.log(`Scheduling scraper with cron: ${cronSchedule}`);

  cron.schedule(cronSchedule, async () => {
    try {
      await scrapeAllRoutes();
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
