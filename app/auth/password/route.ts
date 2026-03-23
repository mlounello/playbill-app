import { NextResponse } from "next/server";
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(
    new URL("/login?error=Password+and+email-based+public+login+are+disabled.+Use+Google+for+staff+access.", origin),
    { status: 303 }
  );
}
