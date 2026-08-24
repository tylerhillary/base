import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import type { NotificationItem } from "@/types/domain";
import { collections, getDb } from "./firebase";
import { forbidden, notFound } from "./errors";
import type { NotificationDocument, NotificationType } from "./types";

interface CreateNotificationInput {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  gameId?: string;
}

const serialize = (id: string, notification: NotificationDocument): NotificationItem => ({
  id,
  recipientUserId: notification.recipientUserId,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  read: Boolean(notification.read),
  gameId: notification.gameId,
  createdAt: notification.createdAt.toDate().toISOString()
});

export const createNotification = async (input: CreateNotificationInput): Promise<void> => {
  await collections.notifications.add({
    recipientUserId: input.recipientUserId,
    type: input.type,
    title: input.title,
    body: input.body,
    read: false,
    ...(input.gameId ? { gameId: input.gameId } : {}),
    createdAt: Timestamp.now()
  } satisfies NotificationDocument);
};

export const listNotifications = async (userId: string): Promise<NotificationItem[]> => {
  const byRecipient = collections.notifications.where("recipientUserId", "==", userId);

  // The ordered query wants a composite index; without it we still return data.
  const snapshot = await byRecipient
    .orderBy("createdAt", "desc")
    .limit(100)
    .get()
    .catch(() => byRecipient.limit(100).get());

  return snapshot.docs
    .map((document) => serialize(document.id, document.data() as NotificationDocument))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
};

export const countUnread = async (userId: string): Promise<number> => {
  const unread = collections.notifications
    .where("recipientUserId", "==", userId)
    .where("read", "==", false);

  try {
    // Aggregation reads one number instead of every matching document.
    const snapshot = await unread.count().get();
    return snapshot.data().count;
  } catch {
    const all = await listNotifications(userId);
    return all.filter((notification) => !notification.read).length;
  }
};

export const markNotificationRead = async (notificationId: string, userId: string) => {
  const reference = collections.notifications.doc(notificationId);
  const snapshot = await reference.get();

  if (!snapshot.exists) throw notFound("Notification not found");

  if ((snapshot.data() as NotificationDocument).recipientUserId !== userId) {
    throw forbidden("This notification belongs to someone else");
  }

  await reference.update({ read: true, readAt: Timestamp.now() });

  return "Marked as read";
};

export const markAllNotificationsRead = async (userId: string) => {
  const unread = await collections.notifications
    .where("recipientUserId", "==", userId)
    .where("read", "==", false)
    .limit(400)
    .get()
    .catch(() => collections.notifications.where("recipientUserId", "==", userId).limit(400).get());

  const pending = unread.docs.filter((document) => !(document.data() as NotificationDocument).read);

  if (pending.length === 0) {
    return { updated: 0, message: "Nothing left to read" };
  }

  const now = Timestamp.now();
  const batch = getDb().batch();
  for (const document of pending) {
    batch.update(document.ref, { read: true, readAt: now });
  }
  await batch.commit();

  return {
    updated: pending.length,
    message: `Marked ${pending.length} ${pending.length === 1 ? "update" : "updates"} as read`
  };
};
