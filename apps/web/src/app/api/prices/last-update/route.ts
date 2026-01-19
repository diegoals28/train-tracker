import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get the most recent scraping timestamp
    const lastPrice = await db.price.findFirst({
      orderBy: { scrapedAt: "desc" },
      select: { scrapedAt: true },
    });

    return NextResponse.json({
      lastUpdate: lastPrice?.scrapedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Error fetching last update:", error);
    return NextResponse.json({ lastUpdate: null });
  }
}
