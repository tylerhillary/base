import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { CreateGameForm } from "./create-game-form";

export const metadata: Metadata = {
  title: "Create a game",
  description: "Propose a pickup game, set the venue and let the community vote it in."
};

export default function CreateGamePage() {
  return (
    <div className="u-shell u-stack">
      <PageHeader
        eyebrow="New proposal"
        eyebrowIcon="plus"
        title="Put a game on the board"
        lede="Three short steps: pick the sport, set the time and place, then choose how big the roster is. Voting starts the moment you publish."
        backHref="/"
      />

      <CreateGameForm />
    </div>
  );
}
