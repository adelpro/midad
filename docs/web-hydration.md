# Web Hydration: the static export's first render

> Why the root layout renders nothing on its first pass on the web, and what
> breaks when it stops doing that. This is the behavior contract; when code and
> this document disagree, fix the code.

---

## 1. The build is prerendered, not an empty shell

`app.json` sets `web.output: "static"`, so `expo export --platform web` writes one
HTML file per route and a marker in each head:

```html
<script type="module">
  globalThis.__EXPO_ROUTER_HYDRATE__ = true;
</script>
```

React therefore **hydrates** that HTML instead of mounting over it. The server
that produced it had no storage, no `document`, no window size and no persisted
settings, so anything the layout decides from those values is decided twice — once
on the server and once on the client — and the two answers have to agree or React
regenerates the whole tree.

## 2. The trap: hydration is already finished by the first client render

`useSettingsHydrated()` (`src/hooks/use-bootstrap.ts`) reads
`useSettings.persist.hasHydrated()`. On the server that is always `false`. On the
web client it is `true` **before React's first render**: expo-router loads the
route module, the store starts hydrating from `localStorage` while the module is
being evaluated, and the promise resolves in a microtask — long before React gets
to paint.

The result, in the prefix of this contract that shipped 0.6.0: the server rendered
the launch shell, the client's first render mounted `<Stack>` (and, inside it,
expo-router's `FrameSizeListenerWeb` — an absolutely positioned measuring `div`),
and React saw a node the server HTML did not contain. Every route threw
`Minified React error #418` (four times per load) and re-rendered from scratch.

## 3. The rule

**The first client render must produce the same tree as the server render.** In
`src/app/_layout.tsx` that means a `mounted` flag, `false` on the first render and
flipped in an effect, gating every branch that depends on client-only state:

```tsx
{mounted && (ready || error) && <Stack … />}
{mounted && hydrated && !ready && !error && <BrandLoader … />}
```

The `<StatusBar>` and the web `<Head>` stay outside the gate: they render no DOM
that differs between the two sides.

Add a new branch to that layout and it belongs behind the same flag if it reads
storage, `window`, the window size, the resolved locale or a font that only the
client can load. The cost of the gate is one extra render before the Stack mounts,
inside a frame the launch cover already owns.

## 4. Verifying a change here

The production build hides the detail (`Minified React error #418` and nothing
else). Export with `--dev` instead: React switches to its development build, and
the message names the node that differs.

```bash
npx expo export -p web --dev --output-dir /tmp/midad-dev
```

Serve it with any static host that maps `/gallery` to `gallery.html` (the same
fallback `docs/store/capture.mjs` implements) and load `/gallery`. A clean load
prints React DevTools advice and nothing else; the regression prints
`Hydration failed because the server rendered HTML didn't match the client` with
a `+` line for the node the client added.

## 5. Code map

| Concern                                       | File                           |
| --------------------------------------------- | ------------------------------ |
| The mount gate and the two gated branches     | `src/app/_layout.tsx`          |
| Hiding the native splash, hydration state     | `src/hooks/use-bootstrap.ts`   |
| The setting that turns the export into SSR    | `app.json` (`expo.web.output`) |
| Where the gallery re-reads previews on return | `src/app/(tabs)/gallery.tsx`   |
