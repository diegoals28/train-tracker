import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Roma Termini -> Napoli Centrale route IDs (Trenitalia)
const ROMA_NAPOLI_ROUTE_ORIGINS = ["830008409"];
const NAPOLI_ROMA_ROUTE_ORIGINS = ["830009218"];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Get Roma -> Napoli routes (for 07:00 departure)
    const romaToNapoliRoutes = await db.route.findMany({
      where: {
        origin: { in: ROMA_NAPOLI_ROUTE_ORIGINS },
        provider: "TRENITALIA",
        active: true,
      },
    });

    // Get Napoli -> Roma routes (for 17:00/17:05 return)
    const napoliToRomaRoutes = await db.route.findMany({
      where: {
        origin: { in: NAPOLI_ROMA_ROUTE_ORIGINS },
        provider: "TRENITALIA",
        active: true,
      },
    });

    const romaToNapoliIds = romaToNapoliRoutes.map((r) => r.id);
    const napoliToRomaIds = napoliToRomaRoutes.map((r) => r.id);

    // Get all prices for the date range
    const startDateTime = new Date(startDate);
    startDateTime.setHours(0, 0, 0, 0);

    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);

    // Get outbound prices (07:00 departure from Roma)
    const outboundPrices = await db.price.findMany({
      where: {
        routeId: { in: romaToNapoliIds },
        departureAt: {
          gte: startDateTime,
          lte: endDateTime,
        },
      },
      orderBy: { departureAt: "asc" },
    });

    // Get return prices (17:00-17:10 departure from Napoli)
    const returnPrices = await db.price.findMany({
      where: {
        routeId: { in: napoliToRomaIds },
        departureAt: {
          gte: startDateTime,
          lte: endDateTime,
        },
      },
      orderBy: { departureAt: "asc" },
    });

    // Process prices by date
    const calendarData: Record<string, {
      outbound: { price: number; trainNumber: string; departureTime: string; class: string } | null;
      return: { price: number; trainNumber: string; departureTime: string; class: string } | null;
    }> = {};

    // Process outbound (07:00 - 07:15 window)
    for (const price of outboundPrices) {
      const departure = new Date(price.departureAt);
      const hour = departure.getUTCHours();
      const minutes = departure.getUTCMinutes();

      // Only include trains departing between 06:45 and 07:15 (to account for 07:00, 07:05, etc.)
      if (hour === 6 && minutes >= 45 || hour === 7 && minutes <= 15) {
        const dateKey = departure.toISOString().split("T")[0];
        const priceNum = Number(price.price);

        if (!calendarData[dateKey]) {
          calendarData[dateKey] = { outbound: null, return: null };
        }

        if (!calendarData[dateKey].outbound || priceNum < calendarData[dateKey].outbound.price) {
          calendarData[dateKey].outbound = {
            price: priceNum,
            trainNumber: price.trainNumber,
            departureTime: departure.toISOString(),
            class: price.class,
          };
        }
      }
    }

    // Process return (17:00 - 17:15 window)
    for (const price of returnPrices) {
      const departure = new Date(price.departureAt);
      const hour = departure.getUTCHours();
      const minutes = departure.getUTCMinutes();

      // Only include trains departing between 16:45 and 17:15
      if (hour === 16 && minutes >= 45 || hour === 17 && minutes <= 15) {
        const dateKey = departure.toISOString().split("T")[0];
        const priceNum = Number(price.price);

        if (!calendarData[dateKey]) {
          calendarData[dateKey] = { outbound: null, return: null };
        }

        if (!calendarData[dateKey].return || priceNum < calendarData[dateKey].return.price) {
          calendarData[dateKey].return = {
            price: priceNum,
            trainNumber: price.trainNumber,
            departureTime: departure.toISOString(),
            class: price.class,
          };
        }
      }
    }

    return NextResponse.json({
      calendarData,
      routes: {
        outbound: romaToNapoliRoutes[0] || null,
        return: napoliToRomaRoutes[0] || null,
      },
    });
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar data", details: String(error) },
      { status: 500 }
    );
  }
}
