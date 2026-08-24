export type SportType =
  | "football"
  | "basketball"
  | "tennis"
  | "volleyball"
  | "running"
  | "other";

export type GameStatus = "proposed" | "confirmed" | "cancelled" | "completed";
export type ParticipantStatus = "joined" | "waitlisted" | "invited" | "declined";

export type NotificationType =
  | "invite"
  | "vote_update"
  | "waitlist_update"
  | "game_confirmed"
  | "chat_message";

export interface GameLocation {
  label: string;
  address: string;
  placeId?: string;
  lat: number;
  lng: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  bio: string;
  sportsInterests: SportType[];
  reliabilityScore: number;
  sportsmanshipScore: number;
  gamesJoined: number;
  noShows: number;
  homeLocation: string;
  recentGames: GameSummary[];
  gamesCreated: GameSummary[];
  gamesVoted: GameSummary[];
  gamesPlayed: GameSummary[];
}

export interface GameSummary {
  id: string;
  title: string;
  description: string;
  sport: SportType;
  status: GameStatus;
  createdBy: string;
  createdByName?: string;
  scheduledFor: string;
  votingEndsAt: string;
  voteCount: number;
  participantCount: number;
  waitlistCount: number;
  maxPlayers: number;
  location: GameLocation;
  createdAt: string;
  updatedAt: string;
}

export interface GameParticipant {
  userId: string;
  displayName: string;
  status: ParticipantStatus;
  joinedAt: string;
  promotedAt: string | null;
}

export interface GameDetail extends GameSummary {
  participants: GameParticipant[];
  /** Ids of everyone who has voted — lets the client show "you voted" without a second call. */
  voterUserIds: string[];
  /** Votes needed before the game flips to `confirmed`. */
  voteThreshold: number;
}

export interface JoinGameResult {
  success: true;
  status: "joined" | "waitlisted";
  message: string;
}

export interface VoteResult {
  success: true;
  message: string;
  voteCount: number;
  status: GameStatus;
  confirmed: boolean;
}

export interface ActionResult {
  success: boolean;
  message: string;
}

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  gameId?: string;
  createdAt: string;
}

export interface CreateGamePayload {
  title: string;
  description?: string;
  sport: SportType;
  createdBy: string;
  createdByName?: string;
  scheduledFor: string;
  votingEndsAt: string;
  maxPlayers: number;
  location: GameLocation;
}

export interface UpdateProfilePayload {
  displayName?: string;
  bio?: string;
  homeLocation?: string;
  sportsInterests?: SportType[];
}

export interface ChatMessage {
  id: string;
  gameId: string;
  senderUserId: string;
  senderDisplayName: string;
  message: string;
  /** Epoch milliseconds. `null` while a local write awaits its server timestamp. */
  createdAt: number | null;
  pending?: boolean;
}
