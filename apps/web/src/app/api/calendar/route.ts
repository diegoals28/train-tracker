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

    // Process prices by date - include availability info
    const calendarData: Record<string, {
      outbound: {
        price: number;
        trainNumber: string;
        departureTime: string;
        class: string;
        availableSeats: number | null;
        totalAvailable: number | null;
      } | null;
      return: {
        price: number;
        trainNumber: string;
        departureTime: string;
        class: string;
        availableSeats: number | null;
        totalAvailable: number | null;
      } | null;
    }> = {};

    // Check if a date is in European Summer Time (CEST)
    // DST starts last Sunday of March, ends last Sunday of October
    const isEuropeanSummerTime = (date: Date): boolean => {
      const year = date.getUTCFullYear();
      const march31 = new Date(Date.UTC(year, 2, 31));
      const dstStart = new Date(Date.UTC(year, 2, 31 - march31.getUTCDay(), 1, 0, 0));
      const oct31 = new Date(Date.UTC(year, 9, 31));
      const dstEnd = new Date(Date.UTC(year, 9, 31 - oct31.getUTCDay(), 1, 0, 0));
      return date >= dstStart && date < dstEnd;
    };

    // Check if departure matches the target times (DST-aware)
    // Outbound: 07:00 Italian = 06:00 UTC (winter) or 05:00 UTC (summer)
    // Return: 16:55-17:05 Italian = 15:55-16:05 UTC (winter) or 14:55-15:05 UTC (summer)
    const isExactOutboundTime = (departure: Date): boolean => {
      const hour = departure.getUTCHours();
      const minutes = departure.getUTCMinutes();
      const isSummer = isEuropeanSummerTime(departure);

      if (isSummer) {
        return hour === 5 && minutes === 0;
      } else {
        return hour === 6 && minutes === 0;
      }
    };

    const isExactReturnTime = (departure: Date): boolean => {
      const hour = departure.getUTCHours();
      const minutes = departure.getUTCMinutes();
      const isSummer = isEuropeanSummerTime(departure);

      if (isSummer) {
        // Summer (CEST): 16:55-17:05 Italian = 14:55-15:05 UTC
        return (hour === 14 && minutes >= 55) || (hour === 15 && minutes <= 5);
      } else {
        // Winter (CET): 16:55-17:05 Italian = 15:55-16:05 UTC
        return (hour === 15 && minutes >= 55) || (hour === 16 && minutes <= 5);
      }
    };

    // Process outbound (ONLY 07:00 Italian time = 06:00 UTC)
    for (const price of outboundPrices) {
      // Skip FrecciaYoung offers (youth-only fares)
      if (price.class.toLowerCase().includes("young")) {
        continue;
      }

      const departure = new Date(price.departureAt);

      if (isExactOutboundTime(departure)) {
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
            availableSeats: price.availableSeats,
            totalAvailable: price.totalAvailable,
          };
        }
      }
    }

    // Process return (ONLY 17:00 or 17:05 Italian time = 16:00 or 16:05 UTC)
    for (const price of returnPrices) {
      // Skip FrecciaYoung offers (youth-only fares)
      if (price.class.toLowerCase().includes("young")) {
        continue;
      }

      const departure = new Date(price.departureAt);

      if (isExactReturnTime(departure)) {
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
            availableSeats: price.availableSeats,
            totalAvailable: price.totalAvailable,
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
