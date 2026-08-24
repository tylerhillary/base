# BASE-0

Community-run coordination for local pickup sports. Propose a game, let the
community vote it in, and show up to a full roster.

A single **Next.js 15 + TypeScript** application. There is no separate API
server: data access runs on the server through Server Components and Server
Actions, backed by Firestore.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in your Firebase details
npm run dev
```

The app runs on <http://localhost:3000>.

| Script | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint via `next lint` |

## Architecture

```
src/
  app/                 routes, layouts and the server actions in app/actions
  server/              server-only data layer (Firestore, sessions, validation)
  components/          UI — ui/ primitives, games/, layout/
  providers/           theme, toasts, command palette, notification polling
  lib/                 browser-safe helpers (formatting, geo, sports, ics)
  styles/              design tokens and the base layer
  middleware.ts        route protection
```

### Where the work happens

**Reads** run inside Server Components. A page calls `listGames()` or
`getGameById()` from `src/server/` directly — no HTTP hop, no client fetch, no
loading spinner for data the server already has.

**Writes** are Server Actions in `src/app/actions/`. Each one validates its
input with Zod and resolves the acting user from the session cookie, so a client
cannot act on behalf of somebody else. They return a result object
(`{ ok: true, data } | { ok: false, message }`) rather than throwing, which
keeps internal errors off the screen.

Everything under `src/server/` imports `server-only`, so importing it from a
Client Component is a build error rather than a leaked service-account key.

### Auth

Firebase Auth signs the user in *in the browser*; the resulting ID token is
posted once to `/api/auth/session`, which verifies it and sets an httpOnly
session cookie. From then on the server knows who is calling:

- `src/middleware.ts` redirects signed-out visitors before a page renders, and
  clears cookies that are malformed or past their expiry. It cannot verify
  signatures (the Admin SDK does not run on the Edge runtime), so it is a fast
  filter, not the security boundary.
- `getCurrentUser()` in `src/server/session.ts` does the real verification and
  is the boundary. Every action and protected page goes through it.

### Chat

Chat is the one place the browser talks to Firestore directly, using
`onSnapshot` for live delivery. If that listener is rejected — most likely
because the rules below have not been deployed yet — it falls back automatically
to polling a Server Action, which reads through the Admin SDK and always works.
Sends always go through the action so roster membership is enforced server-side.

## Firebase

`firestore.rules` assumes this server-first design: client **writes are denied
everywhere**, and client reads are granted only where the UI genuinely needs
them. Deploy them with:

```bash
firebase deploy --only firestore:rules
```

`firestore.indexes.json` holds the composite indexes. The code degrades
gracefully when one is missing — ordered queries fall back to unordered reads
sorted in memory — so a missing index shows up as slower, not broken.

## Troubleshooting

**`ChunkLoadError: Loading chunk … failed`**

A running `next dev` served a chunk map that no longer matches what is on disk.
It happens when `.next` is deleted or rebuilt underneath a live dev server — for
example running `npm run build` in one terminal while `npm run dev` is up in
another, since both use the same `.next` directory.

Stop every dev server first, then:

```bash
rm -rf .next
npm run dev
```

Clear `.next` only when you actually need to. It also holds the font cache, and
`next/font` re-downloads Manrope, Space Grotesk and JetBrains Mono from Google
on the next compile — which stalls that compile for as long as the network takes,
and can hang an open page's navigation while it waits.

If the port looks occupied, a previous dev server is probably still running.
Next will quietly start on 3001, 3002, … instead, leaving stale servers behind —
check with `netstat -ano | findstr :3000` on Windows and stop the process before
restarting.
