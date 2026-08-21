import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "cotapeca-v1",
      environment: process.env.APP_ENV ?? "unknown",
      e2eMode: process.env.NEXT_PUBLIC_E2E_MODE === "true",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
