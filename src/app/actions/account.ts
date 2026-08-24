"use server";

import { revalidatePath } from "next/cache";

import type { ChatMessage, NotificationItem, UserProfile } from "@/types/domain";
import { getChatMessages, sendChatMessage } from "@/server/chat";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "@/server/notifications";
import { updateUserProfile } from "@/server/users";
import { requireUser } from "@/server/session";
import { chatMessageSchema, gameIdSchema, updateProfileSchema } from "@/server/validators";
import { ok, toActionError, type ActionResult } from "@/server/errors";

/* ---------------------------------------------------------------- Profile */

export async function updateProfileAction(input: unknown): Promise<ActionResult<UserProfile>> {
  try {
    const user = await requireUser();
    const payload = updateProfileSchema.parse(input);
    const profile = await updateUserProfile(user.uid, payload);

    revalidatePath("/profile");

    return ok(profile, "Profile saved");
  } catch (error) {
    return toActionError(error);
  }
}

/* ---------------------------------------------------------- Notifications */

export async function markNotificationReadAction(notificationId: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = String(notificationId ?? "").trim();

    if (!id) return toActionError(new Error("Missing notification"));

    const message = await markNotificationRead(id, user.uid);

    revalidatePath("/notifications");

    return ok(undefined, message);
  } catch (error) {
    return toActionError(error);
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ updated: number }>> {
  try {
    const user = await requireUser();
    const result = await markAllNotificationsRead(user.uid);

    revalidatePath("/notifications");

    return ok({ updated: result.updated }, result.message);
  } catch (error) {
    return toActionError(error);
  }
}

/** Powers the unread badge, which refreshes without a full page load. */
export async function fetchNotificationsAction(): Promise<ActionResult<NotificationItem[]>> {
  try {
    const user = await requireUser();
    return ok(await listNotifications(user.uid));
  } catch (error) {
    return toActionError(error);
  }
}

/* ------------------------------------------------------------------- Chat */

export async function sendChatMessageAction(input: unknown): Promise<ActionResult<ChatMessage>> {
  try {
    const user = await requireUser();
    const { gameId, message } = chatMessageSchema.parse(input);
    const created = await sendChatMessage(
      gameId,
      { uid: user.uid, displayName: user.displayName },
      message
    );

    return ok(created);
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Read path for chat when the realtime listener is unavailable — for example
 * before the Firestore rules for `games/{id}/chat` have been deployed. The
 * Admin SDK ignores rules, so this always works.
 */
export async function fetchChatMessagesAction(gameId: unknown): Promise<ActionResult<ChatMessage[]>> {
  try {
    const user = await requireUser();
    const id = gameIdSchema.parse(gameId);

    return ok(await getChatMessages(id, user.uid));
  } catch (error) {
    return toActionError(error);
  }
}
