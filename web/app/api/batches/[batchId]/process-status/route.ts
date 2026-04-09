import { NextResponse } from "next/server";

import { getBatchProcessStatus } from "@/lib/batch-process-state";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId: raw } = await params;
  const batchId = decodeURIComponent(raw).trim();
  if (!batchId) {
    return NextResponse.json({ found: false }, { status: 400 });
  }

  const status = getBatchProcessStatus(batchId);
  if (!status) {
    return NextResponse.json({ found: false, batchId }, { status: 404 });
  }

  return NextResponse.json({ found: true, ...status });
}
