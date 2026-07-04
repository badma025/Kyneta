"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type RatingContextValue = {
  userRating: number;
  setUserRating: Dispatch<SetStateAction<number>>;
};

const RatingContext = createContext<RatingContextValue | null>(null);

export function useRating() {
  const context = useContext(RatingContext);

  if (!context) {
    throw new Error("useRating must be used within AppShell.");
  }

  return context;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [userRating, setUserRating] = useState(1500);
  const showRating = pathname.startsWith("/contest");

  return (
    <RatingContext.Provider value={{ userRating, setUserRating }}>
      <div className="sticky top-0 z-50 border-b border-[#232B27] bg-[#121614]">
        <div className="mx-auto flex min-h-10 w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 text-[10px] uppercase tracking-[0.22em] sm:h-10 sm:flex-nowrap sm:gap-y-0 sm:px-6 sm:py-0 sm:text-[11px] sm:tracking-[0.24em]">
          <Link
            href="/"
            className="font-mono text-[#E0E6E3] transition-colors hover:text-[#3CD070]"
          >
            [KYNETA]
          </Link>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 font-mono text-[#7A8A82] sm:flex-nowrap sm:gap-3">
            <Link
              href="/leaderboard"
              className="border border-[#232B27] px-2 py-1 text-[10px] tracking-[0.22em] text-[#E0E6E3] transition-colors hover:border-[#3CD070] hover:text-[#3CD070]"
            >
              LEADERBOARD
            </Link>
            {showRating ? (
              <div className="flex items-center gap-2">
                <span className="text-[#7A8A82]">RATING</span>
                <span className="text-[#E0E6E3]">{Math.round(userRating)}</span>
              </div>
            ) : null}
            <Show when="signed-out">
              <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="border border-[#232B27] px-2 py-1 text-[10px] tracking-[0.22em] text-[#E0E6E3] transition-colors hover:border-[#3CD070] hover:text-[#3CD070]"
              >
                SIGN IN
              </Link>
              <Link
                href="/sign-up"
                className="border border-[#3CD070] bg-[#3CD070] px-2 py-1 text-[10px] tracking-[0.22em] text-[#0B0F0D] transition-colors hover:bg-[#35BD66]"
              >
                SIGN UP
              </Link>
              </div>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className="border border-[#232B27] px-2 py-1 text-[10px] tracking-[0.22em] text-[#E0E6E3] transition-colors hover:border-[#3CD070] hover:text-[#3CD070]"
                >
                  <span className="sm:hidden">PROFILE</span>
                  <span className="hidden sm:inline">MANAGE ACCOUNT</span>
                </Link>
                <UserButton
                  userProfileMode="navigation"
                  userProfileUrl="/profile"
                />
              </div>
            </Show>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 animate-pulse-dot rounded-full bg-[#3CD070]" />
              <span>SYS: ONLINE</span>
            </div>
          </div>
        </div>
      </div>
      {children}
    </RatingContext.Provider>
  );
}
