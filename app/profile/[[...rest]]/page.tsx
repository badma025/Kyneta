import { UserProfile } from "@clerk/nextjs";

import { ReceivedRatingsPanel } from "@/components/profile/received-ratings-panel";

export default function ProfilePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
      <section className="w-full border border-[#232B27] bg-[#121614] p-4 sm:p-6">
        <div className="mb-4 font-mono text-xs uppercase tracking-[0.24em] text-[#7A8A82]">
          Account Console
        </div>
        <UserProfile path="/profile" routing="path" />
      </section>
      <ReceivedRatingsPanel />
    </main>
  );
}
