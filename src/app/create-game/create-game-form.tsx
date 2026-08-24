"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { GameCard } from "@/components/games/game-card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SportMark } from "@/components/ui/sport-mark";
import { Callout, Panel } from "@/components/ui/primitives";
import { TextAreaField, TextField } from "@/components/ui/field";
import { useAuth } from "@/components/auth/auth-context";
import { useToast } from "@/providers/toast-provider";
import { createGameAction } from "@/app/actions/games";
import { toDateTimeLocal } from "@/lib/format";
import { readBrowserPosition } from "@/lib/geo";
import { SPORTS, getSport } from "@/lib/sports";
import type { GameSummary, SportType } from "@/types/domain";
import styles from "./create-game.module.css";

const STEPS = ["The game", "When & where", "Roster"] as const;

/** Same-day 7pm if that is still ahead, otherwise 7pm tomorrow. */
const defaultKickoff = () => {
  const date = new Date();
  date.setMinutes(0, 0, 0);

  if (date.getHours() >= 18) {
    date.setDate(date.getDate() + 1);
  }

  date.setHours(19);
  return date;
};

interface FormState {
  title: string;
  description: string;
  sport: SportType;
  scheduledFor: string;
  votingEndsAt: string;
  maxPlayers: number;
  locationLabel: string;
  locationAddress: string;
  /** Set only when the organiser pins a spot; never typed by hand. */
  lat: string;
  lng: string;
}

const initialState = (): FormState => {
  const kickoff = defaultKickoff();
  const votingEnds = new Date(kickoff.getTime() - 24 * 60 * 60 * 1000);

  return {
    title: "",
    description: "",
    sport: "football",
    scheduledFor: toDateTimeLocal(kickoff),
    votingEndsAt: toDateTimeLocal(votingEnds > new Date() ? votingEnds : new Date(Date.now() + 60 * 60 * 1000)),
    maxPlayers: 10,
    locationLabel: "",
    locationAddress: "",
    lat: "",
    lng: ""
  };
};

