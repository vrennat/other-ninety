# Reactive PWAs with Svelte 5, SvelteKit, and Cloudflare

Full reference for the Svelte 5 + SvelteKit + Cloudflare stack. Source research compiled 2026-04-11.

**Svelte 5's rune-based reactivity, paired with SvelteKit's full-stack framework and Cloudflare's edge platform, creates one of the most performant stacks for progressive web apps in 2025–2026.** Sub-25 KB per-page bundles, near-zero cold starts via V8 isolates, compile-time reactive optimizations that outperform virtual-DOM frameworks by wide margins.

---

## Svelte 5 runes replace stores with compile-time reactivity

Svelte 5's runes (`$state`, `$derived`, `$effect`) are compiler directives that look like function calls but transform at build time into optimized reactive primitives. They replace Svelte 4's `$:` reactive declarations and writable/readable stores with a more predictable, fine-grained system.

**`$state(value)`** creates deeply reactive state. Objects and arrays become Proxy-wrapped, so `todos[3].done = true` triggers only the specific DOM node reading that property — not the entire list. Primitives work without proxies. For large datasets (100+ items) or immutable data patterns, **`$state.raw(value)`** skips deep proxification; you must replace the entire value (`items = [...items, newItem]`) rather than mutating in place. Use `$state.snapshot(proxyValue)` to get a plain JS object when passing reactive data to `JSON.stringify`, `structuredClone`, or external libraries that don't expect Proxy objects.

**`$derived(expression)`** replaces `$:` computed values with runtime-tracked, memoized derivations. Dependencies are tracked dynamically (not via static analysis), making them immune to refactoring breakage. For multi-step computations, `$derived.by(() => { ... })` accepts a function body. As of **Svelte 5.25**, derived values can be directly overridden — a key enabler for optimistic UI patterns where you temporarily show predicted state before server confirmation.

**`$effect(() => { ... })`** handles side effects after DOM updates. It auto-tracks `$state`/`$derived` reads synchronously; anything read after `await` or inside `setTimeout` is *not* tracked. Effects return optional cleanup functions, run only in the browser (never during SSR), and batch re-runs via microtasks. The cardinal rule: **90% of former `$:` blocks should become `$derived`, not `$effect`**. Effects exist for DOM manipulation, subscriptions, and logging — not state derivation.

### The pitfalls that trip up every team

The most reported issue across GitHub and production case studies is **infinite loops in `$effect`** — reading and writing the same `$state` inside an effect creates a dependency cycle. The fix is `untrack()` from `'svelte'` to read without registering a dependency, or restructuring the logic to use `$derived` instead. A second critical pitfall: **module-level `$state` leaks between users during SSR**. A `$state` declared in a `.svelte.ts` module file is a singleton on the server, persisting across requests. Use SvelteKit's `setContext`/`getContext` for per-request state isolation, or keep module-level `$state` strictly client-side. Svelte stores remain valid and non-deprecated for patterns like returning data from `load` functions.

Class-based state with runes introduces a subtle gotcha: the compiler transforms `$state` fields into getter/setter pairs on the class prototype, making them **non-enumerable**. `Object.keys(new Todo())` returns an empty array. Use `$state.snapshot()` or implement custom `toJSON()` methods when serialization is needed.

### Migration from Svelte 4 stores

Run `npx sv migrate svelte-5` for automated transformation handling roughly 90% of cases. The key mapping: `writable(0)` becomes `let count = $state(0)` in a `.svelte.ts` file; `derived(store, fn)` becomes `$derived(expression)`; `export let name` becomes `let { name } = $props()`; `createEventDispatcher()` becomes callback props; `<slot />` becomes `{@render children()}`. Svelte 4 syntax remains fully supported — migration is opt-in per component.

---

## One adapter to rule them: SvelteKit on Cloudflare in 2026

**`@sveltejs/adapter-cloudflare` is the only recommended adapter.** The former `adapter-cloudflare-workers` is deprecated because Cloudflare deprecated Workers Sites in favor of Workers Static Assets. There is no separate `adapter-cloudflare-pages` package — the unified adapter builds for both Workers and Pages deployments.

