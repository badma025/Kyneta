import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  getReceivedProfileRatings,
  isMissingProfileRatingsTableError,
} from "@/lib/profile-received-ratings-service";

export const runtime = "nodejs";

function parsePage(value: string | null) {
  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parsePage(searchParams.get("page"));
    const result = await getReceivedProfileRatings(userId, page);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to load received profile ratings:", error);

    if (isMissingProfileRatingsTableError(error)) {
      return NextResponse.json(
        {
          error:
            "Profile ratings storage has not been deployed yet. Run `npx supabase db push` to apply the `profile_received_ratings` migration.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to load received profile ratings." },
      { status: 500 },
    );
  }
}
