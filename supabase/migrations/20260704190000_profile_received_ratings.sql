create table if not exists public.profile_received_ratings (
  id uuid primary key default gen_random_uuid(),
  recipient_clerk_user_id text not null,
  rater_clerk_user_id text not null,
  rater_username text not null,
  rating_value smallint not null check (rating_value between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  constraint profile_received_ratings_recipient_fk
    foreign key (recipient_clerk_user_id)
    references public.profiles (clerk_user_id)
    on delete cascade,
  constraint profile_received_ratings_rater_fk
    foreign key (rater_clerk_user_id)
    references public.profiles (clerk_user_id)
    on delete cascade,
  constraint profile_received_ratings_self_rating_check
    check (recipient_clerk_user_id <> rater_clerk_user_id)
);

create index if not exists profile_received_ratings_recipient_created_at_idx
  on public.profile_received_ratings (recipient_clerk_user_id, created_at desc);

alter table public.profile_received_ratings enable row level security;

drop policy if exists "profile_received_ratings_select_own" on public.profile_received_ratings;
create policy "profile_received_ratings_select_own"
  on public.profile_received_ratings
  for select
  to authenticated
  using (
    coalesce(
      nullif(
        (current_setting('request.jwt.claims', true)::jsonb ->> 'clerk_user_id'),
        ''
      ),
      '__anonymous__'
    ) = recipient_clerk_user_id
  );
