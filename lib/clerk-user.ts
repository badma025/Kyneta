import "server-only";

type ClerkLikeUser = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: {
    emailAddress?: string | null;
  } | null;
};

export function getPublicDisplayName(userId: string, user?: ClerkLikeUser | null) {
  const fullName = user?.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  const composedName = [user?.firstName, user?.lastName]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .trim();

  if (composedName) {
    return composedName;
  }

  if (user?.username?.trim()) {
    return user.username.trim();
  }

  const primaryEmail = user?.primaryEmailAddress?.emailAddress?.trim();

  if (primaryEmail) {
    return primaryEmail;
  }

  return `USER-${userId.slice(-6).toUpperCase()}`;
}
