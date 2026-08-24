import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="u-shell u-stack">
      <EmptyState
        icon="compass"
        title="That page is off the pitch"
        description="The game may have been cancelled, or the link is wrong. Head back to the board and find another match."
        actions={
          <>
            <ButtonLink href="/" variant="primary">
              <Icon name="compass" size={16} />
              Browse games
            </ButtonLink>
            <ButtonLink href="/create-game" variant="secondary">
              <Icon name="plus" size={16} />
              Create a game
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}
