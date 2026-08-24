# Firestore schema

All writes go through the Express API using the Firebase Admin SDK, so counters
(`participantCount`, `waitlistCount`, `voteCount`) are only ever changed inside a transaction
and stay consistent with the subcollections they summarise.

## `users/{uid}`

Document id is the Firebase Auth uid.

| Field | Type | Notes |
| --- | --- | --- |
| `displayName` | string | Shown on rosters and chat messages. |
| `email` | string | Lower-cased. Used by the invite-by-email lookup. |
| `bio` | string | Optional. |
| `homeLocation` | `{ label, lat, lng, placeId? }` | The profile form edits `label` only and leaves coordinates untouched. |
| `sportsInterests` | `SportType[]` | At least one. |
| `ratings` | `{ reliabilityScore, sportsmanshipScore, gamesJoined, noShows }` | Scores are 0–5. |
| `createdAt` / `updatedAt` | Timestamp | |

## `games/{gameId}`

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | 3–120 characters. |
| `description` | string? | Up to 1000 characters. |
| `sport` | `SportType` | `football \| basketball \| tennis \| volleyball \| running \| other` |
| `status` | `GameStatus` | `proposed \| confirmed \| cancelled \| completed` |
| `createdBy` | string | Organiser uid. |
| `createdByName` | string? | Denormalised so cards can credit the organiser without a second read. |
| `scheduledFor` | Timestamp | Kickoff. |
| `votingEndsAt` | Timestamp | Must be before `scheduledFor`. |
| `maxPlayers` | number | 2–100. |
| `participantCount` | number | Participants with status `joined`. Starts at 1 — the organiser. |
| `waitlistCount` | number | Participants with status `waitlisted`. |
| `voteCount` | number | Size of the `votes` subcollection. |
| `voteThreshold` | number? | Votes needed to auto-confirm. Derived as `max(2, ceil(maxPlayers / 2))` when absent. |
| `confirmedAt` / `cancelledAt` | Timestamp? | Set when the status changes. |
| `location` | `{ label, address, lat, lng, placeId? }` | Coordinates drive distance sorting and the maps link. |
| `createdAt` / `updatedAt` | Timestamp | |

### `games/{gameId}/participants/{uid}`

Keyed by uid, so membership is a document read rather than a query — and a player cannot
appear twice.

| Field | Type | Notes |
| --- | --- | --- |
| `gameId` | string | |
| `userId` | string | Matches the document id. Indexed as a collection group for profile lookups. |
| `displayName` | string? | |
| `status` | `joined \| waitlisted \| invited \| declined` | |
| `joinedAt` | Timestamp | Waitlist promotion order. |
| `promotedAt` | Timestamp? | Set when moved off the waitlist. |

### `games/{gameId}/votes/{uid}`

Keyed by uid, which is what enforces one vote per player.

| Field | Type |
| --- | --- |
| `gameId` | string |
| `userId` | string |
| `vote` | `"upvote"` |
| `createdAt` | Timestamp |

### `games/{gameId}/chat/{messageId}`

The only collection the browser subscribes to directly.

| Field | Type | Notes |
| --- | --- | --- |
| `gameId` | string | |
| `senderUserId` | string | |
| `senderDisplayName` | string? | Denormalised so reading a thread is a single query. |
| `message` | string | Trimmed, up to 1000 characters. |
| `createdAt` | Timestamp | |

## `notifications/{notificationId}`

| Field | Type | Notes |
| --- | --- | --- |
| `recipientUserId` | string | |
| `type` | `invite \| vote_update \| waitlist_update \| game_confirmed \| chat_message` | |
| `title` / `body` | string | |
| `read` | boolean | |
| `readAt` | Timestamp? | |
| `gameId` | string? | Renders the "Open game" link. |
| `createdAt` | Timestamp | |

## Indexes

`firestore.indexes.json` declares:

- `games` by `(sport, status, scheduledFor)` and `(createdBy, scheduledFor)`
- `notifications` by `(recipientUserId, createdAt)` and `(recipientUserId, read, createdAt)`
- `participants` by `(status, joinedAt)` — waitlist promotion order
- Collection-group indexes on `participants.userId` and `votes.userId` — the profile page

Every query that needs one of these has a fallback path, so the app still works before the
indexes finish building.