The adapter outputs to `.svelte-kit/cloudflare/`, generating `_worker.js` for the edge Worker and static assets in the same directory. Wrangler 4+ can auto-detect SvelteKit projects and configure itself, but explicit configuration gives control over bindings:

```jsonc
{
  "name": "my-pwa",
  "main": ".svelte-kit/cloudflare/_worker.js",
  "compatibility_date": "2026-03-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": ".svelte-kit/cloudflare", "binding": "ASSETS" },
  "d1_databases": [{ "binding": "DB", "database_name": "pwa-db", "database_id": "<ID>" }],
  "kv_namespaces": [{ "binding": "KV", "id": "<ID>" }],
  "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "uploads" }]
}
```

All Cloudflare bindings (D1, R2, KV, Durable Objects) are accessed through a single pattern: **`platform.env.BINDING_NAME`**. In `+server.ts` and `+page.server.ts`, destructure `platform` directly from the event; in `hooks.server.ts`, access it via `event.platform`. Always use optional chaining (`platform?.env.DB`) since `platform` is `undefined` outside Cloudflare. Declare your binding types in `src/app.d.ts` with `@cloudflare/workers-types` for full TypeScript support. A common hook pattern attaches bindings to `event.locals` for downstream access.

### Workers vs Pages: the platform is converging

Cloudflare is folding Pages into Workers. Pages continues working but receives only maintenance updates. All new features — Durable Objects (native), Cron Triggers, Queue Consumers, the Rate Limiting binding, Gradual Deployments, Smart Placement — are Workers-only. Static asset requests are now **free on Workers** (matching Pages pricing), removing the last economic argument for Pages. For new SvelteKit PWA projects, deploy to Workers.

Key Workers runtime constraints to design around: no filesystem access (use `read()` from `$app/server` instead), **3 MiB compressed bundle limit** on the free plan (10 MiB on paid), ESM-only (no CommonJS), and no persistent global state between requests (each request may hit a different isolate). Enable `nodejs_compat` for polyfilled Node.js APIs; set `compatibility_date` to recent dates for expanding module support.

---

## Two paths to PWA: manual control or Workbox automation

SvelteKit provides native service worker support through `src/service-worker.js` and the `$service-worker` virtual module, which exports four deployment-aware arrays: `build` (Vite-generated JS/CSS with content hashes), `files` (static directory contents), `prerendered` (prerendered page paths), and `version` (unique per build). The official pattern precaches all build assets on install, deletes old versioned caches on activate, and uses cache-first for known assets plus network-first-with-fallback for everything else.

For production PWAs needing update prompts, automatic manifest generation, and Workbox integration, **`@vite-pwa/sveltekit`** handles the ceremony. It auto-generates the manifest, provides `virtual:pwa-register/svelte` for reactive update detection (with `needRefresh` and `offlineReady` stores), and supports both `generateSW` and `injectManifest` strategies. The tradeoff: more dependencies and opinions in exchange for less boilerplate.

### Caching strategy for SSR + client navigation

SvelteKit's dual rendering model — SSR for first paint, then client-side navigation for subsequent pages — requires a layered caching strategy:

- **Build assets** (`build` array): Cache-first, indefinitely. These files have content-hashed filenames and are immutable.
- **Static files** (`files` array): Cache-first with version-based invalidation on deployment.
- **Prerendered HTML**: Cache-first; these are build-time snapshots.
- **SSR pages and `__data.json` payloads**: Network-first with cache fallback. This ensures fresh data while providing offline resilience.
- **API responses**: Stale-while-revalidate for non-critical data; network-only for authentication and real-time data.