export const CreateGameForm = () => {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const sport = getSport(form.sport);

  const update = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  /** Validates one step at a time so people are corrected where they are looking. */
  const validate = (upTo: number): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    const scheduled = new Date(form.scheduledFor);
    const votingEnds = new Date(form.votingEndsAt);

    if (upTo >= 0) {
      if (form.title.trim().length < 3) next.title = "Give the game a name of at least 3 characters";
      if (form.description.length > 1000) next.description = "Keep the description under 1000 characters";
    }

    if (upTo >= 1) {
      if (Number.isNaN(scheduled.getTime())) {
        next.scheduledFor = "Pick a valid date and time";
      } else if (scheduled.getTime() <= Date.now()) {
        next.scheduledFor = "The game has to be in the future";
      }

      if (Number.isNaN(votingEnds.getTime())) {
        next.votingEndsAt = "Pick a valid voting deadline";
      } else if (votingEnds.getTime() >= scheduled.getTime()) {
        next.votingEndsAt = "Voting must close before kickoff";
      }

      if (form.locationLabel.trim().length < 2) next.locationLabel = "Name the venue";
      if (form.locationAddress.trim().length < 3) next.locationAddress = "Add an address people can find";

    }

    if (upTo >= 2) {
      if (form.maxPlayers < 2 || form.maxPlayers > 100) {
        next.maxPlayers = "Rosters run from 2 to 100 players";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validate(step)) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  /** Coordinates are optional now, so the UI reflects whether one was pinned. */
  const hasCoordinates = form.lat !== "" && form.lng !== "";

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const position = await readBrowserPosition();
      update("lat", position.lat.toFixed(6));
      update("lng", position.lng.toFixed(6));
      toast.success("Spot pinned", "Nearby players will see how far away this game is.");
    } catch (error) {
      toast.error("Could not read your location", error instanceof Error ? error.message : undefined);
    } finally {
      setLocating(false);
    }
  };

  const applyPreset = (hoursFromNow: number, label: string) => {
    const kickoff = new Date(Date.now() + hoursFromNow * 3600_000);
    kickoff.setMinutes(0, 0, 0);

    // Voting gets the first two-thirds of the runway, capped at a day.
    const lead = Math.min(hoursFromNow * 0.66, 24) * 3600_000;
    const votingEnds = new Date(Math.max(Date.now() + 30 * 60_000, kickoff.getTime() - lead));

    update("scheduledFor", toDateTimeLocal(kickoff));
    update("votingEndsAt", toDateTimeLocal(votingEnds));
    toast.info(`Scheduled for ${label}`, "Fine-tune the exact times if you need to.");
  };

  const previewGame = useMemo<GameSummary>(() => {
    const scheduled = new Date(form.scheduledFor);
    const votingEnds = new Date(form.votingEndsAt);
    const nowIso = new Date().toISOString();

    return {
      id: "preview",
      title: form.title.trim() || "Your game title",
      description: form.description,
      sport: form.sport,
      status: "proposed",
      createdBy: user?.uid ?? "you",
      createdByName: user?.displayName ?? "You",
      scheduledFor: (Number.isNaN(scheduled.getTime()) ? new Date() : scheduled).toISOString(),
      votingEndsAt: (Number.isNaN(votingEnds.getTime()) ? new Date() : votingEnds).toISOString(),
      voteCount: 0,
      participantCount: 1,
      waitlistCount: 0,
      maxPlayers: form.maxPlayers,
      location: {
        label: form.locationLabel.trim() || "Venue name",
        address: form.locationAddress.trim() || "Venue address",
        lat: Number(form.lat) || 0,
        lng: Number(form.lng) || 0
      },
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }, [form, user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!user) {
      toast.error("Sign in first", "Only signed-in players can propose a game.");
      return;
    }

    if (!validate(STEPS.length - 1)) {
      setStep(0);
      toast.error("Some details need fixing", "Check the highlighted fields.");
      return;
    }

    setSubmitting(true);

    // The organiser is taken from the session server-side, not sent from here.
    const result = await createGameAction({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      sport: form.sport,
      scheduledFor: new Date(form.scheduledFor).toISOString(),
      votingEndsAt: new Date(form.votingEndsAt).toISOString(),
      maxPlayers: form.maxPlayers,
      location: {
        label: form.locationLabel.trim(),
        address: form.locationAddress.trim(),
        lat: Number(form.lat),
        lng: Number(form.lng)
      }
    });

    if (!result.ok) {
      toast.error("Could not create the game", result.message);
      setSubmitting(false);
      return;
    }

    toast.success("Game is on the board", "Share it around and collect some votes.");
    router.push(`/games/${result.data.id}`);
    router.refresh();
  };

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className={styles.layout}>
      <Panel as="div">
        <div className={styles.stepper}>
          {STEPS.map((label, index) => (
            <div key={label} style={{ display: "contents" }}>
              <button
                type="button"
                className={`${styles.step} ${index === step ? styles.stepActive : ""} ${
                  index < step ? styles.stepDone : ""
                }`}
                onClick={() => (index < step ? setStep(index) : goNext())}
              >
                <span className={styles.stepIndex}>
                  {index < step ? <Icon name="check" size={12} strokeWidth={3} /> : index + 1}
                </span>
                {label}
              </button>
              {index < STEPS.length - 1 ? <span className={styles.stepRule} /> : null}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.panelForm}>
            {step === 0 ? (
              <>
                <div>
                  <p className={styles.legendTitle}>What are you playing?</p>
                  <p className={styles.legendText}>
                    The sport sets the default roster size and how the game is colour-coded.
                  </p>
                </div>

                <div className={styles.sportGrid} role="radiogroup" aria-label="Sport">
                  {SPORTS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={form.sport === option.value}
                      className={`${styles.sportOption} ${
                        form.sport === option.value ? styles.sportSelected : ""
                      }`}
                      style={{ "--tint": option.color } as CSSProperties}
                      onClick={() => {
                        update("sport", option.value);
                        update("maxPlayers", option.defaultPlayers);
                      }}
                    >
                      <SportMark sport={option.value} size={26} />
                      <span className={styles.sportName}>{option.label}</span>
                      <span className={styles.sportBlurb}>{option.blurb}</span>
                    </button>
                  ))}
                </div>

                <TextField
                  label="Game title"
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="Saturday 5-a-side at the cage"
                  error={errors.title}
                  maxLength={120}
                  icon="ticket"
                  full
                />

                <TextAreaField
                  label="Description"
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="Friendly run, subs welcome. Bring a dark and a light shirt."
                  hint="Sets expectations — skill level, kit, whether there are subs."
                  error={errors.description}
                  maxLength={1000}
                  showCounter
                  optional
                />
              </>
            ) : null}

            {step === 1 ? (
              <>
                <div>
                  <p className={styles.legendTitle}>When and where</p>
                  <p className={styles.legendText}>
                    Voting has to close before kickoff so the roster is settled in advance.
                  </p>
                </div>

                <div className={styles.presets}>
                  <button type="button" className={styles.preset} onClick={() => applyPreset(24, "tomorrow")}>
                    Tomorrow
                  </button>
                  <button type="button" className={styles.preset} onClick={() => applyPreset(48, "in two days")}>
                    In 2 days
                  </button>
                  <button type="button" className={styles.preset} onClick={() => applyPreset(24 * 7, "next week")}>
                    Next week
                  </button>
                </div>

                <div className={styles.grid}>
                  <TextField
                    label="Kickoff"
                    type="datetime-local"
                    value={form.scheduledFor}
                    onChange={(event) => update("scheduledFor", event.target.value)}
                    error={errors.scheduledFor}
                  />
                  <TextField
                    label="Voting closes"
                    type="datetime-local"
                    value={form.votingEndsAt}
                    onChange={(event) => update("votingEndsAt", event.target.value)}
                    error={errors.votingEndsAt}
                    hint="Leave time to fill the roster"
                  />
                  <TextField
                    label="Venue name"
                    value={form.locationLabel}
                    onChange={(event) => update("locationLabel", event.target.value)}
                    placeholder="Teslim Balogun Astro"
                    error={errors.locationLabel}
                    icon="mapPin"
                  />
                  <TextField
                    label="Address"
                    value={form.locationAddress}
                    onChange={(event) => update("locationAddress", event.target.value)}
                    placeholder="Surulere, Lagos"
                    error={errors.locationAddress}
                  />
                </div>

                <div className={styles.locationAside}>
                  <Button
                    variant="secondary"
                    busy={locating}
                    busyLabel="Locating…"
                    onClick={useMyLocation}
                  >
                    <Icon name="compass" size={16} />
                    {hasCoordinates ? "Update pinned spot" : "Pin my current spot"}
                  </Button>

                  {hasCoordinates ? (
                    <span className={styles.locationPinned}>
                      <Icon name="checkCircle" size={14} />
                      Pinned — this game will sort by distance for nearby players
                    </span>
                  ) : (
                    <span className={styles.locationHint}>
                      Optional. Pinning lets players sort by how far away a game is; without it the
                      address is still used for directions.
                    </span>
                  )}
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div>
                  <p className={styles.legendTitle}>How many players?</p>
                  <p className={styles.legendText}>
                    Anyone past this number joins the waitlist and is promoted automatically when a
                    spot frees up.
                  </p>
                </div>

                <div>
                  <div className={styles.counter}>
                    <button
                      type="button"
                      className={styles.counterButton}
                      onClick={() => update("maxPlayers", Math.max(2, form.maxPlayers - 1))}
                      disabled={form.maxPlayers <= 2}
                      aria-label="Fewer players"
                    >
                      <Icon name="close" size={16} strokeWidth={2.4} />
                    </button>
                    <span className={styles.counterValue} aria-live="polite">
                      {form.maxPlayers}
                    </span>
                    <button
                      type="button"
                      className={styles.counterButton}
                      onClick={() => update("maxPlayers", Math.min(100, form.maxPlayers + 1))}
                      disabled={form.maxPlayers >= 100}
                      aria-label="More players"
                    >
                      <Icon name="plus" size={16} strokeWidth={2.4} />
                    </button>
                  </div>
                  <p className={styles.counterHint}>
                    Confirms automatically at {Math.max(2, Math.ceil(form.maxPlayers / 2))} votes
                  </p>
                  {errors.maxPlayers ? <Callout tone="danger">{errors.maxPlayers}</Callout> : null}
                </div>

                <Callout tone="gold">
                  You are added to your own roster as the organiser, so {form.maxPlayers - 1} spots
                  are open to everyone else.
                </Callout>
              </>
            ) : null}
          </div>

          <div className={styles.formFooter}>
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep((current) => current - 1)}>
                <Icon name="arrowLeft" size={16} />
                Back
              </Button>
            ) : null}

            <span className={styles.formFooterSpacer} />

            {isLastStep ? (
              <Button
                type="submit"
                variant="primary"
                busy={submitting}
                busyLabel="Publishing…"
                disabled={!user}
              >
                <Icon name="zap" size={16} />
                Put it on the board
              </Button>
            ) : (
              <Button variant="primary" onClick={goNext}>
                Continue
                <Icon name="arrowRight" size={16} strokeWidth={2.2} />
              </Button>
            )}
          </div>
        </form>
      </Panel>

      <aside className={styles.preview}>
        <p className={styles.previewLabel}>
          <Icon name="sparkle" size={13} />
          Live preview
        </p>

        <GameCard game={previewGame} preview />

        <Panel padded>
          <div className={styles.tips}>
            <p className={styles.tip}>
              <Icon name="clock" size={16} />
              Close voting at least a day before kickoff — people need notice to commit.
            </p>
            <p className={styles.tip}>
              <Icon name="mapPin" size={16} />
              Use a venue name locals recognise, not just a street address.
            </p>
            <p className={styles.tip}>
              <Icon name="users" size={16} />
              {sport.label} games usually run {sport.defaultPlayers} players.
            </p>
          </div>
        </Panel>
      </aside>
    </div>
  );
};
