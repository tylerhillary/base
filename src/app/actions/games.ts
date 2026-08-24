"use server";

import { revalidatePath } from "next/cache";

import type { GameSummary } from "@/types/domain";
import * as games from "@/server/games";
import { requireUser } from "@/server/session";
import { createGameSchema, gameIdSchema, inviteSchema, kickSchema } from "@/server/validators";
import { ok, toActionError, type ActionResult } from "@/server/errors";

/**
 * Mutations for games.
 *
 * Every action derives the acting user from the session cookie rather than a
 * uid supplied by the caller, so a client cannot act as somebody else. Actions
 * are real HTTP endpoints, so each one re-validates its input.
 */

/** Refresh every surface a game can appear on. */
const revalidateGame = (gameId?: string) => {
  revalidatePath("/");
  revalidatePath("/votes");
  revalidatePath("/profile");
  if (gameId) revalidatePath(`/games/${gameId}`);
};

/**
 * Read path for client components that need the game list without a page
 * navigation — currently the command palette.
 */
export async function listGamesAction(limit = 60): Promise<ActionResult<GameSummary[]>> {
  try {
    await requireUser();
    return ok(await games.listGames({ limit }));
  } catch (error) {
    return toActionError(error);
  }
}

export async function createGameAction(input: unknown): Promise<ActionResult<GameSummary>> {
  try {
    const user = await requireUser();
    const payload = createGameSchema.parse(input);
    const game = await games.createGame(payload, {
      uid: user.uid,
      displayName: user.displayName
    });

    revalidateGame(game.id);

    return ok(game, "Game created and open for voting");
  } catch (error) {
    return toActionError(error);
  }
}

export async function voteAction(gameId: unknown): Promise<ActionResult<{ confirmed: boolean; voteCount: number }>> {
  try {
    const user = await requireUser();
    const id = gameIdSchema.parse(gameId);
    const result = await games.castVote(id, user.uid);

    revalidateGame(id);

    return ok({ confirmed: result.confirmed, voteCount: result.voteCount }, result.message);
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeVoteAction(gameId: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = gameIdSchema.parse(gameId);
    const message = await games.removeVote(id, user.uid);

    revalidateGame(id);

    return ok(undefined, message);
  } catch (error) {
    return toActionError(error);
  }
}

export async function joinGameAction(gameId: unknown): Promise<ActionResult<{ status: string }>> {
  try {
    const user = await requireUser();
    const id = gameIdSchema.parse(gameId);
    const result = await games.joinGame(id, { uid: user.uid, displayName: user.displayName });

    revalidateGame(id);

    return ok({ status: result.status }, result.message);
  } catch (error) {
    return toActionError(error);
  }
}

export async function leaveGameAction(gameId: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = gameIdSchema.parse(gameId);
    const message = await games.leaveGame(id, user.uid);

    revalidateGame(id);

    return ok(undefined, message);
  } catch (error) {
    return toActionError(error);
  }
}

export async function kickPlayerAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { gameId, participantUserId } = kickSchema.parse(input);
    const message = await games.kickPlayer(gameId, user.uid, participantUserId);

    revalidateGame(gameId);

    return ok(undefined, message);
  } catch (error) {
    return toActionError(error);
  }
}

export async function invitePlayerAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { gameId, email } = inviteSchema.parse(input);
    const message = await games.invitePlayer(gameId, email, user.uid);

    revalidateGame(gameId);

    return ok(undefined, message);
  } catch (error) {
    return toActionError(error);
  }
}

export async function cancelGameAction(gameId: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = gameIdSchema.parse(gameId);
    const message = await games.cancelGame(id, user.uid);

    revalidateGame(id);

    return ok(undefined, message);
  } catch (error) {
    return toActionError(error);
  }
}
