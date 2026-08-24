import { z } from "zod";

/**
 * Every server action validates its input here.
 *
 * Actions are public HTTP endpoints — Next generates one per exported async
 * function — so nothing may be trusted just because the UI sent it.
 */

const sportSchema = z.enum(["football", "basketball", "tennis", "volleyball", "running", "other"]);
const statusSchema = z.enum(["proposed", "confirmed", "cancelled", "completed"]);

/*
 * Coordinates are optional: organisers type a venue name and address, and only
 * get a lat/lng if they choose to pin their current spot. Absent coordinates
 * store as 0/0, which `hasCoordinates` treats as "not pinned".
 */
const locationSchema = z.object({
  label: z.string().trim().min(2, "Give the venue a name").max(120),
  address: z.string().trim().min(3, "Add an address so people can find it").max(200),
  placeId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).catch(0).default(0),
  lng: z.coerce.number().min(-180).max(180).catch(0).default(0)
});

export const createGameSchema = z
  .object({
    title: z.string().trim().min(3, "Give the game a title of at least 3 characters").max(120),
    description: z.string().trim().max(1000).optional(),
    sport: sportSchema,
    scheduledFor: z.string().datetime(),
    votingEndsAt: z.string().datetime(),
    maxPlayers: z.coerce.number().int().min(2, "At least 2 players").max(100, "At most 100 players"),
    location: locationSchema
  })
  .refine((input) => new Date(input.votingEndsAt) < new Date(input.scheduledFor), {
    message: "Voting must close before the game starts",
    path: ["votingEndsAt"]
  })
  .refine((input) => new Date(input.scheduledFor).getTime() > Date.now(), {
    message: "The game must be scheduled in the future",
    path: ["scheduledFor"]
  });

export const listGamesQuerySchema = z.object({
  sport: sportSchema.optional(),
  status: statusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const gameIdSchema = z.string().trim().min(1, "Missing game");

export const inviteSchema = z.object({
  gameId: gameIdSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email address")
});

export const kickSchema = z.object({
  gameId: gameIdSchema,
  participantUserId: z.string().trim().min(1)
});

export const chatMessageSchema = z.object({
  gameId: gameIdSchema,
  message: z.string().trim().min(1, "Write a message first").max(1000, "Messages are capped at 1000 characters")
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Names need at least 2 characters").max(80).optional(),
  bio: z.string().trim().max(500, "Bios are capped at 500 characters").optional(),
  /** The profile form sends a plain place name; coordinates are optional. */
  homeLocation: z
    .union([
      z.string().trim().max(120),
      z.object({
        label: z.string().trim().min(1).max(120),
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180)
      })
    ])
    .optional(),
  sportsInterests: z.array(sportSchema).min(1, "Pick at least one sport").max(10).optional()
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type ListGamesQuery = z.infer<typeof listGamesQuerySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
