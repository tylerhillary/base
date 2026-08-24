"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Avatar,
  Badge,
  EmptyState,
  Meter,
  Panel,
  PanelBody,
  PanelHead
} from "@/components/ui/primitives";
import { useAuth } from "@/components/auth/auth-context";
import { useToast } from "@/providers/toast-provider";
import { invitePlayerAction, kickPlayerAction } from "@/app/actions/games";
import { relativeTime } from "@/lib/format";
import { getSport } from "@/lib/sports";
import type { GameDetail, GameParticipant } from "@/types/domain";
import styles from "./game-detail.module.css";

interface PlayerRowProps {
  participant: GameParticipant;
  isYou: boolean;
  isOrganiser: boolean;
  canRemove: boolean;
  removing: boolean;
  onRemove: () => void;
  waitlisted?: boolean;
}

const PlayerRow = ({
  participant,
  isYou,
  isOrganiser,
  canRemove,
  removing,
  onRemove,
  waitlisted
}: PlayerRowProps) => (
  <div className={styles.player}>
    <Avatar name={participant.displayName} seed={participant.userId} size="sm" />

    <span className={styles.playerBody}>
      <span className={styles.playerName}>
        {participant.displayName}
        {isYou ? <span className={styles.you}>You</span> : null}
        {isOrganiser ? (
          <Badge tone="gold" icon="trophy">
            Organiser
          </Badge>
        ) : null}
      </span>
      <span className={styles.playerMeta}>
        {waitlisted ? "Waiting since" : "Joined"} {relativeTime(participant.joinedAt)}
      </span>
    </span>

    {canRemove ? (
      <button
        type="button"
        className={styles.playerAction}
        onClick={onRemove}
        disabled={removing}
        aria-label={`Remove ${participant.displayName}`}
        title={`Remove ${participant.displayName}`}
      >
        <Icon name={removing ? "refresh" : "close"} size={15} strokeWidth={2.2} />
      </button>
    ) : null}
  </div>
);

export const GameRoster = ({ game }: { game: GameDetail }) => {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [, startTransition] = useTransition();

  const userId = user?.uid ?? "";
  const isCreator = game.createdBy === userId;
  const sport = getSport(game.sport);

  const joined = game.participants.filter((participant) => participant.status === "joined");
  const waitlisted = game.participants.filter((participant) => participant.status === "waitlisted");

  const handleRemove = async (participant: GameParticipant) => {
    if (!window.confirm(`Remove ${participant.displayName} from this game?`)) return;

    setRemovingId(participant.userId);
    try {
      const result = await kickPlayerAction({
        gameId: game.id,
        participantUserId: participant.userId
      });

      if (!result.ok) {
        toast.error("Could not remove that player", result.message);
        return;
      }

      toast.info("Player removed", result.message);
      startTransition(() => router.refresh());
    } finally {
      setRemovingId(null);
    }
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();

    const email = inviteEmail.trim();
    if (!email) return;

    setInviting(true);
    try {
      const result = await invitePlayerAction({ gameId: game.id, email });

      if (!result.ok) {
        toast.error("Invite failed", result.message);
        return;
      }

      setInviteEmail("");
      toast.success("Invite sent", result.message);
      startTransition(() => router.refresh());
    } finally {
      setInviting(false);
    }
  };

  return (
    <>
      {isCreator ? (
        <Panel>
          <PanelHead title="Invite a player" icon="userPlus" />
          <PanelBody>
            <form className={styles.inviteForm} onSubmit={handleInvite}>
              <input
                type="email"
                className={styles.inviteInput}
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="player@example.com"
                aria-label="Player email"
                disabled={inviting}
                required
              />
              <Button
                type="submit"
                variant="primary"
                busy={inviting}
                busyLabel="Sending…"
                disabled={!inviteEmail.trim()}
              >
                <Icon name="send" size={16} />
                Invite
              </Button>
            </form>
            <p className="u-section-sub" style={{ marginTop: "0.75rem" }}>
              They need a BASE-0 account. Invited players go straight onto the roster, or the
              waitlist when it is full.
            </p>
          </PanelBody>
        </Panel>
      ) : null}

      <Panel>
        <PanelHead
          title="On the roster"
          icon="users"
          action={
            <Badge tint={sport.color}>
              {joined.length}/{game.maxPlayers}
            </Badge>
          }
        />

        <div className={styles.rosterMeter}>
          <span className={styles.rosterMeterTop}>
            <b>{joined.length}</b>
            <span>of {game.maxPlayers} confirmed</span>
            <em>
              {Math.max(0, game.maxPlayers - joined.length)} open
            </em>
          </span>
          <Meter
            value={joined.length}
            max={game.maxPlayers}
            tint={sport.color}
            label="Roster fill"
          />
        </div>

        {joined.length > 0 ? (
          <div className={styles.players}>
            {joined.map((participant) => (
              <PlayerRow
                key={participant.userId}
                participant={participant}
                isYou={participant.userId === userId}
                isOrganiser={participant.userId === game.createdBy}
                canRemove={isCreator && participant.userId !== game.createdBy}
                removing={removingId === participant.userId}
                onRemove={() => handleRemove(participant)}
              />
            ))}
          </div>
        ) : (
          <PanelBody>
            <EmptyState
              inline
              icon="users"
              title="Nobody has joined yet"
              description="Be the first on the roster and the rest usually follow."
            />
          </PanelBody>
        )}
      </Panel>

      {waitlisted.length > 0 ? (
        <Panel>
          <PanelHead
            title="Waitlist"
            icon="clock"
            action={<Badge tone="muted">{waitlisted.length} waiting</Badge>}
          />
          <div className={styles.players}>
            {waitlisted.map((participant) => (
              <PlayerRow
                key={participant.userId}
                participant={participant}
                isYou={participant.userId === userId}
                isOrganiser={false}
                canRemove={isCreator}
                removing={removingId === participant.userId}
                onRemove={() => handleRemove(participant)}
                waitlisted
              />
            ))}
          </div>
          <PanelBody>
            <p className="u-section-sub">
              The longest-waiting player is promoted automatically whenever a spot opens up.
            </p>
          </PanelBody>
        </Panel>
      ) : null}
    </>
  );
};
