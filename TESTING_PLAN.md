# Tier 1 Unit Test Plan — Pure Functions

**Status:** Draft for review. No code changes made yet.

## Context

Following the pilot test infrastructure (Vitest + Playwright, see `CLAUDE.md`'s Testing section), a full-codebase inventory found the app has ~60+ testable units across `server/` and `src/` with almost none covered — only 2 functions in `server/rigComm.ts` and 1 hook (`useSpectrum`) have direct Vitest tests today. That inventory was sorted into four tiers by effort/value; this plan covers **Tier 1 only**: pure, deterministic functions (input → output, no I/O, no sockets, no native modules) that can be unit-tested with Vitest.

Tiers 2–4 (hook-level stub-socket tests, e2e panel tests via the existing Dummy-rigctld fixture, and e2e tests needing new fixtures for audio/video/CW/WSJTX) are deliberately **out of scope** for this pass — noted at the end for later phasing.

## Convention

Test files are co-located with source, matching the existing pattern (`server/rigComm.test.ts`, `src/hooks/useSpectrum.test.ts`). One test file per source module, covering every Tier-1 function in that module. Server-side test files get a `// @vitest-environment node` docblock.

**Two kinds of items below:**
- **Direct** — the function is already exported and can be tested as-is, zero source changes.
- **Extract** — the logic exists but is private (module-scope, not exported) or embedded inline in a component/hook closure. Requires a small refactor (add `export`, or pull the logic out into a standalone function with explicit parameters replacing whatever it closed over) *before* it's testable. Refactors are scoped to be mechanical — no behavior change, just making the existing logic reachable.

---

## Backend (`server/`)

### `server/rigComm.ts` — extend existing `server/rigComm.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `normalizeVfoName(raw)` | **Extract** — private, line 14 | `"Main"` → `"VFOA"`, `"Sub"` → `"VFOB"`, `"VFOA"`/`"VFOB"`/other strings pass through unchanged, leading/trailing whitespace trimmed |
| `resetRigState(ctx)` | **Direct** — exported, line 655 | Given a `ctx` with non-default rig fields populated, assert every field it touches is reset to its documented default (frequency, mode, ptt, vfo, split, meters, etc.) |

### `server/rigctld.ts` — new `server/rigctld.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `checkVersionSupported(version)` | **Direct** — exported | `null` → false; below `4.7.0` → false; exactly `4.7.0` → true; above → true; one/two-part version strings (`"5"`, `"4.7"`) handled without throwing |

### `server/context.ts` — new `server/context.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `createInitialContext(io, baseDir, dataDir)` | **Direct** — exported | Snapshot/shape assertion on defaults that matter for regressions: `pollRate: 2000`, `spectrumSettings` (enabled: false, source: "hamlib", multicastAddr/Port, ft4222SpanIndex), `spectrumSupported: false`, `lastStatus` shape |

### `server/vlog.ts` — new `server/vlog.test.ts`
| Function | Status | Test cases | Gotcha |
|---|---|---|---|
| `ts()` | **Direct** — exported | Fixed `Date` (via `vi.setSystemTime`) → exact `"HH:MM:SS.mmm"` string | — |
| `setDebugFlag(key, value)` | **Direct** — exported | Mutates the shared `debugFlags` object; assert via a subsequent `vlogX` call | Module-level mutable state — reset between tests (`setDebugFlag` back to false) so tests don't leak into each other |
| `vlogRig`/`vlogAudio`/`vlogVideo`/`vlogCw`/`vlogInfra`/`vlogSpectrum`/`vlogSpots`/`vlogWsjtx` | **Direct** — exported | For 2–3 representative ones (not all 8, they're structurally identical): logs via `console.log` spy when its flag is on, silent when off | This file has an import-time side effect (`--help` in `process.argv` triggers `process.exit(0)`) — import it normally in tests (argv won't contain `--help` under Vitest) but don't blanket-mock `process.argv` without checking this |

### `server/diagnostics.ts` — new `server/diagnostics.test.ts`
| Function | Status | Test cases | Gotcha |
|---|---|---|---|
| `pushDiagnosticsLine(ctx, line)` | **Direct** — exported | Given a fake `ctx` (`{ diagnosticsLog: [], diagnosticsLogTimestamps: [], io: { emit: vi.fn() } }`): timestamp-prefix detection, line appended, old lines pruned once `MAX_AGE_MS`/`MAX_LINES` exceeded, `io.emit` called with the right payload | Pruning depends on `Date.now()` — use `vi.setSystemTime`/`vi.advanceTimersByTime` to control age deterministically |

### `server/tls.ts` — new `server/tls.test.ts`
| Function | Status | Test cases | Gotcha |
|---|---|---|---|
| `getLanIPs()` | **Direct** — exported | Given a mocked `os.networkInterfaces()` return value: filters to non-internal IPv4 only, skips internal/loopback and IPv6 entries | Needs `vi.mock('os', ...)` or `vi.spyOn(os, 'networkInterfaces')` |

### `server/auth.ts` — new `server/auth.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `requireAuth(socket, ctx, handler)` | **Direct** — exported | Stub `socket` (`{ id, emit: vi.fn() }`) + `ctx.authenticatedSockets` Map: entry present → `handler` called; entry absent → `socket.emit("auth:required")` fired, `handler` NOT called |
| `requireAdmin(socket, ctx, handler)` | **Direct** — exported | Same pattern plus role check: `role: "admin"` → `handler` called; `role: "regular"` → rejected, `handler` NOT called |
| `issueToken(callsign, role, ctx)` | **Direct** — exported | Fixed `ctx.jwtSecret` string, no real filesystem needed: decode the returned JWT (`jsonwebtoken.verify`) and assert `sub === callsign`, `role` matches, `exp - iat` ≈ 7 days |

**Subtotal: 7 test files, ~12 functions, 1 small extraction (`normalizeVfoName`).**

---

## Frontend (`src/`)

### `src/utils.ts` — new `src/utils.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `formatStep(s)` | **Direct** — exported | Boundary values: sub-1kHz → Hz, sub-1MHz → kHz, ≥1MHz → MHz, exact powers-of-ten boundaries |
| `splitLocalAudioDevices(devices)` | **Direct** — exported | Given a plain array of `{deviceId, kind, label}`-shaped objects: filters out the synthetic `deviceId: "default"` entry, splits into input/output by `kind` |

### `src/utils/spectrumColors.ts` — new `src/utils/spectrumColors.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `amplitudeToPixel(amplitude, floor, ceiling, colorMap)` | **Direct** — exported | Clamping below floor / above ceiling, normalization midpoint, correct LUT index for a known `colorMap` (test against at least `COLORMAP_CLASSIC`) |

### `src/hooks/useAuth.ts` — new `src/hooks/useAuth.test.ts`
*(pure exported helpers only — the `useAuth` hook's state machine itself is Tier 2, out of scope)*
| Function | Status | Test cases |
|---|---|---|
| `clearUserPreferences(callsign)` | **Direct** — exported | Removes all namespaced `localStorage` keys for that callsign, leaves other callsigns' keys untouched |
| `checkAndClearPreferences(callsign, preferencesClearedAt)` | **Direct** — exported | Server timestamp newer than last-cleared → clears + updates marker; older/equal → no-op |
| `nsKey(callsign, key)` | **Direct** — exported | `nsKey("w1abc", "foo")` → `"W1ABC:foo"` (uppercased prefix) |

### `src/hooks/useConsoleCapture.ts` — new `src/hooks/useConsoleCapture.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `ts()` | **Extract** — private, line 4 | Same as server's `ts()`: fixed `Date` → exact `"HH:MM:SS.mmm"` |
| `formatArg(a)` | **Extract** — private, line 10 | String passthrough, `Error` → message (+ stack if that's the documented behavior), plain object → `JSON.stringify`, circular-reference object → fallback string (doesn't throw) |

### `src/hooks/usePersistedCollapsed.ts` — new `src/hooks/usePersistedCollapsed.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `readCollapsed(ns, key, legacyKey, defaultCollapsed)` | **Extract** — private, line 3 | Namespaced key present → its value; absent but legacy key present → legacy value; neither present → `defaultCollapsed` |

### `src/hooks/useRigctld.ts` — new `src/hooks/useRigctld.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `isSettingsValid` (rename to `isRigctldSettingsValid(settings)`) | **Extract** — inline arrow fn at line 160, closes over `rigctldSettings` from hook scope; parameterize it | All five required fields present → true; any one missing/empty → false |
| Radios-list dedupe (inline at line 64, `Array.from(new Map(list.map(r => [r.id, r])).values())`) | **Extract** — pull into `dedupeRadiosById(list)` | Duplicate `id`s collapse to the last occurrence; order of first-seen unique ids otherwise preserved |

### `src/layouts/CompactLayout.tsx` — new `src/layouts/CompactLayout.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `renumberSegments(segments)` | **Direct** — already a standalone module-level function | Reassigns dense sequential `y` values to a list of grid segments while preserving relative order; empty input; single segment |

### `src/layouts/PhoneLayout.tsx` — new `src/layouts/PhoneLayout.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `movePhonePanel(item, direction, idx)` | **Extract** — inside the component (line 419), closes over `visibleItems` (a `useMemo`) and the `gridCallbacks` prop. Pull the pure part into `computeSwappedPositions(item, direction, idx, visibleItems)` returning the two updated `{i, x, y, w, h}` entries; the component keeps calling `gridCallbacks.updateItemPositions(...)` with that result | Swap-with-adjacent-by-sorted-`y`; boundary: first item can't move up (`idx - 1 < 0`), last item can't move down (`idx + 1 >= visibleItems.length`) — both return without producing a swap |

### `src/panels/SolarPanel.tsx` — new `src/panels/SolarPanel.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `sfiColor(v)`, `aColor(v)`, `kColor(v)`, `geomagColor(s)` | **Extract** — private module-scope, lines 27/33/40/46 | For each: the documented threshold boundaries (values just below/at/above each cutoff) map to the correct Tailwind color class |

### `src/panels/SpectrumAudioPanel.tsx` — new `src/panels/SpectrumAudioPanel.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `computeDisplayBandwidth(bandwidth, mode, maxHz)` | **Extract** — private module-scope, line 42 | `mode === "CW"`/`"CWR"` → capped at 1400 Hz regardless of `bandwidth`; other modes → `bandwidth + 300`, capped to `maxHz` |

### `src/modals/AdminTab.tsx` — new `src/modals/AdminTab.test.ts`
| Function | Status | Test cases |
|---|---|---|
| `formatUptime(ms)` (line 47), `formatDuration(ms)` (line 57) | **Extract** — both private module-scope functions, no closures — just add `export` | Sub-minute, minutes-only, hours+minutes, multi-day if the format supports it; zero |

### `src/modals/DiagnosticsTab.tsx` — new `src/modals/DiagnosticsTab.test.ts`
| Function | Status | Test cases | Gotcha |
|---|---|---|---|
| `buildFilename()` (line 23) | **Extract** — private module-scope, no closures — just add `export` | Fixed `Date` → exact expected filename string | Mock `Date`/`vi.setSystemTime` |
| `buildLogContent()` (line 39) | **Extract** — currently inside the component, closes over `logs` from `useDiagnostics(socket)`. Parameterize as `buildLogContent(logs: string[]): string`; component calls `buildLogContent(logs)` | Header (fixed app name + ISO timestamp + Electron-vs-browser origin string) + joined log lines given a `logs` input | Reads `window.electron`/`navigator.userAgent`/`new Date()` internally — mock all three; test both "running in Electron" and "running in browser" header variants |

### `src/App.tsx` — new `src/App.test.ts` (or extract into a small shared module, e.g. `src/appHelpers.ts`, if that reads cleaner)
| Function | Status | Test cases |
|---|---|---|
| `getPreampLabel`/`getAttenuatorLabel`/`getAgcLabel` | **Extract** — currently `useCallback`s inside the component (lines 456–471), closing over `status`, `isCompact`, `isPhone`, `agcLevels`. Pull out as standalone functions with those as explicit parameters, e.g. `formatPreampLabel(preamp, compact)`, `formatAttenuatorLabel(attenuation, compact)`, `formatAgcLabel(agc, agcLevels)`; call sites in `App.tsx` pass the same values through | `0` → `"P.AMP"`/`"ATT"` (compact/phone) or `"OFF"` (desktop-style); non-zero → `"{n}dB"`; AGC label looked up from the `"value=label"`-encoded `agcLevels` array, falls back to raw value or `"OFF"` |
| Backend-URL resolution (inline in a `useState` initializer, lines 43–59) | **Extract** — pull the decision logic into a pure `resolveBackendUrl(stored, currentOrigin): { url: string; corrected: boolean }`; the component keeps the `localStorage.setItem`/`console.log` side effects, calling this function for the decision | No stored value → current origin; stored matches current origin → unchanged; stored differs only by protocol (http↔https) on the same host/port → corrected to current origin; stored is not a valid URL → falls back to current origin |

**Subtotal: 13 test files, ~18 functions, 8 extractions (2 renames/parameterizations, 6 export-only).**

---

## Grand total for this pass

- **20 test files** (7 backend, 13 frontend), **~30 functions**
- **13 items require a refactor first** — most are one-line `export` additions (`normalizeVfoName`, `ts()`/`formatArg()`, `readCollapsed`, the `SolarPanel` color functions, `computeDisplayBandwidth`, `formatUptime`/`formatDuration`, `buildFilename`); a smaller set need an actual extraction-with-parameters out of a component/hook closure (`isSettingsValid`, the radios-list dedupe, `buildLogContent`, `App.tsx`'s three label helpers and its backend-URL resolution, `PhoneLayout`'s `movePhonePanel`). All are mechanical — no behavior change, just making existing logic reachable from a test.
- Zero new test infrastructure — reuses the existing `vitest.config.ts` (jsdom default, `@vitest-environment node` override) and the co-located `*.test.ts` convention already established

## Verification

- `npm run test` passes with all new files included
- `npm run lint` passes (the refactors must not change any call-site behavior)
- Spot-check that extracted/exported functions are actually called from their original call sites unchanged (no accidental behavior drift), by re-running `npm run test:e2e` (the existing VfoPanel/SpectrumHamlibPanel specs exercise several of the modules being touched — `rigComm.ts`, `App.tsx` indirectly — as a regression check)

## Deferred (Tiers 2–4, not in this pass)

- **Tier 2** — hook-level tests via stub socket (same pattern as `useSpectrum.test.ts`): `useAuth`'s state machine, `useWsjtxBridge`'s `handleCommand`, `useDiagnostics`'s log-window pruning, `usePotaSpots`'s filter/dedupe/sort pipeline
- **Tier 3** — e2e panel tests extending the existing Dummy-rigctld fixture: `ControlsPanel`, `TabbedMeterPanel`, `RfLevelsPanel`, `ModeBwPanel`, `CommandConsolePanel`
- **Tier 4** — e2e tests needing new fixtures: `SolarPanel`/`SpotsPanel`/`MufMapPanel` (fetch interception), `AudioFeedPanel`/`VideoFeedPanel` (Playwright fake-device flags), auth/admin flows, CW keyer/decoder, WSJTX bridge
