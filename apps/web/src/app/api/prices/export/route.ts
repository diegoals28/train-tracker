import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Roma Termini -> Napoli Centrale route IDs (Trenitalia)
const ROMA_NAPOLI_ROUTE_ORIGINS = ["830008409"];
const NAPOLI_ROMA_ROUTE_ORIGINS = ["830009218"];

// Check if departure matches EXACTLY the target times
const isExactOutboundTime = (departure: Date): boolean => {
  const hour = departure.getUTCHours();
  const minutes = departure.getUTCMinutes();
  return hour === 6 && minutes === 0;
};

const isExactReturnTime = (departure: Date): boolean => {
  const hour = departure.getUTCHours();
  const minutes = departure.getUTCMinutes();
  return hour === 16 && (minutes === 0 || minutes === 5);
};

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

    // Get routes
    const romaToNapoliRoutes = await db.route.findMany({
      where: {
        origin: { in: ROMA_NAPOLI_ROUTE_ORIGINS },
        provider: "TRENITALIA",
        active: true,
      },
    });

    const napoliToRomaRoutes = await db.route.findMany({
      where: {
        origin: { in: NAPOLI_ROMA_ROUTE_ORIGINS },
        provider: "TRENITALIA",
        active: true,
      },
    });

    const romaToNapoliIds = romaToNapoliRoutes.map((r) => r.id);
    const napoliToRomaIds = napoliToRomaRoutes.map((r) => r.id);

    const startDateTime = new Date(startDate);
    startDateTime.setHours(0, 0, 0, 0);

    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);

    // Get all prices for the date range, grouped by scrape session
    const allPrices = await db.price.findMany({
      where: {
        routeId: { in: [...romaToNapoliIds, ...napoliToRomaIds] },
        departureAt: {
          gte: startDateTime,
          lte: endDateTime,
        },
      },
      orderBy: [{ departureAt: "asc" }, { scrapedAt: "asc" }],
    });

    // Process and filter to exact times only
    const historyData: Array<{
      departureDate: string;
      scrapedAt: string;
      direction: string;
      trainNumber: string;
      trainType: string;
      class: string;
      price: number;
      availableSeats: number | null;
      totalAvailable: number | null;
    }> = [];

    for (const price of allPrices) {
      const departure = new Date(price.departureAt);
      const isOutbound = romaToNapoliIds.includes(price.routeId);
      const isReturn = napoliToRomaIds.includes(price.routeId);

      // Filter to exact times only
      if (isOutbound && !isExactOutboundTime(departure)) continue;
      if (isReturn && !isExactReturnTime(departure)) continue;

      historyData.push({
        departureDate: departure.toISOString().split("T")[0],
        scrapedAt: price.scrapedAt.toISOString(),
        direction: isOutbound ? "Roma → Napoli (07:00)" : "Napoli → Roma (17:00)",
        trainNumber: price.trainNumber,
        trainType: price.trainType,
        class: price.class,
        price: Number(price.price),
        availableSeats: price.availableSeats,
        totalAvailable: price.totalAvailable,
      });
    }

    return NextResponse.json({
      data: historyData,
      count: historyData.length,
    });
  } catch (error) {
    console.error("Error exporting price history:", error);
    return NextResponse.json(
      { error: "Failed to export price history", details: String(error) },
      { status: 500 }
    );
  }
}
