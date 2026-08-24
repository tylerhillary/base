"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Callout, Meter, Panel, PanelBody, PanelHead } from "@/components/ui/primitives";
import { useAuth } from "@/components/auth/auth-context";
import { useToast } from "@/providers/toast-provider";
import { useNotifications } from "@/providers/notifications-provider";
import {
  cancelGameAction,
  joinGameAction,
  leaveGameAction,
  removeVoteAction,
  voteAction
} from "@/app/actions/games";
import { downloadCalendarEvent } from "@/lib/ics";
import { getSport } from "@/lib/sports";
import type { GameDetail } from "@/types/domain";
import styles from "./game-detail.module.css";

type Action = "vote" | "unvote" | "join" | "leave" | "cancel";

export const GameActions = ({ game }: { game: GameDetail }) => {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { refresh: refreshNotifications } = useNotifications();

  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [, startTransition] = useTransition();

  const userId = user?.uid ?? "";
  const sport = getSport(game.sport);

  const state = useMemo(() => {
    const membership = game.participants.find((participant) => participant.userId === userId);
    const votingClosed = new Date(game.votingEndsAt).getTime() <= Date.now();
    const finished = game.status === "cancelled" || game.status === "completed";

    return {
      membership,
      hasVoted: game.voterUserIds.includes(userId),
      isCreator: game.createdBy === userId,
      votingClosed,
      finished,
      canVote: Boolean(userId) && game.status === "proposed" && !votingClosed,
      canJoin: Boolean(userId) && !finished && !membership
    };
  }, [game, userId]);

  const votesToGo = Math.max(0, game.voteThreshold - game.voteCount);

  const run = (action: Action) => {
    if (!userId) {
      toast.error("Sign in first", "You need an account to take part in a game.");
      return;
    }

    setPendingAction(action);

    void (async () => {
      try {
        /*
         * Server actions resolve to a result object rather than throwing, so a
         * failure carries a message written for the player instead of a stack
         * trace. The acting user comes from the session cookie server-side —
         * nothing here sends a uid.
         */
        switch (action) {
          case "vote": {
            const result = await voteAction(game.id);
            if (!result.ok) return toast.error("Could not vote", result.message);

            toast.toast({
              title: result.data.confirmed ? "This game is confirmed" : "Vote counted",
              description: result.message,
              tone: result.data.confirmed ? "gold" : "success"
            });
            break;
          }
          case "unvote": {
            const result = await removeVoteAction(game.id);
            if (!result.ok) return toast.error("Could not withdraw", result.message);

            toast.info("Vote withdrawn", "You can vote again while the window is open.");
            break;
          }
          case "join": {
            const result = await joinGameAction(game.id);
            if (!result.ok) return toast.error("Could not join", result.message);

            toast.success(
              result.data.status === "joined" ? "You are on the roster" : "Added to the waitlist",
              result.message
            );
            break;
          }
          case "leave": {
            const result = await leaveGameAction(game.id);
            if (!result.ok) return toast.error("Could not leave", result.message);

            toast.info("You left the game", result.message);
            break;
          }
          case "cancel": {
            const result = await cancelGameAction(game.id);
            if (!result.ok) return toast.error("Could not cancel", result.message);

            toast.info("Game cancelled", result.message);
            break;
          }
        }

        startTransition(() => router.refresh());
        void refreshNotifications();
      } finally {
        setPendingAction(null);
      }
    })();
  };

  const share = async () => {
    const url = `${window.location.origin}/games/${game.id}`;
    const shareData = {
      title: game.title,
      text: `${game.title} — ${sport.label} at ${game.location.label}`,
      url
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      toast.success("Link copied", "Paste it into your group chat.");
    } catch (error) {
      // A cancelled share sheet is not a failure worth reporting.
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("Could not share", "Copy the address bar link instead.");
    }
  };

  return (
    <Panel>
      <PanelHead title="Take part" icon="zap" />

      <PanelBody className={styles.actionStack}>
        {!user ? (
          <Callout tone="warn">
            Sign in to vote, join the roster and use the game chat.
          </Callout>
        ) : null}

        {game.status === "cancelled" ? (
          <Callout tone="danger">This game was cancelled by its organiser.</Callout>
        ) : null}

        {game.status === "confirmed" ? (
          <Callout tone="success">
            Confirmed. {game.participantCount} of {game.maxPlayers} players are locked in.
          </Callout>
        ) : null}

        {game.status === "proposed" ? (
          <div className={styles.voteBlock}>
            <div className={styles.voteBlockBody}>
              <p className={styles.voteBlockValue}>
                {game.voteCount}
                <span>/ {game.voteThreshold}</span>
              </p>
              <p className={styles.voteBlockLabel}>
                {state.votingClosed
                  ? "Voting closed"
                  : votesToGo === 0
                    ? "Threshold reached"
                    : `${votesToGo} more to confirm`}
              </p>
              <Meter
                value={game.voteCount}
                max={game.voteThreshold}
                tint="var(--accent)"
                label="Progress to confirmation"
                style={{ marginTop: "0.6rem" }}
              />
            </div>
          </div>
        ) : null}

        {state.hasVoted ? (
          <Button
            variant="outline"
            block
            busy={pendingAction === "unvote"}
            busyLabel="Withdrawing…"
            disabled={state.votingClosed || game.status !== "proposed"}
            onClick={() => run("unvote")}
          >
            <Icon name="check" size={16} strokeWidth={2.4} />
            You voted — withdraw
          </Button>
        ) : (
          <Button
            variant="primary"
            block
            busy={pendingAction === "vote"}
            busyLabel="Voting…"
            disabled={!state.canVote}
            onClick={() => run("vote")}
          >
            <Icon name="vote" size={17} />
            {state.votingClosed && game.status === "proposed" ? "Voting closed" : "Vote for this game"}
          </Button>
        )}

        {state.membership ? (
          <Button
            variant="secondary"
            block
            busy={pendingAction === "leave"}
            busyLabel="Leaving…"
            disabled={state.isCreator || state.finished}
            onClick={() => run("leave")}
          >
            <Icon name="userMinus" size={17} />
            {state.isCreator
              ? "You are the organiser"
              : state.membership.status === "joined"
                ? "Leave the roster"
                : "Leave the waitlist"}
          </Button>
        ) : (
          <Button
            variant="secondary"
            block
            busy={pendingAction === "join"}
            busyLabel="Joining…"
            disabled={!state.canJoin}
            onClick={() => run("join")}
          >
            <Icon name="userPlus" size={17} />
            {game.participantCount >= game.maxPlayers ? "Join the waitlist" : "Join this game"}
          </Button>
        )}

        <div className={styles.secondaryActions}>
          <Button variant="ghost" onClick={share}>
            <Icon name="share" size={16} />
            Share
          </Button>
          <Button variant="ghost" onClick={() => downloadCalendarEvent(game)}>
            <Icon name="calendar" size={16} />
            Add to calendar
          </Button>
        </div>

        {state.isCreator && !state.finished ? (
          <div className={styles.dangerZone}>
            <Button
              variant="danger"
              block
              busy={pendingAction === "cancel"}
              busyLabel="Cancelling…"
              onClick={() => {
                if (
                  window.confirm(
                    "Cancel this game? Everyone on the roster will be notified and it cannot be undone."
                  )
                ) {
                  run("cancel");
                }
              }}
            >
              <Icon name="close" size={16} strokeWidth={2.2} />
              Cancel this game
            </Button>
          </div>
        ) : null}

        {state.finished ? (
          <ButtonLink href="/" variant="ghost" block>
            <Icon name="compass" size={16} />
            Find another game
          </ButtonLink>
        ) : null}
      </PanelBody>
    </Panel>
  );
};
