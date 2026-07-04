"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
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
        <div className="mx-auto flex h-10 w-full max-w-6xl items-center justify-between px-4 text-[11px] uppercase tracking-[0.24em] sm:px-6">
          <Link
            href="/"
            className="font-mono text-[#E0E6E3] transition-colors hover:text-[#3CD070]"
          >
            [KYNETA]
          </Link>
          <div className="flex items-center gap-3 font-mono text-[#7A8A82]">
            <Link
              href="/leaderboard"
              className="hidden border border-[#232B27] px-2 py-1 text-[10px] tracking-[0.22em] text-[#E0E6E3] transition-colors hover:border-[#3CD070] hover:text-[#3CD070] sm:inline"
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
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="border border-[#232B27] px-2 py-1 text-[10px] tracking-[0.22em] text-[#E0E6E3] transition-colors hover:border-[#3CD070] hover:text-[#3CD070]"
                  >
                    SIGN IN
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="border border-[#3CD070] bg-[#3CD070] px-2 py-1 text-[10px] tracking-[0.22em] text-[#121614] transition-colors hover:bg-[#48db7c]"
                  >
                    SIGN UP
                  </button>
                </SignUpButton>
              </div>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className="hidden border border-[#232B27] px-2 py-1 text-[10px] tracking-[0.22em] text-[#E0E6E3] transition-colors hover:border-[#3CD070] hover:text-[#3CD070] sm:inline"
                >
                  MANAGE ACCOUNT
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
