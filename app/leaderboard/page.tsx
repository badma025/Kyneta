import { auth } from "@clerk/nextjs/server";

import { LeaderboardShell } from "@/components/leaderboard/leaderboard-shell";
import {
  type GCSESubject,
  SUPPORTED_GCSE_SUBJECTS,
} from "@/lib/gcse-subjects";
import { type SubjectLeaderboardEntry } from "@/lib/rating-types";
import {
  getGlobalLeaderboard,
  getSubjectLeaderboard,
} from "@/lib/rating-service";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const { userId } = await auth();
  const globalEntries = await getGlobalLeaderboard();
  const subjectLeaderboards = await Promise.all(
    SUPPORTED_GCSE_SUBJECTS.map(async (subject) => [
      subject,
      await getSubjectLeaderboard(subject),
    ] as const),
  );
  const subjectEntries = Object.fromEntries(subjectLeaderboards) as Record<
    GCSESubject,
    SubjectLeaderboardEntry[]
  >;

  return (
    <LeaderboardShell
      currentUserId={userId}
      globalEntries={globalEntries}
      subjectEntries={subjectEntries}
    />
  );
}
