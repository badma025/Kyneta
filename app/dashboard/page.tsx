"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SPRINT_REPORT_STORAGE_KEY = "kyneta-sprint-report";
const DEFAULT_INITIAL_RATING = 1500;
const DEFAULT_DURATION_MS = 60 * 1000;

type SolvedConcept = {
  queueId: string;
  concept: string;
  problemText: string;
};

type SprintReport = {
  sprintId: string;
  initialRating: number;
  finalRating: number;
  totalDurationMs: number;
  solvedConcepts: SolvedConcept[];
  completedAt: string;
};

type ConceptIntel = {
  moduleName: string;
  analysis: string;
};

const MOCK_REPORT: SprintReport = {
  sprintId: "fallback-session",
  initialRating: DEFAULT_INITIAL_RATING,
  finalRating: 1628,
  totalDurationMs: DEFAULT_DURATION_MS,
  completedAt: "2026-07-04T14:00:00.000Z",
  solvedConcepts: [
    {
      queueId: "K-020",
      concept: "dijkstra pathfinding",
      problemText:
        "A routed signal must reach a destination through weighted junctions. Each branch adds transit cost, and one tempting branch is shorter in steps but heavier in total cost.",
    },
    {
      queueId: "K-021",
      concept: "binary search invariants",
      problemText:
        "A sorted system compresses its valid region after each test. One boundary remains proven impossible and the other remains potentially correct until the interval collapses.",
    },
    {
      queueId: "K-022",
      concept: "mechanism of charge in capacitors",
      problemText:
        "Two isolated plates are connected, separated, and reconnected under changing potential conditions while total stored charge must be tracked conceptually.",
    },
  ],
};

const CONCEPT_INTELLIGENCE: Record<string, ConceptIntel> = {
  "dijkstra pathfinding": {
    moduleName: "Dijkstra's Pathfinding Algorithm",
    analysis:
      "[ ANALYSIS: The abstract routing puzzle tests cumulative path-cost comparison under weighted transitions. That is the same reasoning used when relaxing edges in graph theory and identifying the cheapest reachable frontier at each iteration. ]",
  },
  "mechanism of charge in capacitors": {
    moduleName: "Capacitor Charge Distribution",
    analysis:
      "[ ANALYSIS: The hidden system is really a capacitor-state model. The puzzle strips away circuit labels but still asks you to reason about stored charge, redistribution, and potential constraints exactly as standard electrostatics problems do. ]",
  },
  "graph scale interpretation": {
    moduleName: "Graph Scale Interpretation",
    analysis:
      "[ ANALYSIS: The prompt disguises axes and plotted trends as raw system behavior. Under the hood, it trains the same skill as reading slope, scale, and comparative growth from formal graphs in math and physics coursework. ]",
  },
  "kinematic acceleration under constraints": {
    moduleName: "Constrained Kinematics",
    analysis:
      "[ ANALYSIS: The blind puzzle maps back to acceleration reasoning with fixed constraints, forcing you to infer how motion variables co-evolve. This is the same conceptual structure used in rigorous mechanics and pulley-system problems. ]",
  },
  "binary search invariants": {
    moduleName: "Binary Search Invariants",
    analysis:
      "[ ANALYSIS: The puzzle trains interval elimination while preserving the one region that can still contain the answer. That is the core invariant logic behind binary search proofs and correctness reasoning in algorithms. ]",
  },
  "signal propagation through dependent systems": {
    moduleName: "Dependent Signal Propagation",
    analysis:
      "[ ANALYSIS: The disguised network asks you to track chained dependencies and update order. That maps directly to studying propagation delays, dependency graphs, and sequential system behavior in computing and control models. ]",
  },
};

function isSolvedConcept(value: unknown): value is SolvedConcept {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SolvedConcept>;

  return (
    typeof candidate.queueId === "string" &&
    typeof candidate.concept === "string" &&
    typeof candidate.problemText === "string"
  );
}

function isSprintReport(value: unknown): value is SprintReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SprintReport> & {
    solvedConcepts?: unknown;
  };

  return (
    typeof candidate.sprintId === "string" &&
    typeof candidate.finalRating === "number" &&
    typeof candidate.completedAt === "string" &&
    Array.isArray(candidate.solvedConcepts) &&
    candidate.solvedConcepts.every(isSolvedConcept)
  );
}

function normalizeStoredReport(storedReport: SprintReport): SprintReport {
  return {
    sprintId: storedReport.sprintId,
    initialRating:
      typeof storedReport.initialRating === "number"
        ? storedReport.initialRating
        : DEFAULT_INITIAL_RATING,
    finalRating: storedReport.finalRating,
    totalDurationMs:
      typeof storedReport.totalDurationMs === "number"
        ? storedReport.totalDurationMs
        : DEFAULT_DURATION_MS,
    solvedConcepts: storedReport.solvedConcepts,
    completedAt: storedReport.completedAt,
  };
}

