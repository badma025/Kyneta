import { type GCSESubject } from "@/lib/gcse-subjects";

export type SubjectRatingSnapshot = {
  clerkUserId: string;
  subject: GCSESubject;
  rating: number;
  ratingDeviation: number;
  volatility: number;
  matchesPlayed: number;
};

export type GlobalLeaderboardEntry = {
  clerk_user_id: string;
  display_name: string;
  average_rating: number;
  global_rank: number;
};

export type SubjectLeaderboardEntry = {
  clerk_user_id: string;
  display_name: string;
  subject: GCSESubject;
  rating: number;
  subject_rank: number;
};
