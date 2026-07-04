import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getPublicDisplayName } from "@/lib/clerk-user";
import { normalizeGCSESubject } from "@/lib/gcse-subjects";
import { getUserSubjectRating } from "@/lib/rating-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const subject = normalizeGCSESubject(searchParams.get("subject"));
    const user = await currentUser();
    const displayName = getPublicDisplayName(userId, user);
    const rating = await getUserSubjectRating(userId, displayName, subject);

    return NextResponse.json({
      subject: rating.subject,
      rating: rating.rating,
      ratingDeviation: rating.ratingDeviation,
      volatility: rating.volatility,
      matchesPlayed: rating.matchesPlayed,
    });
  } catch (error) {
    console.error("Failed to load subject rating:", error);

    return NextResponse.json(
      { error: "Failed to load the subject rating." },
      { status: 500 },
    );
  }
}
