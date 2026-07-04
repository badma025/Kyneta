import "server-only";

import { createClient } from "@supabase/supabase-js";

const PROFILE_RATINGS_PAGE_SIZE = 10;
const MISSING_PROFILE_RATINGS_TABLE_SENTINEL =
  "PROFILE_RECEIVED_RATINGS_TABLE_MISSING";

type ProfileReceivedRatingRow = {
  id: string;
  recipient_clerk_user_id: string;
  rater_clerk_user_id: string;
  rater_username: string;
  rating_value: number;
  review_text: string | null;
  created_at: string;
};

export type ProfileReceivedRating = {
  id: string;
  raterUsername: string;
  ratingValue: number;
  reviewText: string | null;
  createdAt: string;
};

export function isMissingProfileRatingsTableError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(MISSING_PROFILE_RATINGS_TABLE_SENTINEL)
  );
}

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

function normalizePage(page: number) {
  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

function mapProfileReceivedRating(row: ProfileReceivedRatingRow): ProfileReceivedRating {
  return {
    id: row.id,
    raterUsername: row.rater_username,
    ratingValue: Number(row.rating_value),
    reviewText: row.review_text,
    createdAt: row.created_at,
  };
}

export async function getReceivedProfileRatings(
  recipientClerkUserId: string,
  page: number,
) {
  const supabase = getSupabaseAdminClient();
  const normalizedPage = normalizePage(page);
  const from = (normalizedPage - 1) * PROFILE_RATINGS_PAGE_SIZE;
  const to = from + PROFILE_RATINGS_PAGE_SIZE - 1;
  const { data, count, error } = await supabase
    .from("profile_received_ratings")
    .select(
      "id,recipient_clerk_user_id,rater_clerk_user_id,rater_username,rating_value,review_text,created_at",
      { count: "exact" },
    )
    .eq("recipient_clerk_user_id", recipientClerkUserId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    if (
      error.message.includes(
        "Could not find the table 'public.profile_received_ratings' in the schema cache",
      )
    ) {
      throw new Error(MISSING_PROFILE_RATINGS_TABLE_SENTINEL);
    }

    throw new Error(`Failed to load profile ratings: ${error.message}`);
  }

  const totalCount = count ?? 0;
  const totalPages =
    totalCount === 0 ? 1 : Math.ceil(totalCount / PROFILE_RATINGS_PAGE_SIZE);

  return {
    items: (data ?? []).map((row) =>
      mapProfileReceivedRating(row as ProfileReceivedRatingRow),
    ),
    totalCount,
    page: normalizedPage,
    pageSize: PROFILE_RATINGS_PAGE_SIZE,
    totalPages,
    hasNextPage: normalizedPage < totalPages,
    hasPreviousPage: normalizedPage > 1,
  };
}
