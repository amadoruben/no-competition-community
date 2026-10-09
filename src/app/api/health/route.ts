import { NextResponse } from "next/server";
import { healthReport } from "@/server/health";

export const dynamic = "force-dynamic";

/** Liveness + readiness for load balancers, uptime monitors and container health checks. */
export async function GET() {
  const report = await healthReport();
  return NextResponse.json(report, { status: report.status === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
}
