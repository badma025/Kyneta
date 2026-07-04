"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock3, SendHorizontal } from "lucide-react";

import { useRating } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DURATION_MS = 2 * 60 * 60 * 1000;

type Problem = {
  queueId: string;
  prompt: string;
  correctAnswer: string;
  imageBase64: string;
};

type GenerateProblemResponse = {
  problem_text?: string;
  correct_answer?: string;
  image_base64?: string;
  error?: string;
};

const hiddenConcepts = [
  "dijkstra pathfinding",
  "mechanism of charge in capacitors",
  "graph scale interpretation",
  "kinematic acceleration under constraints",
  "binary search invariants",
  "signal propagation through dependent systems",
];

type FlashState = "idle" | "correct" | "incorrect";

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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

export function SprintShell() {
  const { setUserRating } = useRating();
  const [remaining, setRemaining] = useState(DURATION_MS);
  const [answer, setAnswer] = useState("");
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [flashState, setFlashState] = useState<FlashState>("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const conceptIndexRef = useRef(0);
  const queueIndexRef = useRef(19);

  useEffect(() => {
    setUserRating(1200);

    const endsAt = Date.now() + DURATION_MS;
    const timer = window.setInterval(() => {
      const nextRemaining = Math.max(0, endsAt - Date.now());
      setRemaining(nextRemaining);

      if (nextRemaining === 0) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [setUserRating]);

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

  const fetchNextProblem = useCallback(async () => {
    const hiddenConcept =
      hiddenConcepts[conceptIndexRef.current % hiddenConcepts.length];
    const queueId = `K-${String(queueIndexRef.current).padStart(3, "0")}`;

    conceptIndexRef.current += 1;
    queueIndexRef.current += 1;

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hiddenConcept }),
      });

      const payload = (await response.json()) as GenerateProblemResponse;

      if (
        !response.ok ||
        typeof payload.problem_text !== "string" ||
        typeof payload.correct_answer !== "string" ||
        typeof payload.image_base64 !== "string"
      ) {
        throw new Error(
          payload.error ?? "The generation route returned an invalid payload.",
        );
      }

      setCurrentProblem({
        queueId,
        prompt: payload.problem_text,
        correctAnswer: payload.correct_answer,
        imageBase64: payload.image_base64,
      });
    } catch (error) {
      console.error("Failed to fetch next problem:", error);
      setCurrentProblem(null);
      setLoadError("KYNETA ENGINE STALLED. RETRY THE NEXT QUEUE PULL.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchNextProblem();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchNextProblem]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentProblem) {
      return;
    }

    const normalizedAnswer = normalizeAnswer(answer);
    const isCorrect =
      normalizedAnswer === normalizeAnswer(currentProblem.correctAnswer);

    if (!answer.trim()) {
      return;
    }

    if (isCorrect) {
      setFlashState("correct");
      setUserRating((rating) => rating + 12);
      setAnswer("");
      void fetchNextProblem();
      return;
    }

    setFlashState("incorrect");
    setUserRating((rating) => rating - 5);
    setAnswer("");
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
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
        className="flex-1 py-10"
      >
        {isLoading ? (
          <div className="font-mono text-sm uppercase tracking-[0.22em] text-[#7A8A82] sm:text-base">
            [ RUNNING KYNETA ENGINE... ]
          </div>
        ) : loadError ? (
          <div className="font-mono text-sm uppercase tracking-[0.18em] text-[#EF4444] sm:text-base">
            {loadError}
          </div>
        ) : currentProblem ? (
          <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Abstract logic diagram for the current puzzle"
              src={`data:image/jpeg;base64,${currentProblem.imageBase64}`}
              className="w-full border border-[#232B27] object-cover"
            />
            <div className="max-w-2xl whitespace-pre-line font-mono text-base leading-8 text-[#E0E6E3] sm:text-lg">
              {`QUEUE: ${currentProblem.queueId}\n\n${currentProblem.prompt}`}
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
          htmlFor="answer"
          className="mb-3 block font-mono text-xs uppercase tracking-[0.22em] text-[#7A8A82]"
        >
          Submit Answer
        </label>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Input
            id="answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="type the exact token response"
            disabled={isLoading || !currentProblem}
            className={cn(
              "sm:flex-1",
              flashState === "correct" && "border-b-[#3CD070]",
              flashState === "incorrect" && "border-b-[#EF4444]",
            )}
          />
          <Button
            type="submit"
            className="sm:min-w-44"
            disabled={isLoading || !currentProblem || !answer.trim()}
          >
            Submit
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </motion.form>
    </main>
  );
}
