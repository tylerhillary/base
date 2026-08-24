import { Skeleton } from "@/components/ui/primitives";

/** Mirrors the discover page rhythm so the swap to real content is barely visible. */
export default function Loading() {
  return (
    <div className="u-shell u-stack" aria-busy="true" aria-label="Loading">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingBlock: "2rem" }}>
        <Skeleton width="9rem" height="1.6rem" radius="var(--r-full)" />
        <Skeleton width="min(34rem, 90%)" height="3.5rem" />
        <Skeleton width="min(26rem, 80%)" height="1.1rem" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))", gap: "1rem" }}>
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} height="5.5rem" radius="var(--r-md)" />
        ))}
      </div>

      <Skeleton height="3.5rem" radius="var(--r-lg)" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(19rem, 1fr))", gap: "1rem" }}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} height="15rem" radius="var(--r-lg)" />
        ))}
      </div>
    </div>
  );
}