function formatDuration(totalDurationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalDurationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatConceptLabel(rawConcept: string) {
  return rawConcept
    .split(" ")
    .map((part) =>
      part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part,
    )
    .join(" ");
}

function formatDisplayedRating(value: number) {
  return Math.round(value);
}

function getConceptIntel(concept: string): ConceptIntel {
  return (
    CONCEPT_INTELLIGENCE[concept] ?? {
      moduleName: formatConceptLabel(concept),
      analysis:
        "[ ANALYSIS: This sprint item maps an unlabeled abstract system back to a standard syllabus construct. The queue forces first-principles reasoning first, then reveals the formal academic frame after the run is complete. ]",
    }
  );
}

export default function DashboardPage() {
  const [report, setReport] = useState<SprintReport>(MOCK_REPORT);
  const [dataState, setDataState] = useState<"mock" | "live">("mock");
  const [expandedQueueId, setExpandedQueueId] = useState<string | null>(
    MOCK_REPORT.solvedConcepts[0]?.queueId ?? null,
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const storedReport = window.localStorage.getItem(SPRINT_REPORT_STORAGE_KEY);

        if (!storedReport) {
          return;
        }

        const parsedReport = JSON.parse(storedReport) as unknown;

        if (!isSprintReport(parsedReport)) {
          return;
        }

        const normalizedReport = normalizeStoredReport(parsedReport);
        setReport(normalizedReport);
        setDataState("live");
        setExpandedQueueId(normalizedReport.solvedConcepts[0]?.queueId ?? null);
      } catch (error) {
        console.error("Failed to read sprint report:", error);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const solvedCount = report.solvedConcepts.length;
  const displayedInitialRating = formatDisplayedRating(report.initialRating);
  const displayedFinalRating = formatDisplayedRating(report.finalRating);
  const ratingDelta = displayedFinalRating - displayedInitialRating;
  const formattedDuration = useMemo(
    () => formatDuration(report.totalDurationMs),
    [report.totalDurationMs],
  );
  const kineticEfficiency = useMemo(() => {
    const durationHours = Math.max(report.totalDurationMs / 3_600_000, 0.25);
    const ratingGain = Math.max(ratingDelta, 0);
    const solvedPerHour = solvedCount / durationHours;
    const composite = Math.round(ratingGain * 0.55 + solvedPerHour * 12);

    return {
      solvedPerHour: solvedPerHour.toFixed(1),
      composite,
    };
  }, [ratingDelta, report.totalDurationMs, solvedCount]);

  return (
    <main className="min-h-[calc(100vh-2.5rem)] bg-[#050505] font-sans text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-8 sm:px-6 sm:py-10">
        <section className="border border-[#222] bg-[#050505]">
          <div className="border-b border-[#222] px-4 py-4 sm:px-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#7a7a7a]">
              Post-Sprint Analytics
            </div>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="font-mono text-3xl font-semibold uppercase tracking-[0.14em] text-white sm:text-4xl">
                  CORE SYLLABUS DE-MASKED
                </h1>
                <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#8a8a8a]">
                  SESSION {report.sprintId} {"//"} REPORT SOURCE{" "}
                  {dataState === "live" ? "LOCAL STORAGE" : "FALLBACK MOCK"}
                </p>
              </div>
              <div className="font-mono text-sm uppercase tracking-[0.18em] text-[#7a7a7a]">
                COMPLETED {new Date(report.completedAt).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid border-b border-[#222] md:grid-cols-3">
            <section className="border-b border-[#222] px-4 py-5 md:border-b-0 md:border-r sm:px-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7a7a7a]">
                [ SPRINT METRICS ]
              </div>
              <div className="mt-5 space-y-3">
                <div className="font-mono text-3xl text-white sm:text-4xl">{solvedCount}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a]">
                  PROBLEMS SOLVED
                </div>
                <div className="border-t border-[#222] pt-3 font-mono text-sm uppercase tracking-[0.18em] text-white">
                  RATING: {displayedFinalRating} ({ratingDelta >= 0 ? "+" : ""}
                  {ratingDelta})
                </div>
              </div>
            </section>

            <section className="border-b border-[#222] px-4 py-5 md:border-b-0 md:border-r sm:px-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7a7a7a]">
                [ KINETIC EFFICIENCY ]
              </div>
              <div className="mt-5 space-y-3">
                <div className="font-mono text-3xl text-[#3CD070] sm:text-4xl">
                  {kineticEfficiency.composite}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a]">
                  EFFICIENCY INDEX
                </div>
                <div className="border-t border-[#222] pt-3 font-mono text-sm uppercase tracking-[0.18em] text-white">
                  {kineticEfficiency.solvedPerHour} SOLVED / HR // DURATION {formattedDuration}
                </div>
              </div>
            </section>

            <section className="px-4 py-5 sm:px-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7a7a7a]">
                [ STATUS ]
              </div>
              <div className="mt-5 space-y-3">
                <div className="font-mono text-xl uppercase tracking-[0.16em] text-white sm:text-2xl">
                  SESSION CONCLUDED
                </div>
                <div className="font-mono text-sm uppercase tracking-[0.18em] text-[#3CD070]">
                  CORE SYLLABUS DE-MASKED
                </div>
                <div className="border-t border-[#222] pt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a]">
                  REVIEW EACH QUEUE TO MAP BLIND REASONING BACK TO ITS FORMAL MODULE.
                </div>
              </div>
            </section>
          </div>

          <section className="px-4 py-6 sm:px-6">
            <div className="flex flex-col gap-3 border-b border-[#222] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7a7a7a]">
                  [ SYLLABUS DE-MASKING ]
                </div>
                <p className="mt-2 text-[15px] leading-7 text-[#8a8a8a]">
                  CLICK ANY ROW TO REVEAL HOW THE ABSTRACT PUZZLE MAPS BACK TO STANDARD STUDY.
                </p>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a]">
                {solvedCount} REVEALED MODULES
              </div>
            </div>

            <div className="mt-4 border border-[#222]">
              <div className="hidden grid-cols-[11rem_minmax(0,1.2fr)_minmax(0,1.8fr)_2.5rem] border-b border-[#222] bg-[#090909] font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a] md:grid">
                <div className="border-r border-[#222] px-4 py-3">Queue</div>
                <div className="border-r border-[#222] px-4 py-3">De-Masked Module</div>
                <div className="border-r border-[#222] px-4 py-3">Blind Puzzle Trace</div>
                <div className="px-4 py-3 text-right">Open</div>
              </div>

              {report.solvedConcepts.map((entry, index) => {
                const intel = getConceptIntel(entry.concept);
                const isExpanded = expandedQueueId === entry.queueId;

                return (
                  <div
                    key={entry.queueId}
                    className={cn(
                      "border-b border-[#222] last:border-b-0",
                      isExpanded && "bg-[#080808]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedQueueId((currentQueueId) =>
                          currentQueueId === entry.queueId ? null : entry.queueId,
                        )
                      }
                      className="grid w-full gap-4 px-4 py-4 text-left transition-colors hover:bg-[#0b0b0b] md:grid-cols-[11rem_minmax(0,1.2fr)_minmax(0,1.8fr)_2.5rem]"
                    >
                      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a] md:border-r md:border-[#222] md:pr-4">
                        QUEUE: {entry.queueId}
                      </div>
                      <div className="md:border-r md:border-[#222] md:pr-4">
                        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a] md:hidden">
                          DE-MASKED MODULE
                        </div>
                        <div className="mt-1 text-base font-semibold text-[#3CD070]">
                          {intel.moduleName}
                        </div>
                      </div>
                      <div className="md:border-r md:border-[#222] md:pr-4">
                        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a] md:hidden">
                          BLIND PUZZLE TRACE
                        </div>
                        <div className="mt-1 text-[15px] leading-7 text-white">
                          {entry.problemText}
                        </div>
                      </div>
                      <div className="flex items-start justify-end">
                        <span className="inline-flex h-7 w-7 items-center justify-center border border-[#222] text-[#7a7a7a]">
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              isExpanded && "rotate-90 text-[#3CD070]",
                            )}
                          />
                        </span>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden border-t border-[#222]"
                        >
                          <div className="grid gap-4 px-4 py-4 md:grid-cols-[11rem_minmax(0,1fr)]">
                            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a]">
                              ANALYSIS // ROW {String(index + 1).padStart(2, "0")}
                            </div>
                            <div className="space-y-3">
                              <div className="border border-[#222] bg-[#050505] p-4 text-[15px] leading-7 text-white">
                                {intel.analysis}
                              </div>
                              <div className="border border-[#222] p-4">
                                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7a7a]">
                                  ORIGINAL CONCEPT TAG
                                </div>
                                <div className="mt-2 font-mono text-sm uppercase tracking-[0.16em] text-[#3CD070]">
                                  {entry.concept}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="border-t border-[#222] px-4 py-6 sm:px-6">
            <Button
              asChild
              className="min-w-64 rounded-none border-[#3CD070] bg-[#3CD070] font-mono uppercase tracking-[0.2em] text-[#050505] hover:bg-[#49db7d]"
            >
              <Link href="/contest">INITIATE NEXT SPRINT</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
