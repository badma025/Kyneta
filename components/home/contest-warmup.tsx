"use client";

import { useEffect } from "react";

import { SUPPORTED_GCSE_SUBJECTS } from "@/lib/gcse-subjects";

export function ContestWarmup() {
  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/problem", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subjects: SUPPORTED_GCSE_SUBJECTS,
        depth: 2,
      }),
      signal: controller.signal,
    }).catch((error) => {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      console.error("Failed to warm contest queues:", error);
    });

    return () => controller.abort();
  }, []);

  return null;
}
