import { NextResponse } from "next/server";
import { dbGetBins } from "../../../lib/server-db";

export async function GET() {
  try {
    const bins = dbGetBins();
    return NextResponse.json(bins);
  } catch (error) {
    console.error("Error in Next.js GET /api/bins handler:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
