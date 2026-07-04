"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { Check, Clock3, SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

import { useRating } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_GCSE_SUBJECT,
  type GCSESubject,
  getGCSESubjectConfig,
  normalizeGCSESubject,
  SUPPORTED_GCSE_SUBJECTS,
} from "@/lib/gcse-subjects";
import { cn } from "@/lib/utils";

const DURATION_MS = 60 * 1000;
const INITIAL_QUEUE_ID = "K-020";
const SPRINT_REPORT_STORAGE_KEY = "kyneta-sprint-report";
const INITIAL_RATING = 1500;
const INPUT_ERROR_MESSAGE = "[ ERROR: TOKEN MISMATCH. RETRY. ]";
const INPUT_REQUIRED_MESSAGE = "[ ERROR: SELECT ONE OPTION. ]";
const SPRINT_COMPLETE_MESSAGE = "[ SPRINT CONCLUDED. COMPILING REPORT... ]";
const SUBJECT_REQUIRED_MESSAGE = "[ SELECT A SUBJECT TO ARM THE SPRINT. ]";
const SESSION_READY_MESSAGE = "[ SUBJECT LOCKED. ARM THE SPRINT TO BEGIN. ]";
const SUBJECT_QUEUE_WARMUP_DEPTH = 5;
const RATING_FALLBACK_MESSAGE = "[ RATING CORE DEGRADED. USING LOCAL 1500. ]";
const RATING_LOADING_MESSAGE = "[ SYNCING SUBJECT RATING... ]";

type Problem = {
  queueId: string;
  subject: GCSESubject;
  hiddenConcept: string;
  prompt: string;
  correctAnswer: string;
  answerChoices: string[];
  imageBase64: string;
};

type SolvedConcept = {
  queueId: string;
  subject: GCSESubject;
  concept: string;
  problemText: string;
};

type ProblemApiResponse = {
  problem?: {
    sprintId: string;
    queueId: string;
    subject: string;
    hiddenConcept: string;
    problemText: string;
    correctAnswer: string;
    answerChoices: string[];
    imageBase64: string;
  };
  status?: "pending";
  nextQueueId?: string;
  error?: string;
};

type SubjectRatingApiResponse = {
  subject?: string;
  rating?: number;
  ratingDeviation?: number;
  volatility?: number;
  matchesPlayed?: number;
  error?: string;
};

type RatingResultApiResponse = {
  subject?: string;
  rating?: number;
  ratingDeviation?: number;
  volatility?: number;
  matchesPlayed?: number;
  ratingDelta?: number;
  error?: string;
};

type FlashState = "idle" | "correct" | "incorrect";

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase();
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function incrementQueueId(queueId: string) {
  const match = queueId.match(/^K-(\d+)$/);

  if (!match) {
    return queueId;
  }

  const nextValue = Number.parseInt(match[1], 10) + 1;

  return `K-${String(nextValue).padStart(match[1].length, "0")}`;
}

