import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Delete all age-restricted prices from the database (YOUNG/SENIOR fares)
export async function POST() {
  try {
    const result = await db.price.deleteMany({
      where: {
        OR: [
          { class: { contains: "young", mode: "insensitive" } },
          { class: { contains: "giovani", mode: "insensitive" } },
          { class: { contains: "youth", mode: "insensitive" } },
          { class: { contains: "senior", mode: "insensitive" } },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Eliminados ${result.count} precios de tarifas restringidas`,
    });
  } catch (error) {
    console.error("Error cleaning up age-restricted fares:", error);
    return NextResponse.json(
      { error: "Failed to cleanup", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const count = await db.price.count({
      where: {
        OR: [
          { class: { contains: "young", mode: "insensitive" } },
          { class: { contains: "giovani", mode: "insensitive" } },
          { class: { contains: "youth", mode: "insensitive" } },
          { class: { contains: "senior", mode: "insensitive" } },
        ],
      },
    });

    return NextResponse.json({
      ageRestrictedFaresCount: count,
      message: `Hay ${count} precios de tarifas restringidas en la base de datos`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to count", details: String(error) },
      { status: 500 }
    );
  }
}
