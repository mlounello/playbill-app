import { NextResponse } from "next/server";
import { getContributorContinueRedirect } from "@/lib/reminders";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ showId: string; taskId: string }> }
) {
  const { showId, taskId } = await params;
  const { redirectTo } = await getContributorContinueRedirect(showId, taskId);
  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
}
