import type { Metadata } from "next";

import { getUserProfile } from "@/server/users";
import { requireUserOrRedirect } from "@/server/session";
import { ProfileView } from "./profile-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your reliability, sportsmanship and game history on BASE-0."
};

export default async function ProfilePage() {
  // Middleware has already redirected signed-out visitors; this both proves the
  // session and gives us the uid to load.
  const user = await requireUserOrRedirect("/profile");
  const profile = await getUserProfile(user.uid);

  return <ProfileView initialProfile={profile} />;
}
