import type { Timestamp } from "firebase-admin/firestore";

import type { GameStatus, ParticipantStatus, SportType } from "@/types/domain";

/**
 * Shapes of the documents as they are stored in Firestore.
 *
 * These use Firestore `Timestamp`s; the serialised forms handed to components
 * live in `@/types/domain` and use ISO strings, because Server Components can
 * only pass plain JSON-serialisable values to Client Components.
 */

export interface UserDocument {
  displayName: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  homeLocation: {
    lat: number;
    lng: number;
    placeId?: string;
    label: string;
  };
  sportsInterests: SportType[];
  ratings: {
    reliabilityScore: number;
    sportsmanshipScore: number;
    gamesJoined: number;
    noShows: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GameDocument {
  title: string;
  description?: string;
  sport: SportType;
  status: GameStatus;
  createdBy: string;
  createdByName?: string;
  scheduledFor: Timestamp;
  votingEndsAt: Timestamp;
  maxPlayers: number;
  participantCount: number;
  waitlistCount: number;
  voteCount: number;
  /** Votes required before the game auto-confirms. */
  voteThreshold?: number;
  confirmedAt?: Timestamp;
  cancelledAt?: Timestamp;
  location: {
    label: string;
    address: string;
    placeId?: string;
    lat: number;
    lng: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface VoteDocument {
  gameId: string;
  userId: string;
  vote: "upvote";
  createdAt: Timestamp;
}

export interface ParticipantDocument {
  gameId: string;
  userId: string;
  displayName?: string;
  status: ParticipantStatus;
  joinedAt: Timestamp;
  promotedAt?: Timestamp;
}

export interface ChatMessageDocument {
  gameId: string;
  senderUserId: string;
  senderDisplayName?: string;
  message: string;
  createdAt: Timestamp;
}

export type NotificationType =
  | "invite"
  | "vote_update"
  | "waitlist_update"
  | "game_confirmed"
  | "chat_message";

export interface NotificationDocument {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  gameId?: string;
  createdAt: Timestamp;
  readAt?: Timestamp;
}
