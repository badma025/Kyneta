"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReceivedRatingEntry = {
  id: string;
  raterUsername: string;
  ratingValue: number;
  reviewText: string | null;
  createdAt: string;
};

type ReceivedRatingsApiResponse = {
  items?: ReceivedRatingEntry[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  error?: string;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderStars(ratingValue: number) {
  return Array.from({ length: 5 }, (_, index) => {
    const isFilled = index < ratingValue;

    return (
      <span
        key={`${ratingValue}-${index}`}
        aria-hidden="true"
        className={cn(
          "text-lg leading-none",
          isFilled ? "text-[#3CD070]" : "text-[#465149]",
        )}
      >
        ★
      </span>
    );
  });
}

function RatingsPanelSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="border border-[#232B27] p-4 sm:p-5">
          <div className="h-4 w-28 animate-pulse bg-[#1A211D]" />
          <div className="mt-3 h-3 w-40 animate-pulse bg-[#1A211D]" />
          <div className="mt-4 h-16 animate-pulse bg-[#1A211D]" />
        </div>
      ))}
    </div>
  );
}

export function ReceivedRatingsPanel() {
  const [entries, setEntries] = useState<ReceivedRatingEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPage = useCallback(async (nextPage: number) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/profile/ratings?page=${nextPage}`);
      const payload = (await response.json()) as ReceivedRatingsApiResponse;

      if (
        !response.ok ||
        !Array.isArray(payload.items) ||
        typeof payload.totalPages !== "number" ||
        typeof payload.totalCount !== "number" ||
        typeof payload.page !== "number"
      ) {
        throw new Error(payload.error ?? "Invalid ratings payload.");
      }

      setEntries(payload.items);
      setPage(payload.page);
      setTotalPages(payload.totalPages);
      setTotalCount(payload.totalCount);
    } catch (error) {
      console.error("Failed to load profile ratings panel:", error);
      setEntries([]);
      setLoadError("[ FAILED TO LOAD RECEIVED RATINGS. ]");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPage(1);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadPage]);

  return (
    <section className="border border-[#232B27] bg-[#121614] p-4 sm:p-6">
      <div className="border-b border-[#232B27] pb-4">
        <div className="font-mono text-xs uppercase tracking-[0.24em] text-[#7A8A82]">
          Ratings Archive
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-mono text-2xl uppercase tracking-[0.14em] text-[#E0E6E3]">
              RECEIVED RATINGS
            </h2>
            <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#93A199]">
              Review signals from other users. Entries are shown newest first and
              paginated after every 10 records.
            </p>
          </div>
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#7A8A82]">
            TOTAL ENTRIES // {totalCount}
          </div>
        </div>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <RatingsPanelSkeleton />
        ) : loadError ? (
          <div className="border border-[#232B27] p-4 font-mono text-sm uppercase tracking-[0.18em] text-[#FF6B6B]">
            {loadError}
          </div>
        ) : entries.length === 0 ? (
          <div className="border border-[#232B27] p-4 sm:p-6">
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-[#7A8A82]">
              [ EMPTY ]
            </div>
            <p className="mt-3 text-[15px] leading-7 text-[#93A199]">
              No one has submitted a profile rating for this account yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="border border-[#232B27] p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#7A8A82]">
                      @{entry.raterUsername}
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      {renderStars(entry.ratingValue)}
                      <span className="ml-2 font-mono text-xs uppercase tracking-[0.16em] text-[#E0E6E3]">
                        {entry.ratingValue}/5
                      </span>
                    </div>
                  </div>
                  <div className="font-mono text-xs uppercase tracking-[0.16em] text-[#7A8A82]">
                    {formatTimestamp(entry.createdAt)}
                  </div>
                </div>
                <div className="mt-4 border-t border-[#232B27] pt-4">
                  <p className="text-[15px] leading-7 text-[#E0E6E3]">
                    {entry.reviewText?.trim() || "No written review attached."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-[#232B27] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#7A8A82]">
          PAGE {page} / {Math.max(totalPages, 1)}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => void loadPage(page - 1)}
            disabled={isLoading || page <= 1}
            className="min-w-28 font-mono"
          >
            Previous
          </Button>
          <Button
            type="button"
            onClick={() => void loadPage(page + 1)}
            disabled={isLoading || page >= totalPages}
            className="min-w-28 font-mono"
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
