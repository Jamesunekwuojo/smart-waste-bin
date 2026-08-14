import { NextRequest, NextResponse } from "next/server";
import { dbGetBinDetail } from "../../../../lib/server-db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ binId: string }> | { binId: string } }
) {
  try {
    const resolvedParams = await context.params;
    const binId = resolvedParams.binId;
    
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("window") || searchParams.get("range") || "24h") as "24h" | "7d" | "30d";

    const binDetail = dbGetBinDetail(binId, range);
    if (!binDetail) {
      return NextResponse.json({ error: `Bin ${binId} not found` }, { status: 404 });
    }

    return NextResponse.json(binDetail);
  } catch (error) {
    console.error(`Error in Next.js GET /api/bins/[binId] for ${context.params}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
