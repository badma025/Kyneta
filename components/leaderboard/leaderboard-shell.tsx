"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  type GlobalLeaderboardEntry,
  type SubjectLeaderboardEntry,
} from "@/lib/rating-types";
import {
  type GCSESubject,
  getGCSESubjectConfig,
  SUPPORTED_GCSE_SUBJECTS,
} from "@/lib/gcse-subjects";
import { cn } from "@/lib/utils";

type LeaderboardScope = "global" | GCSESubject;

type LeaderboardShellProps = {
  currentUserId: string | null;
  globalEntries: GlobalLeaderboardEntry[];
  subjectEntries: Record<GCSESubject, SubjectLeaderboardEntry[]>;
};

function formatLeaderboardRating(value: number) {
  return Math.round(value);
}

export function LeaderboardShell({
  currentUserId,
  globalEntries,
  subjectEntries,
}: LeaderboardShellProps) {
  const [activeScope, setActiveScope] = useState<LeaderboardScope>("global");

  const activeRows = useMemo(() => {
    if (activeScope === "global") {
      return globalEntries;
    }

    return subjectEntries[activeScope];
  }, [activeScope, globalEntries, subjectEntries]);

  return (
    <main className="min-h-[calc(100vh-2.5rem)] bg-[#050505] font-sans text-[#E0E6E3]">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-8 sm:px-6 sm:py-10">
        <section className="border border-[#222]">
          <div className="border-b border-[#222] px-4 py-5 sm:px-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7A8A82]">
              Ranking Matrix
            </div>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="font-mono text-3xl uppercase tracking-[0.14em] text-white sm:text-4xl">
                  KYNETA LEADERBOARD
                </h1>
                <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#7A8A82]">
                  GLOBAL RANKING USES THE FOUR-SUBJECT AVERAGE. SUBJECT TABS STAY
                  FULLY ISOLATED TO THEIR OWN GLICKO-2 POOL.
                </p>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7A8A82]">
                LIVE SUBJECT POOLS // MATHS // BIOLOGY // CHEMISTRY // PHYSICS
              </div>
            </div>
          </div>

          <div className="border-b border-[#222] px-4 py-4 sm:px-6">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setActiveScope("global")}
                className={cn(
                  "min-w-40 font-mono",
                  activeScope === "global"
                    ? "border-[#3CD070] bg-[#3CD070] text-[#050505]"
                    : "border-[#232B27] bg-transparent text-[#E0E6E3] hover:border-[#3CD070] hover:bg-transparent hover:text-[#3CD070]",
                )}
              >
                Global
              </Button>
              {SUPPORTED_GCSE_SUBJECTS.map((subject) => (
                <Button
                  key={subject}
                  type="button"
                  onClick={() => setActiveScope(subject)}
                  className={cn(
                    "min-w-40 font-mono",
                    activeScope === subject
                      ? "border-[#3CD070] bg-[#3CD070] text-[#050505]"
                      : "border-[#232B27] bg-transparent text-[#E0E6E3] hover:border-[#3CD070] hover:bg-transparent hover:text-[#3CD070]",
                  )}
                >
                  {getGCSESubjectConfig(subject).label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid border-b border-[#222] md:grid-cols-3">
            <section className="border-b border-[#222] px-4 py-5 md:border-b-0 md:border-r sm:px-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7A8A82]">
                [ ACTIVE VIEW ]
              </div>
              <div className="mt-5 font-mono text-2xl uppercase tracking-[0.14em] text-white">
                {activeScope === "global"
                  ? "GLOBAL"
                  : getGCSESubjectConfig(activeScope).label}
              </div>
            </section>
            <section className="border-b border-[#222] px-4 py-5 md:border-b-0 md:border-r sm:px-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7A8A82]">
                [ ROW COUNT ]
              </div>
              <div className="mt-5 font-mono text-2xl uppercase tracking-[0.14em] text-[#3CD070]">
                {activeRows.length}
              </div>
            </section>
            <section className="px-4 py-5 sm:px-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7A8A82]">
                [ SORT ]
              </div>
              <div className="mt-5 text-[15px] leading-7 text-white">
                DESCENDING BY {activeScope === "global" ? "AVERAGE RATING" : "SUBJECT RATING"}
              </div>
            </section>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#222] bg-[#090909] font-mono text-left text-[11px] uppercase tracking-[0.2em] text-[#7A8A82]">
                  <th className="px-4 py-3 sm:px-6">Rank</th>
                  <th className="px-4 py-3 sm:px-6">User</th>
                  <th className="px-4 py-3 sm:px-6">
                    {activeScope === "global" ? "Average Rating" : "Subject Rating"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 font-mono text-sm uppercase tracking-[0.18em] text-[#7A8A82] sm:px-6"
                    >
                      NO ENTRIES YET.
                    </td>
                  </tr>
                ) : activeScope === "global" ? (
                  globalEntries.map((entry) => {
                    const isCurrentUser = entry.clerk_user_id === currentUserId;

                    return (
                      <tr
                        key={`global-${entry.clerk_user_id}`}
                        className={cn(
                          "border-b border-[#222] text-sm last:border-b-0",
                          isCurrentUser && "bg-[#0b120d]",
                        )}
                      >
                        <td className="px-4 py-4 font-mono sm:px-6">{entry.global_rank}</td>
                        <td className="px-4 py-4 text-[15px] leading-6 text-white sm:px-6">
                          {entry.display_name}
                          {isCurrentUser ? " // YOU" : ""}
                        </td>
                        <td className="px-4 py-4 font-mono text-[#3CD070] sm:px-6">
                          {formatLeaderboardRating(entry.average_rating)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  subjectEntries[activeScope].map((entry) => {
                    const isCurrentUser = entry.clerk_user_id === currentUserId;

                    return (
                      <tr
                        key={`${entry.subject}-${entry.clerk_user_id}`}
                        className={cn(
                          "border-b border-[#222] text-sm last:border-b-0",
                          isCurrentUser && "bg-[#0b120d]",
                        )}
                      >
                        <td className="px-4 py-4 font-mono sm:px-6">{entry.subject_rank}</td>
                        <td className="px-4 py-4 text-[15px] leading-6 text-white sm:px-6">
                          {entry.display_name}
                          {isCurrentUser ? " // YOU" : ""}
                        </td>
                        <td className="px-4 py-4 font-mono text-[#3CD070] sm:px-6">
                          {formatLeaderboardRating(entry.rating)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
