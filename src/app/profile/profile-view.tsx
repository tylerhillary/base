"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

import { GameCard } from "@/components/games/game-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChipGroup, TextAreaField, TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { SportMark } from "@/components/ui/sport-mark";
import {
  Avatar,
  Callout,
  EmptyState,
  Meter,
  Panel,
  PanelBody,
  PanelHead,
  StatTile
} from "@/components/ui/primitives";
import { useAuth } from "@/components/auth/auth-context";
import { useToast } from "@/providers/toast-provider";
import { updateProfileAction } from "@/app/actions/account";
import { SPORTS, getSport } from "@/lib/sports";
import type { GameSummary, SportType, UserProfile } from "@/types/domain";
import styles from "./profile.module.css";

type Tab = "all" | "created" | "voted" | "played";

const TABS: Array<{ value: Tab; label: string; icon: "grid" | "plus" | "vote" | "users" }> = [
  { value: "all", label: "Everything", icon: "grid" },
  { value: "created", label: "Organised", icon: "plus" },
  { value: "voted", label: "Voted", icon: "vote" },
  { value: "played", label: "Joined", icon: "users" }
];

const SPORT_OPTIONS = SPORTS.map((sport) => ({
  value: sport.value,
  label: sport.label,
  tint: sport.color,
  icon: <SportMark sport={sport.value} size={16} />
}));

const blankForm = (data: UserProfile) => ({
  displayName: data.displayName || "",
  bio: data.bio || "",
  homeLocation: data.homeLocation === "Not set" ? "" : data.homeLocation || "",
  sportsInterests: (data.sportsInterests?.length ? data.sportsInterests : ["football"]) as SportType[]
});

/**
 * Rendering half of the profile. The data arrives already loaded from the
 * server component next door, so there is no client-side fetch and no spinner.
 */
