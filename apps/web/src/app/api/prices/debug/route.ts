import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date") || "2025-02-04";

  try {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const prices = await db.price.findMany({
      where: {
        departureAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { price: "asc" },
      take: 20,
    });

    // Get all unique class names
    const allClasses = await db.price.findMany({
      select: { class: true },
      distinct: ["class"],
    });

    return NextResponse.json({
      date,
      pricesForDate: prices.map((p) => ({
        class: p.class,
        price: Number(p.price),
        trainNumber: p.trainNumber,
        departureAt: p.departureAt,
      })),
      allUniqueClasses: allClasses.map((c) => c.class),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch", details: String(error) },
      { status: 500 }
    );
  }
}
