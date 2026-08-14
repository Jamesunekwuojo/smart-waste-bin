import { NextRequest, NextResponse } from "next/server";
import { dbSubmitFeedback } from "../../../lib/server-db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bin_id, corrected_class } = body;

    if (!bin_id || !corrected_class) {
      return NextResponse.json(
        { success: false, message: "Missing bin_id or corrected_class in request body" },
        { status: 400 }
      );
    }

    dbSubmitFeedback({ bin_id, corrected_class });

    return NextResponse.json({
      success: true,
      message: `Feedback correction submitted for ${bin_id}: Corrected to ${corrected_class}`,
    });
  } catch (error) {
    console.error("Error in Next.js POST /api/feedback handler:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
