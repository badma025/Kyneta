import Link from "next/link";

import { ContestWarmup } from "@/components/home/contest-warmup";
import { DemoComparison } from "@/components/home/demo-comparison";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col px-4 py-24 sm:px-6 sm:py-32 lg:py-40">
      <ContestWarmup />
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <div className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-[#7A8A82]">
          Cognitive Sprint Queue
        </div>
        <h1 className="text-balance max-w-4xl text-5xl font-semibold leading-[1.02] text-[#E0E6E3] sm:text-6xl lg:text-7xl">
          Strip the context. Build raw intuition.
        </h1>
        <p className="mt-6 max-w-3xl text-balance text-base leading-8 text-[#7A8A82] sm:text-lg">
          A domain-agnostic testing queue built for neurodivergent minds. Skip
          the textbook chapters and master core first-principles logic through
          unlabeled, rated sprints.
        </p>
        <div className="mt-10">
          <Button asChild size="lg" className="min-w-56">
            <Link href="/contest">ENTER THE QUEUE →</Link>
          </Button>
        </div>
      </section>

      <section className="mt-16 sm:mt-20">
        <DemoComparison />
      </section>
    </main>
  );
}
