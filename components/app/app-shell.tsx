"use client";

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
  const [userRating, setUserRating] = useState(1200);
  const showRating = pathname.startsWith("/contest");

  return (
    <RatingContext.Provider value={{ userRating, setUserRating }}>
      <div className="sticky top-0 z-50 border-b border-[#232B27] bg-[#121614]">
        <div className="mx-auto flex h-10 w-full max-w-6xl items-center justify-between px-4 text-[11px] uppercase tracking-[0.24em] sm:px-6">
          <span className="font-mono text-[#E0E6E3]">[KYNETA]</span>
          <div className="flex items-center gap-4 font-mono text-[#7A8A82]">
            {showRating ? (
              <div className="flex items-center gap-2">
                <span className="text-[#7A8A82]">RATING</span>
                <span className="text-[#E0E6E3]">{userRating}</span>
              </div>
            ) : null}
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
