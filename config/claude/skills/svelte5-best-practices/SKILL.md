---
name: svelte5-best-practices
description: Svelte 5 runes, SvelteKit, and Cloudflare-edge best practices for building reactive PWAs. Use when writing or reviewing Svelte 5 components, SvelteKit routes/load functions/hooks, service workers, offline sync, or Cloudflare Workers/D1/R2/KV/Durable Objects integrations. Covers $state/$derived/$effect pitfalls, adapter-cloudflare config, PWA caching strategy, and offline-first patterns. Do not load for plain-JS, React, Vue, or non-SvelteKit Svelte 4 work.
---

# Svelte 5 + SvelteKit + Cloudflare Best Practices

Opinionated guide for the Svelte 5 + SvelteKit + Cloudflare Workers/D1/R2/KV stack. Full reference lives at `reference/guide.md` — load it when the task touches any of the patterns below in depth.

## When to Apply

- Writing or reviewing Svelte 5 components (anything using `$state`, `$derived`, `$effect`, `$props`)
- SvelteKit routing, `+page.server.ts`, `+server.ts`, hooks, load functions
- Cloudflare adapter config, `wrangler.jsonc`, bindings (D1 / R2 / KV / Durable Objects)
- PWA work: service worker, manifest, offline-first sync, push notifications
- Migrating Svelte 4 stores / `$:` / `export let` to runes

## Hard Rules (do not violate)

1. **`$derived` over `$effect` for state computation.** 90% of Svelte 4 `$:` blocks should become `$derived`, not `$effect`. Effects are for DOM side effects, subscriptions, and logging — never for computing new state from existing state.
2. **No module-level `$state` that crosses requests on the server.** A `$state` in a `.svelte.ts` module is a singleton per Worker isolate and will leak between users during SSR. Use `setContext`/`getContext` for per-request state, or keep module `$state` strictly client-side.
3. **Use `$state.raw` for large or immutable datasets.** Skip deep Proxy wrapping for 100+ item arrays / immutable structures; replace the whole value instead of mutating.
4. **`$state.snapshot()` before serializing.** `JSON.stringify`, `structuredClone`, and external libs must receive plain objects, not proxies. Class fields backed by `$state` are non-enumerable — implement `toJSON()` or snapshot explicitly.
5. **`untrack()` to break `$effect` cycles.** Reading and writing the same `$state` in an effect creates an infinite loop. Import `untrack` from `'svelte'` or restructure to `$derived`.
6. **Only `@sveltejs/adapter-cloudflare`.** `adapter-cloudflare-workers` and `adapter-cloudflare-pages` are deprecated / do not exist as separate packages in 2025+. The unified adapter builds for Workers and Pages.
7. **Deploy to Cloudflare Workers, not Pages, for new projects.** Pages is in maintenance mode; all new features (Durable Objects, Cron Triggers, Queues, Rate Limiting binding, Smart Placement) are Workers-only. Static asset requests are now free on Workers.
8. **Access bindings via `platform.env.BINDING_NAME`** with optional chaining (`platform?.env.DB`). Always guard — `platform` is `undefined` outside Cloudflare (dev, tests).
9. **Raw parameterized SQL for D1.** No ORM unless the repo already has one. `INSERT OR REPLACE` for sync upserts; never string-concatenate user input.
10. **Conventional `+page.svelte` children use `{@render children()}`, not `<slot />`.** Event dispatch uses callback props, not `createEventDispatcher()`.

## Top Pitfalls

- **Infinite `$effect` loops** — read+write same `$state` → cycle. Fix with `untrack()` or `$derived`.
- **Server-side `$state` leakage** — module singletons persist across requests in Workers isolates.
- **Class state non-enumerable** — `Object.keys(instance)` returns `[]`; use `$state.snapshot()` or `toJSON()`.
- **Safari streaming buffer** — Safari buffers full response, defeating SvelteKit promise streaming. Test on Safari before relying on it.
- **Version mismatch after deploy** — SvelteKit detects cached route modules that don't match new server and falls back to full reload; don't disable this.
- **Rate-limited KV writes** — 1 write/sec/key ceiling. Don't use KV for high-write-frequency state; prefer D1 or Durable Objects.

## Performance Defaults

- Prefer `$derived` over stored computed state
- Use `$state.raw` for 100+ items or immutable structures
- Code-split heavy components with dynamic `import()` (no `<svelte:component>` wrapper in Svelte 5)
- Stream secondary data with unwrapped promises + `{#await}` blocks in load functions
- Prerender static routes (`export const prerender = true`); use KV as ISR cache for dynamic pages that need edge caching
- Layered service worker caching: cache-first for `build`/`files`/`prerendered`, network-first for SSR HTML + `__data.json`, stale-while-revalidate for non-critical APIs

## Offline-First Pattern

IndexedDB (Dexie) as local source of truth → optimistic write + UI update → background sync queue with exponential backoff → conflict resolution (last-write-wins → versioned → CRDT, in order of accuracy). Every sync entity needs `id`, `updatedAt`, `syncStatus`, `version`. Bridge IndexedDB → `$state` via `$effect` on mount.

For real-time collaboration: **Durable Objects** with the Hibernation API for WebSocket rooms (up to 32,768 concurrent connections per instance, no billing while idle). Bridge WS messages → `$state` in a client-side `.svelte.ts` module.

## Migration from Svelte 4

- Run `npx sv migrate svelte-5` first (handles ~90% automatically)
- `writable(0)` → `let count = $state(0)` (in a `.svelte.ts` file if shared)
- `derived(store, fn)` → `$derived(expression)`
- `$: x = y * 2` → `let x = $derived(y * 2)`
- `export let name` → `let { name } = $props()`
- `createEventDispatcher()` → callback props (`let { onchange } = $props()`)
- `<slot />` → `{@render children()}`
- Svelte 4 syntax remains supported — migration is opt-in per component

## Browser Service Worker vs Cloudflare Worker

These operate at different layers and never conflict:
- **Cloudflare Worker** (`_worker.js`, generated by `adapter-cloudflare`) runs on the edge, handles SSR and API routes
- **Browser service worker** (`src/service-worker.js`) runs on the client, intercepts fetches for offline caching

The edge Worker responds; the browser service worker caches that response according to its own strategy. Don't conflate them.

## Reference

For full detail on any of the above — runes internals, adapter config examples, wrangler.jsonc templates, PWA registration patterns, push notification flow, sync architecture, benchmark data — read `reference/guide.md`.