export function SprintShell() {
  const router = useRouter();
  const { setUserRating } = useRating();
  const activeFetchControllerRef = useRef<AbortController | null>(null);
  const fetchRequestIdRef = useRef(0);
  const ratingRequestIdRef = useRef(0);
  const sprintDeadlineRef = useRef<number | null>(null);
  const [remaining, setRemaining] = useState(DURATION_MS);
  const [selectedSubject, setSelectedSubject] = useState<GCSESubject | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [rating, setRating] = useState(INITIAL_RATING);
  const [sessionInitialRating, setSessionInitialRating] = useState(INITIAL_RATING);
  const [currentQueueId, setCurrentQueueId] = useState(INITIAL_QUEUE_ID);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [solvedConcepts, setSolvedConcepts] = useState<SolvedConcept[]>([]);
  const [flashState, setFlashState] = useState<FlashState>("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRating, setIsLoadingRating] = useState(false);
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);
  const [pendingQueueId, setPendingQueueId] = useState<string | null>(null);
  const [inputWarning, setInputWarning] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasSessionStarted, setHasSessionStarted] = useState(false);
  const sprintId = useMemo(
    () => (selectedSubject ? `dev-session:${selectedSubject}` : null),
    [selectedSubject],
  );

  useEffect(() => {
    setUserRating(rating);
  }, [rating, setUserRating]);

  useEffect(() => {
    return () => {
      activeFetchControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!hasSessionStarted) {
      return;
    }

    if (sprintDeadlineRef.current === null) {
      sprintDeadlineRef.current = Date.now() + DURATION_MS;
    }

    const timer = window.setInterval(() => {
      const nextRemaining = Math.max(0, sprintDeadlineRef.current! - Date.now());
      setRemaining(nextRemaining);

      if (nextRemaining === 0) {
        window.clearInterval(timer);
        activeFetchControllerRef.current?.abort();
        activeFetchControllerRef.current = null;
        setPendingQueueId(null);
        setIsLoading(false);
        setLoadError(SPRINT_COMPLETE_MESSAGE);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [hasSessionStarted]);

  useEffect(() => {
    if (!hasSessionStarted || remaining > 0 || !sprintId) {
      return;
    }

    try {
      window.localStorage.setItem(
        SPRINT_REPORT_STORAGE_KEY,
        JSON.stringify({
          sprintId,
          subject: selectedSubject,
          initialRating: sessionInitialRating,
          finalRating: rating,
          totalDurationMs: DURATION_MS,
          solvedConcepts,
          completedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.error("Failed to persist sprint report:", error);
    }

    const timeout = window.setTimeout(() => {
      router.replace("/dashboard");
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    hasSessionStarted,
    rating,
    remaining,
    router,
    sessionInitialRating,
    selectedSubject,
    solvedConcepts,
    sprintId,
  ]);

  useEffect(() => {
    if (flashState === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFlashState("idle");
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [flashState]);

  const timeLabel = useMemo(() => formatTime(remaining), [remaining]);
  const isSprintConcluded = remaining === 0;
  const loadSubjectRating = useCallback(async (subject: GCSESubject) => {
    const requestId = ratingRequestIdRef.current + 1;
    ratingRequestIdRef.current = requestId;
    setIsLoadingRating(true);

    try {
      const response = await fetch(`/api/ratings/subject?subject=${subject}`);
      const payload = (await response.json()) as SubjectRatingApiResponse;

      if (ratingRequestIdRef.current !== requestId) {
        return;
      }

      if (
        !response.ok ||
        typeof payload.rating !== "number" ||
        typeof payload.ratingDeviation !== "number" ||
        typeof payload.volatility !== "number"
      ) {
        throw new Error(payload.error ?? "Invalid rating payload.");
      }

      setRating(payload.rating);
      setSessionInitialRating(payload.rating);
      setUserRating(payload.rating);
    } catch (error) {
      if (ratingRequestIdRef.current !== requestId) {
        return;
      }

      console.error("Failed to load subject rating:", error);
      setRating(INITIAL_RATING);
      setSessionInitialRating(INITIAL_RATING);
      setUserRating(INITIAL_RATING);
      setInputWarning(RATING_FALLBACK_MESSAGE);
    } finally {
      if (ratingRequestIdRef.current === requestId) {
        setIsLoadingRating(false);
      }
    }
  }, [setUserRating]);

  const isSubjectLocked = hasSessionStarted || isSprintConcluded;
  const handleSubjectChange = useCallback((subject: GCSESubject) => {
    if (isSubjectLocked) {
      return;
    }

    fetchRequestIdRef.current += 1;
    activeFetchControllerRef.current?.abort();
    activeFetchControllerRef.current = null;
    setSelectedSubject(subject);
    setCurrentQueueId(INITIAL_QUEUE_ID);
    setCurrentProblem(null);
    setPendingQueueId(null);
    setInputWarning(null);
    setLoadError(null);
    setIsLoading(false);
    setSelectedAnswer(null);
    setRemaining(DURATION_MS);
    setRating(INITIAL_RATING);
    setSessionInitialRating(INITIAL_RATING);
    sprintDeadlineRef.current = null;
    void loadSubjectRating(subject);

    void fetch("/api/problem", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subjects: [subject],
        depth: SUBJECT_QUEUE_WARMUP_DEPTH,
      }),
    }).catch((error) => {
      console.error("Failed to warm selected subject queue:", error);
    });
  }, [isSubjectLocked, loadSubjectRating]);

  const fetchNextProblem = useCallback(async (nextQueueId?: string) => {
    if (isSprintConcluded || !selectedSubject || !sprintId) {
      return;
    }

    const requestId = fetchRequestIdRef.current + 1;
    fetchRequestIdRef.current = requestId;
    activeFetchControllerRef.current?.abort();
    const controller = new AbortController();
    activeFetchControllerRef.current = controller;

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/problem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sprintId,
          nextQueueId,
          subject: selectedSubject,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as ProblemApiResponse;

      if (fetchRequestIdRef.current !== requestId) {
        return;
      }

      if (response.status === 202 && payload.status === "pending") {
        setPendingQueueId(payload.nextQueueId ?? nextQueueId ?? INITIAL_QUEUE_ID);
        return;
      }

      if (
        !response.ok ||
        !payload.problem ||
        typeof payload.problem.subject !== "string" ||
        typeof payload.problem.hiddenConcept !== "string" ||
        typeof payload.problem.problemText !== "string" ||
        typeof payload.problem.correctAnswer !== "string" ||
        !Array.isArray(payload.problem.answerChoices) ||
        payload.problem.answerChoices.some((choice) => typeof choice !== "string") ||
        typeof payload.problem.imageBase64 !== "string" ||
        typeof payload.problem.queueId !== "string" ||
        payload.problem.sprintId !== sprintId
      ) {
        throw new Error(
          payload.error ?? "The problem queue returned an invalid payload.",
        );
      }

      const responseSubject = normalizeGCSESubject(payload.problem.subject);

      if (responseSubject !== selectedSubject) {
        throw new Error("Received a problem for a different subject queue.");
      }

      setPendingQueueId(null);
      setInputWarning(null);
      setCurrentProblem({
        queueId: payload.problem.queueId,
        subject: responseSubject,
        hiddenConcept: payload.problem.hiddenConcept,
        prompt: payload.problem.problemText,
        correctAnswer: payload.problem.correctAnswer,
        answerChoices: payload.problem.answerChoices,
        imageBase64: payload.problem.imageBase64,
      });
      setCurrentQueueId(payload.problem.queueId);
      setSelectedAnswer(null);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      if (fetchRequestIdRef.current !== requestId) {
        return;
      }

      console.error("Failed to fetch next problem:", error);
      setPendingQueueId(null);
      setCurrentProblem(null);
      setLoadError("KYNETA ENGINE STALLED. RETRY THE NEXT QUEUE PULL.");
    } finally {
      if (activeFetchControllerRef.current === controller) {
        activeFetchControllerRef.current = null;
      }

      if (fetchRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [isSprintConcluded, selectedSubject, sprintId]);

  const handleStartSession = useCallback(() => {
    if (!selectedSubject || !sprintId || hasSessionStarted || isSprintConcluded) {
      setInputWarning(SUBJECT_REQUIRED_MESSAGE);
      return;
    }

    sprintDeadlineRef.current = Date.now() + DURATION_MS;
    setRemaining(DURATION_MS);
    setCurrentQueueId(INITIAL_QUEUE_ID);
    setCurrentProblem(null);
    setPendingQueueId(null);
    setLoadError(null);
    setInputWarning(null);
    setSelectedAnswer(null);
    setHasSessionStarted(true);
    void fetchNextProblem();
  }, [
    fetchNextProblem,
    hasSessionStarted,
    isSprintConcluded,
    selectedSubject,
    sprintId,
  ]);

  useEffect(() => {
    if (!hasSessionStarted || !pendingQueueId || isSprintConcluded) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void fetchNextProblem(pendingQueueId);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [fetchNextProblem, hasSessionStarted, isSprintConcluded, pendingQueueId]);

  const isFetchingProblem =
    hasSessionStarted && !isSprintConcluded && (isLoading || pendingQueueId !== null);
  const isInputDisabled =
    !hasSessionStarted ||
    isSprintConcluded ||
    isFetchingProblem ||
    isSubmittingResult ||
    !currentProblem;
  const statusMessage = isSprintConcluded
    ? SPRINT_COMPLETE_MESSAGE
    : hasSessionStarted
      ? loadError
      : isLoadingRating
        ? RATING_LOADING_MESSAGE
      : selectedSubject
        ? SESSION_READY_MESSAGE
        : SUBJECT_REQUIRED_MESSAGE;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentProblem || isSprintConcluded || isSubmittingResult) {
      return;
    }

    const normalizedAnswer = normalizeAnswer(selectedAnswer ?? "");
    const isCorrect =
      normalizedAnswer === normalizeAnswer(currentProblem.correctAnswer);

    if (!selectedAnswer?.trim()) {
      setInputWarning(INPUT_REQUIRED_MESSAGE);
      setFlashState("incorrect");
      return;
    }

    setIsSubmittingResult(true);

    try {
      const response = await fetch("/api/ratings/result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: currentProblem.subject,
          queueId: currentProblem.queueId,
          submittedAnswer: selectedAnswer,
          correctAnswer: currentProblem.correctAnswer,
          isCorrect,
        }),
      });
      const payload = (await response.json()) as RatingResultApiResponse;

      if (!response.ok || typeof payload.rating !== "number") {
        throw new Error(payload.error ?? "Invalid rating update payload.");
      }

      setRating(payload.rating);
      setUserRating(payload.rating);

      if (isCorrect) {
        setFlashState("correct");
        setInputWarning(null);
        setSolvedConcepts((currentSolvedConcepts) => [
          ...currentSolvedConcepts,
          {
            queueId: currentProblem.queueId,
            subject: currentProblem.subject,
            concept: currentProblem.hiddenConcept,
            problemText: currentProblem.prompt,
          },
        ]);
        setSelectedAnswer(null);
        const nextQueueId = incrementQueueId(currentQueueId);
        void fetchNextProblem(nextQueueId);
        return;
      }

      setFlashState("incorrect");
      setInputWarning(INPUT_ERROR_MESSAGE);
    } catch (error) {
      console.error("Failed to persist rating result:", error);
      setFlashState("incorrect");
      setInputWarning("[ RATING WRITE FAILED. RETRY. ]");
    } finally {
      setIsSubmittingResult(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-4xl flex-col px-4 py-10 sm:px-6 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="border-b border-[#232B27] pb-8"
      >
        <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-[#7A8A82]">
          <Clock3 className="h-3.5 w-3.5" />
          Sprint Timer
        </div>
        <div className="font-mono text-4xl tracking-[0.16em] text-[#E0E6E3] sm:text-6xl">
          {timeLabel}
        </div>
        <div className="mt-6 border-t border-[#232B27] pt-5">
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-[#7A8A82]">
            Subject Specification
          </div>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_GCSE_SUBJECTS.map((subject) => {
              const isActive = subject === selectedSubject;

              return (
                <button
                  key={subject}
                  type="button"
                  onClick={() => handleSubjectChange(subject)}
                  disabled={isSubjectLocked}
                  className={cn(
                    "border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors",
                    isActive
                      ? "border-[#3CD070] bg-[#3CD070] text-[#121614]"
                      : "border-[#232B27] text-[#E0E6E3] hover:border-[#3CD070] hover:text-[#3CD070]",
                    isSubjectLocked && "cursor-not-allowed opacity-60",
                  )}
                >
                  {getGCSESubjectConfig(subject).label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-[#232B27] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#7A8A82]">
              {hasSessionStarted
                ? `[ SUBJECT LOCKED: ${getGCSESubjectConfig(selectedSubject ?? DEFAULT_GCSE_SUBJECT).label.toUpperCase()} ]`
                : statusMessage}
            </div>
            <Button
              type="button"
              onClick={handleStartSession}
              disabled={
                !selectedSubject ||
                isLoadingRating ||
                hasSessionStarted ||
                isSprintConcluded
              }
              className="sm:min-w-52"
            >
              Arm Sprint
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
        className="flex-1 py-10"
      >
        {!hasSessionStarted ? (
          <div className="border border-[#232B27] px-5 py-6 font-mono text-sm uppercase tracking-[0.18em] text-[#E0E6E3]">
            {selectedSubject
              ? `SELECTED SUBJECT: ${getGCSESubjectConfig(selectedSubject).label}\n\nARM THE SPRINT TO LOCK THIS SUBJECT AND BEGIN THE 90-SECOND SESSION.`
              : "SELECT ONE SUBJECT ABOVE. ANSWERING REMAINS LOCKED UNTIL A SUBJECT IS CHOSEN AND THE SPRINT IS ARMED."}
          </div>
        ) : isFetchingProblem ? (
          <div className="font-mono text-sm uppercase tracking-[0.22em] text-[#7A8A82] sm:text-base">
            [ RUNNING KYNETA ENGINE... ]
          </div>
        ) : statusMessage ? (
          <div className="font-mono text-sm uppercase tracking-[0.18em] text-[#EF4444] sm:text-base">
            {statusMessage}
          </div>
        ) : currentProblem ? (
          <div
            className={cn(
              "grid gap-6 lg:items-start",
              currentProblem.imageBase64
                ? "lg:grid-cols-[18rem_minmax(0,1fr)]"
                : "lg:grid-cols-1",
            )}
          >
            {currentProblem.imageBase64 ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Abstract logic diagram for the current puzzle"
                  src={`data:image/jpeg;base64,${currentProblem.imageBase64}`}
                  className="w-full border border-[#232B27] object-cover"
                />
              </>
            ) : null}
            <div className="max-w-2xl whitespace-pre-line font-mono text-base leading-8 text-[#E0E6E3] sm:text-lg">
              {`SUBJECT: ${getGCSESubjectConfig(currentProblem.subject).label}\nQUEUE: ${currentProblem.queueId}\n\n${currentProblem.prompt}`}
            </div>
            <div className="max-w-2xl border-t border-[#232B27] pt-6">
              <div className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-[#7A8A82]">
                Answer Choices
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {currentProblem.answerChoices.map((choice, index) => {
                  const isSelected = selectedAnswer === choice;

                  return (
                    <button
                      key={`${currentProblem.queueId}-${choice}`}
                      type="button"
                      onClick={() => {
                        setSelectedAnswer(choice);
                        setInputWarning(null);
                      }}
                      disabled={isInputDisabled}
                      className={cn(
                        "flex min-h-20 items-start justify-between border px-4 py-3 text-left font-mono text-sm uppercase tracking-[0.14em] transition-colors",
                        isSelected
                          ? "border-[#3CD070] bg-[#18211b] text-[#E0E6E3]"
                          : "border-[#232B27] text-[#E0E6E3] hover:border-[#3CD070]",
                        isInputDisabled && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <span className="pr-4">{`${String.fromCharCode(65 + index)}. ${choice}`}</span>
                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-5 w-5 items-center justify-center border text-[10px]",
                          isSelected
                            ? "border-[#3CD070] text-[#3CD070]"
                            : "border-[#232B27] text-[#7A8A82]",
                        )}
                      >
                        {isSelected ? <Check className="h-3 w-3" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </motion.section>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.16, ease: "easeOut" }}
        className="border-t border-[#232B27] pt-6"
      >
        <label
          className="mb-3 block font-mono text-xs uppercase tracking-[0.22em] text-[#7A8A82]"
        >
          Lock Answer
        </label>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div
            className={cn(
              "border-b px-0 py-3 font-mono text-sm uppercase tracking-[0.16em] sm:flex-1",
              flashState === "correct" && "border-b-[#00FF66]",
              flashState === "incorrect" && "border-b-[#FF3333]",
              flashState === "idle" && "border-b-[#232B27]",
              !selectedAnswer && "text-[#7A8A82]",
              selectedAnswer && "text-[#E0E6E3]",
            )}
          >
            {selectedAnswer ?? "select one answer choice"}
          </div>
          <Button
            type="submit"
            className="sm:min-w-44"
            disabled={isInputDisabled}
          >
            Submit
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <div
          className={cn(
            "mt-3 min-h-5 font-mono text-[11px] uppercase tracking-[0.18em]",
            inputWarning ? "text-[#FF3333]" : "text-transparent",
          )}
        >
          {inputWarning ?? "[ READY ]"}
        </div>
      </motion.form>
    </main>
  );
}
