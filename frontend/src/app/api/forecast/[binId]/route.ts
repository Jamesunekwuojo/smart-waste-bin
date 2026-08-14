import { NextRequest, NextResponse } from "next/server";
import { dbGetForecast } from "../../../../lib/server-db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ binId: string }> | { binId: string } }
) {
  try {
    const resolvedParams = await context.params;
    const binId = resolvedParams.binId;

    const forecast = dbGetForecast(binId);
    if (!forecast) {
      return NextResponse.json({ error: `Forecast for bin ${binId} not found` }, { status: 404 });
    }

    return NextResponse.json(forecast);
  } catch (error) {
    console.error("Error in Next.js GET /api/forecast/[binId] handler:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
