import { NextRequest, NextResponse } from "next/server";
import { dbAddWasteEvent } from "../../../lib/server-db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bin_id, fill_percent, weight_kg, height_cm, sensor_fault } = body;

    if (!bin_id || fill_percent === undefined || weight_kg === undefined || height_cm === undefined) {
      return NextResponse.json(
        { error: "Validation failed", details: "Missing required fields (bin_id, fill_percent, weight_kg, height_cm)" },
        { status: 400 }
      );
    }

    const result = dbAddWasteEvent(
      bin_id,
      Number(fill_percent),
      Number(weight_kg),
      Number(height_cm),
      Boolean(sensor_fault)
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error in Next.js POST /api/waste handler:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