export const ProfileView = ({ initialProfile }: { initialProfile: UserProfile }) => {
  const { user } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("all");

  const [form, setForm] = useState(() => blankForm(initialProfile));

  const activity = useMemo(() => {
    if (!profile) return [] as GameSummary[];

    const byRecency = (left: GameSummary, right: GameSummary) =>
      new Date(right.scheduledFor).getTime() - new Date(left.scheduledFor).getTime();

    switch (tab) {
      case "created":
        return [...(profile.gamesCreated ?? [])].sort(byRecency);
      case "voted":
        return [...(profile.gamesVoted ?? [])].sort(byRecency);
      case "played":
        return [...(profile.gamesPlayed ?? [])].sort(byRecency);
      default:
        return [
          ...new Map(
            [
              ...(profile.gamesCreated ?? []),
              ...(profile.gamesVoted ?? []),
              ...(profile.gamesPlayed ?? [])
            ].map((game) => [game.id, game])
          ).values()
        ].sort(byRecency);
    }
  }, [profile, tab]);

  const tabCounts: Record<Tab, number> = {
    all: new Set(
      [
        ...(profile?.gamesCreated ?? []),
        ...(profile?.gamesVoted ?? []),
        ...(profile?.gamesPlayed ?? [])
      ].map((game) => game.id)
    ).size,
    created: profile?.gamesCreated?.length ?? 0,
    voted: profile?.gamesVoted?.length ?? 0,
    played: profile?.gamesPlayed?.length ?? 0
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (form.displayName.trim().length < 2) {
      toast.error("Name is too short", "Use at least two characters.");
      return;
    }

    if (form.sportsInterests.length === 0) {
      toast.error("Pick at least one sport", "It helps the community find you the right games.");
      return;
    }

    setSaving(true);
    try {
      const result = await updateProfileAction({
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        homeLocation: form.homeLocation.trim(),
        sportsInterests: form.sportsInterests
      });

      if (!result.ok) {
        toast.error("Could not save", result.message);
        return;
      }

      // The save returns a light profile; keep the activity lists we already have.
      const updated = result.data;
      setProfile((current) => ({
        ...updated,
        recentGames: updated.recentGames?.length ? updated.recentGames : current.recentGames,
        gamesCreated: updated.gamesCreated?.length ? updated.gamesCreated : current.gamesCreated,
        gamesVoted: updated.gamesVoted?.length ? updated.gamesVoted : current.gamesVoted,
        gamesPlayed: updated.gamesPlayed?.length ? updated.gamesPlayed : current.gamesPlayed
      }));

      setEditing(false);
      toast.success("Profile saved", "Your details are up to date.");
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Player";
  const reliability = profile?.reliabilityScore ?? 5;
  const sportsmanship = profile?.sportsmanshipScore ?? 5;
  const attendance =
    profile && profile.gamesJoined > 0
      ? Math.round(((profile.gamesJoined - profile.noShows) / profile.gamesJoined) * 100)
      : 100;

  return (
    <div className="u-shell u-stack">
      <PageHeader
        eyebrow="Your account"
        eyebrowIcon="user"
        title="Profile"
        lede="Your reputation follows you across every game. Reliable players get promoted off waitlists first."
        backHref="/"
        actions={
          !editing ? (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Icon name="edit" size={16} />
              Edit profile
            </Button>
          ) : null
        }
      />



      {/* ------------------------------------------------------- Banner */}
      <section className={styles.banner}>
        <div className={styles.bannerIdentity}>
          <span className={styles.avatarWrap}>
            <Avatar name={displayName} seed={user?.uid ?? displayName} size="xl" title={displayName} />
            <span className={styles.avatarBadge}>
              <Icon name="trophy" size={15} strokeWidth={2.2} />
            </span>
          </span>

          <div className={styles.identity}>
            <h2 className={styles.name}>{displayName}</h2>
            <p className={styles.email}>{profile?.email || user?.email}</p>
            <p className={styles.bio}>
              {profile?.bio || "No bio yet — tell the community how and when you like to play."}
            </p>

            <div className={styles.metaRow}>
              <span className={styles.meta}>
                <Icon name="mapPin" size={15} />
                {profile?.homeLocation && profile.homeLocation !== "Not set"
                  ? profile.homeLocation
                  : "Location not set"}
              </span>
              <span className={styles.meta}>
                <Icon name="ticket" size={15} />
                {tabCounts.all} {tabCounts.all === 1 ? "game" : "games"} on record
              </span>
              <span className={styles.meta}>
                <Icon name="checkCircle" size={15} />
                {attendance}% attendance
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- Edit form */}
      {editing ? (
        <Panel>
          <PanelHead
            title="Edit your details"
            icon="edit"
            action={
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => {
                  if (profile) setForm(blankForm(profile));
                  setEditing(false);
                }}
                aria-label="Close editor"
              >
                <Icon name="close" size={18} />
              </button>
            }
          />

          <form className={styles.form} onSubmit={handleSave}>
            <div className={styles.formGrid}>
              <TextField
                label="Display name"
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="How the roster sees you"
                minLength={2}
                maxLength={80}
                icon="user"
                required
              />
              <TextField
                label="Home area"
                value={form.homeLocation}
                onChange={(event) => setForm((current) => ({ ...current, homeLocation: event.target.value }))}
                placeholder="Surulere, Lagos"
                maxLength={120}
                icon="mapPin"
                hint="Used to describe where you usually play"
                optional
              />
            </div>

            <TextAreaField
              label="Bio"
              value={form.bio}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              placeholder="Weekend football regular. Prefer evening games, always show up."
              maxLength={500}
              showCounter
              optional
            />

            <div>
              <span className={styles.formLabel}>Sports you play</span>
              <ChipGroup
                options={SPORT_OPTIONS}
                selected={form.sportsInterests}
                label="Sports you play"
                onToggle={(value) =>
                  setForm((current) => ({
                    ...current,
                    sportsInterests: current.sportsInterests.includes(value)
                      ? current.sportsInterests.filter((sport) => sport !== value)
                      : [...current.sportsInterests, value]
                  }))
                }
              />
            </div>

            <div className={styles.formActions}>
              <Button
                variant="ghost"
                onClick={() => {
                  if (profile) setForm(blankForm(profile));
                  setEditing(false);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" busy={saving} busyLabel="Saving…">
                <Icon name="check" size={16} strokeWidth={2.4} />
                Save changes
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

      {/* ---------------------------------------------------- Reputation */}
      <section className={styles.reputation} aria-label="Reputation">
        <div className={styles.score}>
          <div className={styles.scoreBody}>
            <p className={styles.scoreValue}>
              {reliability.toFixed(1)}
              <span>/ 5</span>
            </p>
            <p className={styles.scoreLabel}>Reliability</p>
            <Meter value={reliability} max={5} tint="var(--signal-live)" label="Reliability score" />
          </div>
        </div>

        <div className={styles.score}>
          <div className={styles.scoreBody}>
            <p className={styles.scoreValue}>
              {sportsmanship.toFixed(1)}
              <span>/ 5</span>
            </p>
            <p className={styles.scoreLabel}>Sportsmanship</p>
            <Meter value={sportsmanship} max={5} tint="var(--accent)" label="Sportsmanship score" />
          </div>
        </div>

        <StatTile
          icon="users"
          value={profile?.gamesJoined ?? 0}
          label="Games joined"
          hint="Lifetime"
          tint="var(--signal-info)"
        />
        <StatTile
          icon="warning"
          value={profile?.noShows ?? 0}
          label="No-shows"
          hint={profile?.noShows ? "Hurts your reliability" : "Spotless record"}
          tint={profile?.noShows ? "var(--signal-danger)" : "var(--text-subtle)"}
        />
      </section>

      {/* ----------------------------------------------------- Interests */}
      <Panel>
        <PanelHead title="Sports you play" icon="ticket" />
        <PanelBody>
          {profile?.sportsInterests?.length ? (
            <div className={styles.interests}>
              {profile.sportsInterests.map((value) => {
                const sport = getSport(value);
                return (
                  <span
                    key={value}
                    className={styles.interest}
                    style={{ "--tint": sport.color } as CSSProperties}
                  >
                    <SportMark sport={value} size={16} />
                    {sport.label}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="u-section-sub">
              No sports selected yet. Edit your profile to add the ones you play.
            </p>
          )}
        </PanelBody>
      </Panel>

      {/* ------------------------------------------------------ Activity */}
      <section aria-label="Your games">
        <header className="u-section-head">
          <div>
            <p className="u-eyebrow">Your history</p>
            <h2 className="u-section-title">Games you have been part of</h2>
          </div>
        </header>

        <div className={styles.tabs}>
          {TABS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.tab} ${tab === option.value ? styles.tabActive : ""}`}
              onClick={() => setTab(option.value)}
              aria-pressed={tab === option.value}
            >
              <Icon name={option.icon} size={15} />
              {option.label}
              <span className={styles.tabCount}>{tabCounts[option.value]}</span>
            </button>
          ))}
        </div>

        {activity.length > 0 ? (
          <div className={styles.grid}>
            {activity.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="ticket"
            title={
              tab === "created"
                ? "You have not organised a game yet"
                : tab === "voted"
                  ? "You have not voted yet"
                  : tab === "played"
                    ? "You have not joined a game yet"
                    : "No history yet"
            }
            description="Join a match or propose your own — everything you take part in shows up here."
            actions={
              <>
                <ButtonLink href="/" variant="secondary">
                  <Icon name="compass" size={16} />
                  Browse games
                </ButtonLink>
                <ButtonLink href="/create-game" variant="primary">
                  <Icon name="plus" size={16} />
                  Create a game
                </ButtonLink>
              </>
            }
          />
        )}
      </section>
    </div>
  );
}
