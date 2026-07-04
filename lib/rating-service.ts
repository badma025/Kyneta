import "server-only";

import { createClient } from "@supabase/supabase-js";

import { applyGlicko2Match } from "@/lib/glicko2";
import { type GCSESubject } from "@/lib/gcse-subjects";
import {
  type GlobalLeaderboardEntry,
  type SubjectLeaderboardEntry,
  type SubjectRatingSnapshot,
} from "@/lib/rating-types";

export const DEFAULT_GLICKO_RATING = 1500;
export const DEFAULT_GLICKO_RD = 350;
export const DEFAULT_GLICKO_VOLATILITY = 0.06;

const QUESTION_BENCHMARK_RATING = 1500;
const QUESTION_BENCHMARK_RD = 50;

type SubjectRatingRow = {
  id: string;
  clerk_user_id: string;
  subject: GCSESubject;
  rating: number;
  rating_deviation: number;
  volatility: number;
  matches_played: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
};

type RecordQuestionResultInput = {
  clerkUserId: string;
  displayName: string;
  subject: GCSESubject;
  queueId: string;
  isCorrect: boolean;
  submittedAnswer?: string | null;
  correctAnswer?: string | null;
};

let supabaseAdminClient:
  | ReturnType<typeof createClient>
  | null = null;

function getSupabaseAdminClient() {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase server configuration. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminClient;
}

function mapSubjectRatingRow(row: SubjectRatingRow): SubjectRatingSnapshot {
  return {
    clerkUserId: row.clerk_user_id,
    subject: row.subject,
    rating: Number(row.rating),
    ratingDeviation: Number(row.rating_deviation),
    volatility: Number(row.volatility),
    matchesPlayed: row.matches_played,
  };
}

function pickSingleRow<T>(value: T | T[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

async function bootstrapUserRatings(
  clerkUserId: string,
  displayName: string,
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await (supabase as any).rpc("bootstrap_user_ratings", {
    p_clerk_user_id: clerkUserId,
    p_display_name: displayName,
  });

  if (error) {
    throw new Error(`Failed to bootstrap user ratings: ${error.message}`);
  }
}

export async function getUserSubjectRating(
  clerkUserId: string,
  displayName: string,
  subject: GCSESubject,
) {
  const supabase = getSupabaseAdminClient();
  await bootstrapUserRatings(clerkUserId, displayName);

  const { data, error } = await supabase
    .from("subject_ratings")
    .select(
      "id,clerk_user_id,subject,rating,rating_deviation,volatility,matches_played,last_activity_at,created_at,updated_at",
    )
    .eq("clerk_user_id", clerkUserId)
    .eq("subject", subject)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to load subject rating for ${subject}: ${error?.message ?? "Row not found."}`,
    );
  }

  return mapSubjectRatingRow(data as SubjectRatingRow);
}

export async function recordQuestionResult(
  input: RecordQuestionResultInput,
) {
  const supabase = getSupabaseAdminClient();
  const current = await getUserSubjectRating(
    input.clerkUserId,
    input.displayName,
    input.subject,
  );
  const updated = applyGlicko2Match(
    {
      rating: current.rating,
      ratingDeviation: current.ratingDeviation,
      volatility: current.volatility,
    },
    {
      opponentRating: QUESTION_BENCHMARK_RATING,
      opponentRatingDeviation: QUESTION_BENCHMARK_RD,
      score: input.isCorrect ? 1 : 0,
    },
  );
  const { data, error } = await (supabase as any).rpc("record_question_result", {
    p_clerk_user_id: input.clerkUserId,
    p_display_name: input.displayName,
    p_subject: input.subject,
    p_queue_id: input.queueId,
    p_is_correct: input.isCorrect,
    p_submitted_answer: input.submittedAnswer ?? null,
    p_correct_answer: input.correctAnswer ?? null,
    p_new_rating: updated.rating,
    p_new_rating_deviation: updated.ratingDeviation,
    p_new_volatility: updated.volatility,
  });

  if (error) {
    throw new Error(`Failed to record question result: ${error.message}`);
  }

  const updatedRow = pickSingleRow(data as SubjectRatingRow | SubjectRatingRow[] | null);

  if (!updatedRow) {
    throw new Error("Supabase did not return the updated rating row.");
  }

  const snapshot = mapSubjectRatingRow(updatedRow);

  return {
    current,
    updated: snapshot,
    ratingDelta: Number((snapshot.rating - current.rating).toFixed(6)),
  };
}

export async function getGlobalLeaderboard() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await (supabase as any).rpc("get_global_leaderboard");

  if (error) {
    throw new Error(`Failed to load global leaderboard: ${error.message}`);
  }

  return (data ?? []).map((entry: any) => ({
    ...entry,
    average_rating: Number(entry.average_rating),
    global_rank: Number(entry.global_rank),
  })) as GlobalLeaderboardEntry[];
}

export async function getSubjectLeaderboard(subject: GCSESubject) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await (supabase as any).rpc("get_subject_leaderboard", {
    p_subject: subject,
  });

  if (error) {
    throw new Error(
      `Failed to load ${subject} leaderboard: ${error.message}`,
    );
  }

  return (data ?? []).map((entry: any) => ({
    ...entry,
    rating: Number(entry.rating),
    subject_rank: Number(entry.subject_rank),
  })) as SubjectLeaderboardEntry[];
}
