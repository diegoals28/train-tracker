import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date") || "2026-02-04";
  const direction = searchParams.get("direction") || "outbound"; // outbound or return

  const url = "https://www.lefrecce.it/Channels.Website.BFF.WEB/website/ticket/solutions";

  const departureTime = new Date(date);

  let originId: number;
  let destId: number;

  if (direction === "return") {
    // Napoli -> Roma, search from 16:00 Italian = 15:00 UTC in winter
    departureTime.setUTCHours(15, 0, 0, 0);
    originId = 830009218; // Napoli
    destId = 830008409; // Roma
  } else {
    // Roma -> Napoli, 07:00 Italian = 06:00 UTC in winter
    departureTime.setUTCHours(5, 30, 0, 0);
    originId = 830008409; // Roma
    destId = 830009218; // Napoli
  }

  const body = {
    departureLocationId: originId,
    arrivalLocationId: destId,
    departureTime: departureTime.toISOString(),
    adults: 1,
    children: 0,
    criteria: {
      frecceOnly: false,
      regionalOnly: false,
      noChanges: false,
      order: "DEPARTURE_DATE",
      limit: 30,
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

    // Find the target train based on direction
    const targetSolution = data.solutions?.find((sol: any) => {
      const depTime = new Date(sol.solution.departureTime);
      const hour = depTime.getUTCHours();
      const min = depTime.getUTCMinutes();
      if (direction === "return") {
        // 17:00 Italian = 16:00 UTC in winter
        return hour === 16 && min === 0;
      } else {
        // 07:00 Italian = 06:00 UTC in winter
        return hour === 6 && min === 0;
      }
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

    // List all available departure times
    const allDepartures = (data.solutions || []).map((sol: any) => ({
      trainNumber: sol.solution?.trains?.[0]?.name,
      departureTime: sol.solution?.departureTime,
      utcHour: new Date(sol.solution?.departureTime).getUTCHours(),
      utcMin: new Date(sol.solution?.departureTime).getUTCMinutes(),
    }));

    return NextResponse.json({
      date,
      direction,
      foundTargetTrain: !!targetSolution,
      trainNumber: solutionToUse?.solution?.trains?.[0]?.name,
      departureTime: solutionToUse?.solution?.departureTime,
      services: offerInfo,
      allDepartures,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch", details: String(error) },
      { status: 500 }
    );
  }
}
