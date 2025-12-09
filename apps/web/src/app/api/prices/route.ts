import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const routeId = searchParams.get("routeId");
    const days = parseInt(searchParams.get("days") || "30");
    const trainClass = searchParams.get("class");

    if (!routeId) {
      return NextResponse.json(
        { error: "routeId is required" },
        { status: 400 }
      );
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const prices = await db.price.findMany({
      where: {
        routeId,
        scrapedAt: { gte: startDate },
        ...(trainClass ? { class: trainClass } : {}),
      },
      orderBy: [{ departureAt: "asc" }, { scrapedAt: "desc" }],
      include: {
        route: true,
      },
    });

    return NextResponse.json(prices);
  } catch (error) {
    console.error("Error fetching prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch prices" },
      { status: 500 }
    );
  }
}
