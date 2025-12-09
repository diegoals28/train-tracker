import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const routeId = searchParams.get("routeId");
    const departureDate = searchParams.get("departureDate"); // YYYY-MM-DD

    if (!routeId || !departureDate) {
      return NextResponse.json(
        { error: "routeId and departureDate are required" },
        { status: 400 }
      );
    }

    // Get start and end of the departure date
    const startOfDay = new Date(departureDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(departureDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all price records for trains departing on this date
    const prices = await db.price.findMany({
      where: {
        routeId,
        departureAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: [{ scrapedAt: "asc" }],
      include: {
        route: true,
      },
    });

    // Group by train number and class, show price evolution
    const priceHistory = prices.reduce(
      (acc, price) => {
        const key = `${price.trainNumber}-${price.class}`;
        if (!acc[key]) {
          acc[key] = {
            trainNumber: price.trainNumber,
            trainType: price.trainType,
            class: price.class,
            departureAt: price.departureAt,
            history: [],
          };
        }
        acc[key].history.push({
          price: Number(price.price),
          scrapedAt: price.scrapedAt,
        });
        return acc;
      },
      {} as Record<
        string,
        {
          trainNumber: string;
          trainType: string;
          class: string;
          departureAt: Date;
          history: { price: number; scrapedAt: Date }[];
        }
      >
    );

    return NextResponse.json(Object.values(priceHistory));
  } catch (error) {
    console.error("Error fetching price history:", error);
    return NextResponse.json(
      { error: "Failed to fetch price history" },
      { status: 500 }
    );
  }
}
