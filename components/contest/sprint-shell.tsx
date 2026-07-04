"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
};

const mockProblems: Problem[] = [
  {
    queueId: "K-019",
    prompt: [
      "Three agents review the same stream of claims.",
      "Agent A is correct 80% of the time.",
      "Agent B copies Agent A whenever it is uncertain.",
      "Agent C only flags a claim after both A and B agree.",
      "",
      "If uncertainty in B rises, does the final stream become",
      "more conservative, more volatile, or neither?",
      "",
      "Reply with one token: conservative | volatile | neither",
    ].join("\n"),
    correctAnswer: "conservative",
  },
  {
    queueId: "K-027",
    prompt: [
      "A gate opens only when exactly two of three signals are high.",
      "Signal A is high.",
      "Signal B copies Signal A.",
      "Signal C flips every cycle.",
      "",
      "On the current cycle, does the gate open?",
      "",
      "Reply with one token: yes | no",
    ].join("\n"),
    correctAnswer: "yes",
  },
  {
    queueId: "K-042",
    prompt: [
      "A sorter places items left if they are lighter than the pivot.",
      "The pivot stays fixed.",
      "Each new batch contains heavier items than the last.",
      "",
      "Over time, does the left side receive fewer items, more items, or the same?",
      "",
      "Reply with one token: fewer | more | same",
    ].join("\n"),
    correctAnswer: "fewer",
  },
];

type FlashState = "idle" | "correct" | "incorrect";

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z]/g, "");
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
  const [currentProblem, setCurrentProblem] = useState(mockProblems[0]);
  const [flashState, setFlashState] = useState<FlashState>("idle");

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

  function loadNextProblem() {
    const currentIndex = mockProblems.findIndex(
      (problem) => problem.queueId === currentProblem.queueId,
    );
    const nextIndex = (currentIndex + 1) % mockProblems.length;
    setCurrentProblem(mockProblems[nextIndex]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      loadNextProblem();
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
        <div className="max-w-2xl whitespace-pre-line font-mono text-base leading-8 text-[#E0E6E3] sm:text-lg">
          {`QUEUE: ${currentProblem.queueId}\n\n${currentProblem.prompt}`}
        </div>
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
            className={cn(
              "sm:flex-1",
              flashState === "correct" && "border-b-[#3CD070]",
              flashState === "incorrect" && "border-b-[#EF4444]",
            )}
          />
          <Button type="submit" className="sm:min-w-44" disabled={!answer.trim()}>
            Submit
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </motion.form>
    </main>
  );
}
