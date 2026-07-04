import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getPublicDisplayName } from "@/lib/clerk-user";
import { normalizeGCSESubject } from "@/lib/gcse-subjects";
import { recordQuestionResult } from "@/lib/rating-service";

export const runtime = "nodejs";

type RatingResultRequestBody = {
  subject?: string;
  queueId?: string;
  submittedAnswer?: string | null;
  correctAnswer?: string | null;
  isCorrect?: boolean;
};

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as RatingResultRequestBody;
    const subject = normalizeGCSESubject(body.subject);
    const queueId = body.queueId?.trim();
    const isCorrect = body.isCorrect;

    if (!queueId || typeof isCorrect !== "boolean") {
      return NextResponse.json(
        { error: "A subject, queueId, and boolean result are required." },
        { status: 400 },
      );
    }

    const user = await currentUser();
    const displayName = getPublicDisplayName(userId, user);
    const result = await recordQuestionResult({
      clerkUserId: userId,
      displayName,
      subject,
      queueId,
      isCorrect,
      submittedAnswer: body.submittedAnswer ?? null,
      correctAnswer: body.correctAnswer ?? null,
    });

    return NextResponse.json({
      subject: result.updated.subject,
      rating: result.updated.rating,
      ratingDeviation: result.updated.ratingDeviation,
      volatility: result.updated.volatility,
      matchesPlayed: result.updated.matchesPlayed,
      ratingDelta: result.ratingDelta,
    });
  } catch (error) {
    console.error("Failed to record rating result:", error);

    return NextResponse.json(
      { error: "Failed to persist the rating result." },
      { status: 500 },
    );
  }
}
