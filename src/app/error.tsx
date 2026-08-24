"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/primitives";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="u-shell u-stack">
      <EmptyState
        icon="warning"
        title="Something went wrong on our side"
        description={
          error.message || "An unexpected error interrupted this page. Trying again usually fixes it."
        }
        actions={
          <>
            <Button variant="primary" onClick={reset}>
              <Icon name="refresh" size={16} />
              Try again
            </Button>
            <ButtonLink href="/" variant="secondary">
              Back to games
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}