Version mismatches after deployment (where cached route modules don't match the new server) are handled by SvelteKit's built-in detection, which falls back to full page reloads when it detects a version conflict.

### Push notifications and background sync

Push notifications follow the standard Web Push pattern: subscribe via `PushManager` on the client, send the subscription to a SvelteKit API endpoint, store it in D1, and use the `web-push` library with VAPID keys to push messages. The service worker handles `push` events to display notifications and `notificationclick` for deep-linking. iOS 16.4+ supports web push, but only for installed PWAs with `display: standalone` in the manifest.

Background Sync queues failed operations in IndexedDB and registers a sync event. When connectivity returns, the service worker fires the `sync` listener, which processes the outbox queue. Periodic Background Sync (Chromium only) enables recurring updates like content prefetching, gated by browser engagement heuristics.

---

## Reactive offline patterns that feel instant

### Bridging runes and IndexedDB

The library **`svelte-persisted-state`** persists `$state` runes to localStorage, sessionStorage, IndexedDB, or cookies with automatic serialization via `devalue` (supporting Maps, Sets, Dates, and nested structures). For complex database needs, **Dexie.js** wraps IndexedDB with a cleaner API; integrate it with runes by loading query results into `$state` via `$effect`:

```ts
let items = $state<Item[]>([]);
$effect(() => {
  db.items.toArray().then(result => { items = result; });
});
```

For collaborative apps, **SyncroState** (built on Yjs CRDTs) provides a `$state`-like API synchronized across clients in real-time.

### Optimistic UI with immediate rollback

The pattern separates optimistic and confirmed state: push an optimistic entry with a temporary ID immediately, then replace or roll back when the server responds. Svelte 5.25's writable `$derived` values simplify this — override the derived value optimistically, and it automatically reverts when the underlying `$state` updates with server data. **TanStack Query for Svelte** provides structured optimistic updates via `onMutate` (snapshot + optimistic write), `onError` (rollback), and `onSettled` (refetch), with optional IndexedDB persistence for the query cache.

### Sync architecture for offline-first apps

Production offline-first PWAs follow a queue-based architecture: user actions write to IndexedDB immediately, update the UI optimistically, and enqueue changes for sync. When online, the sync processor sends batched changes with exponential backoff and jitter. Every sync entity needs `id`, `updatedAt`, `syncStatus`, and `version` fields. Conflict resolution ranges from last-write-wins (simplest, risks data loss) through versioned updates (server rejects stale writes) to CRDT-based merging (highest data accuracy — one production case study reported **99.2% accuracy with <1% sync errors** using CRDT-like merging, handling outbox queues of 500+ items during 8-hour outages).

### Real-time with WebSockets and SSE

SvelteKit native WebSocket support is available as a testing-stage PR (#12973). Until it stabilizes, the **`sveltekit-sse`** library provides a clean integration for server-to-client streaming with auto-reconnect. For bidirectional communication, Durable Objects on Cloudflare Workers handle WebSocket connections with up to **32,768 concurrent connections per instance** and a Hibernation API that eliminates billing during idle periods. Bridge WebSocket messages to `$state` in a `.svelte.ts` module for reactive UI updates across components.

---

## Performance: Svelte 5 compiles away the framework

### Bundle size cuts in half at scale

Svelte 5 introduces a ~3–4 KB signals runtime alongside the compiler, but this fixed overhead is offset by dramatically smaller per-component output. Real-world measurements show **app code shrinking from 154 KB to 74 KB (52% reduction)** and total bundles dropping roughly 31%. The savings increase with app complexity — a production e-commerce app measured an **8.2 KB initial bundle** with 156ms TTI compared to React 18's 47 KB / 340ms TTI. For very small apps (few components), Svelte 5 may be ~9 KB larger than Svelte 4 due to the runtime overhead; the crossover happens quickly as component count grows. Upgrading to Svelte 5.38+ yields an additional 15–30% size improvement over earlier Svelte 5 releases.

SvelteKit automatically code-splits by route. Each `+page.svelte` becomes a separate chunk loaded on navigation. For heavy components (charts, editors, maps), use dynamic `import()` with Svelte 5's direct component rendering — no `<svelte:component>` wrapper needed. Three trigger patterns work well: on-demand (user clicks), on-hover (preload on trigger hover), and on-idle (via `requestIdleCallback` for below-fold content).

### Streaming and prerendering on Cloudflare

SvelteKit's promise streaming lets server load functions return unwrapped promises that resolve after the initial HTML ships. The primary content renders immediately while secondary data (comments, recommendations) streams in with `{#await}` blocks. One caveat: Safari buffers the entire response before rendering, defeating streaming's purpose on that browser.

For prerendering on Cloudflare, mark routes with `export const prerender = true` for build-time static generation. Cloudflare doesn't support ISR natively, but a custom pattern using **KV as a page cache** achieves the same result: check KV for a cached render, return it if within TTL, otherwise render fresh and store in KV with an expiration. Each route can have its own regeneration interval. The adapter's `_routes.json` configuration can bypass `_worker.js` entirely for prerendered pages, serving them as true static assets without consuming function invocations.

View transitions integrate via SvelteKit's `onNavigate` hook and the browser's View Transitions API, providing crossfade animations between route changes as progressive enhancement. Place the setup in `+layout.svelte` for site-wide transitions with zero performance cost on unsupported browsers.

---

## Cloudflare bindings power the PWA backend

### D1 for structured data and sync endpoints

D1 serves as the primary relational database for PWA backends. Access it via `platform.env.DB` in any server context. For offline sync, create a `/api/sync` endpoint that accepts client changes (apply via `INSERT OR REPLACE`), then returns server changes since the client's last sync timestamp. **Drizzle ORM** works well with D1 on Workers and ships as a scaffold option in the Cloudflare CLI for SvelteKit projects.

### R2 for assets and uploads with zero egress

R2 provides S3-compatible object storage with **zero egress fees** — ideal for PWAs where users download cached content frequently. Use it for user-uploaded files, pre-generated offline content bundles, and large cached API responses. Multipart upload support via `createMultipartUpload()` handles large file uploads gracefully.

### KV for sessions, flags, and configuration

Cloudflare officially recommends KV for session storage. It's eventually consistent (writes propagate globally in ~60 seconds) with **500µs–10ms read latency** for hot keys — fast enough for session validation on every request. Store feature flags as a JSON object in a single key, tenant-specific PWA configurations, and cached API responses with TTLs. One write per second per key is the ceiling, so avoid high-write-frequency patterns.

### Durable Objects for presence and collaboration

Durable Objects provide the strongly consistent, stateful compute layer that Workers lack. Use them for real-time collaboration (document editing), presence indicators, chat rooms, and any scenario requiring WebSocket connections with server-side state. The Hibernation API is essential: it suspends billing during idle connections, making long-lived WebSocket rooms economically viable. Durable Objects require Workers deployment — they're not available natively on Pages.

### Rate limiting and security

The Workers Rate Limiting binding (GA since September 2025) provides per-endpoint, per-user rate limits without external services. Configure tiered limits in `wrangler.jsonc` (e.g., 20 req/min for free users, 100 for paid) and key on IP, user ID, or any string combination. Layer this with Cloudflare WAF rules for edge-level protection on authentication endpoints.

---

## Environment management and the service worker distinction

Environment variables follow a three-tier model: `[vars]` in `wrangler.jsonc` for non-sensitive config (committed to git), `.dev.vars` for local development secrets (gitignored), and `wrangler secret put` for encrypted production secrets. SvelteKit's `$env/static/private` and `$env/dynamic/private` modules access these server-side; prefix with `PUBLIC_` for client-safe values.

The most important conceptual distinction in this stack: **browser service workers and Cloudflare Workers operate at entirely different layers and never conflict.** The Cloudflare Worker runs on the edge, handling SSR and API requests. The browser service worker runs on the client, intercepting fetch responses for caching and offline support. SvelteKit's `src/service-worker.js` produces the browser service worker; `adapter-cloudflare` generates `_worker.js` for the edge Worker. They coexist transparently — the edge Worker responds, and the browser service worker caches that response according to its own strategy.

## Key architectural decisions

- Default to `$derived` over `$effect` for state computation
- Use `$state.raw` for large immutable datasets
- Isolate server-side state via context rather than module singletons
- Deploy to Workers (not Pages) for access to the full Cloudflare feature set
- Implement a layered caching strategy that treats build assets as immutable while keeping SSR responses network-first
- IndexedDB as local source of truth → queue-based background sync with CRDT conflict resolution → Svelte 5 runes bridging reactive UI to persistent storage
