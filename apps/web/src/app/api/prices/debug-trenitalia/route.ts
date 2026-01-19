import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date") || "2026-02-04";

  const url = "https://www.lefrecce.it/Channels.Website.BFF.WEB/website/ticket/solutions";

  // Roma Termini -> Napoli Centrale, 07:00 Italian = 06:00 UTC in winter
  const departureTime = new Date(date);
  departureTime.setUTCHours(5, 30, 0, 0); // Search a bit earlier to find 07:00 train

  const body = {
    departureLocationId: 830008409,
    arrivalLocationId: 830009218,
    departureTime: departureTime.toISOString(),
    adults: 1,
    children: 0,
    criteria: {
      frecceOnly: false,
      regionalOnly: false,
      noChanges: false,
      order: "DEPARTURE_DATE",
      limit: 5,
      offset: 0,
    },
    advancedSearchRequest: {
      bestFare: false,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Find the 07:00 train (06:00 UTC in winter)
    const targetSolution = data.solutions?.find((sol: any) => {
      const depTime = new Date(sol.solution.departureTime);
      const hour = depTime.getUTCHours();
      const min = depTime.getUTCMinutes();
      return hour === 6 && min === 0; // 07:00 Italian = 06:00 UTC in winter
    });

    const solutionToUse = targetSolution || data.solutions?.[0];
    const offerInfo: any[] = [];

    if (solutionToUse) {
      for (const grid of solutionToUse.grids || []) {
        for (const service of grid.services || []) {
          const serviceData = {
            serviceName: service.name,
            offers: (service.offers || []).map((o: any) => ({
              name: o.name,
              serviceName: o.serviceName,
              price: o.price?.amount,
              status: o.status,
              available: o.availableAmount,
            })),
          };
          offerInfo.push(serviceData);
        }
      }
    }

    return NextResponse.json({
      date,
      found07Train: !!targetSolution,
      trainNumber: solutionToUse?.solution?.trains?.[0]?.name,
      departureTime: solutionToUse?.solution?.departureTime,
      services: offerInfo,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch", details: String(error) },
      { status: 500 }
    );
  }
}
