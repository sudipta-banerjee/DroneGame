# Mobile Experience Enhancement — Task List

Working list derived from a code-level playthrough of Neon Drone (source traced across
`main.js`, `Controls.js`, `Drone.js`, `PhysicsWorld.js`, `LevelManager.js`, `style.css`,
`index.html`, `manifest.json`, `sw.js`). Ordered so each task is independently shippable and
verifiable. Check items off as we complete them, one at a time.

> Note on method: I booted the game locally (Vite v8.0.8, HTTP 200 on page + assets) and
> traced every interaction path through the source. A rendered WebGL canvas can't be visually
> inspected by an agent, so these findings are code-grounded, with file/line references.

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Findings summary

### Confirmed bugs (affect all platforms)
- **Battery never resets.** `updateHUD()` drains `bat-val` by `0.005/frame`, but neither
  `startLevel()` nor the `restart-practice-btn` handler resets it. After the first practice
  session the battery is permanently 0%.
- **Score never resets.** `LevelManager.score = 0` only in the constructor; `spawnLevel()` /
  `startLevel()` don't reset it. Score persists across retries and climbs forever.
- **Mission has no win condition.** `checkCollisions()` removes rings and adds +100, but
  never checks `rings.length === 0`. After collecting all 5 rings, nothing happens.

### Mobile blockers (the stated "not playable on mobile" pain)
- **No on-screen reset.** `state.reset` is set only by the `R` key. A stuck drone on mobile
  has no manual reset — must wait for the 10s out-of-bounds timer (which only triggers past
  ±100 / y>100, so a mid-field tip-over is a soft-lock until the 120s practice timer ends).
- **iOS gyro is dead.** `Controls.initMobile()` listens to `deviceorientation` but never
  calls `DeviceOrientationEvent.requestPermission()`. On iOS 13+ the gyro mode produces no
  data without a user-gesture permission prompt.
- **Frame-rate-dependent loop.** `deltaTime = 0.016` is hardcoded in `animate()` and
  `physics.update(0.016)` runs every RAF tick. On 90/120Hz mobile the simulation, practice
  timer, warning timer, and battery drain all run fast (roughly proportional to refresh rate).
- **Uncapped `devicePixelRatio`.** `setPixelRatio(window.devicePixelRatio)` → 3x fillrate
  on phones, with antialias + fog + many materials. Performance hit.
- **No safe-area insets.** `viewport-fit=cover` is set but `env(safe-area-inset-*)` is unused.
  Notch / home indicator overlaps the HUD and joystick zones on iPhones.

### Mobile polish
- **Debug telemetry overlay always on.** `#debug-joystick` always renders input telemetry at
  top-center; clutters the mobile screen.
- **Tap targets too small.** `.glow-btn.small` (help / skip / end-practice) ~32px tall,
  below the 44px (iOS) / 48px (Android) minimum.
- **Portrait warning doesn't pause.** Pure CSS media query; physics + timers keep running
  behind the overlay, draining battery.
- **Help is desktop-first** — the entry button is the tiny `?`.

### Enhancement opportunities
- **No audio at all** — no engine hum, wind, ring chime, collision thud, or UI clicks.
- **`flashRing` is a no-op placeholder** — ring collection has no visual feedback.
- **No collision feedback** — hitting a building (restitution 0.3) gives no visual/audio cue.
- **No pause/resume** — no ESC menu or pause button mid-flight.
- **Camera swings on reset** — `R` / out-of-bounds reset snaps the drone but the camera lerps
  from its old position, causing a long swing across the map.

---

## Tasks

### T1 — Fix the frame-rate-dependent game loop  `[x]`
**Why:** Foundational. Every timer (practice, warning, battery) and the physics cadence are
currently tied to refresh rate, so the game plays faster on high-refresh mobile. Fixing this
first makes all later tuning consistent.
**Files:** `src/main.js`
**Acceptance:**
- Replace `const deltaTime = 0.016` with a real, clamped delta: `dt = Math.min((now - last)/1000, 0.05)`.
- Convert frame-based counters to per-second rates: battery drain `0.005*60 = 0.3/s`, warning
  timer already in seconds, `practiceStats.timeLeft` already in seconds.
- Keep cannon-es fixed internal step (`world.step(1/60, dt, 3)`).
- On a 120Hz display, flight speed + timers match 60Hz.
- Switching tabs and returning doesn't cause a physics jump (dt clamped to 0.05).

### T2 — Add an on-screen Reset button for touch  `[x]`
**Why:** Critical mobile unblock — touch users currently can't recover from a stuck/tipped drone.
**Files:** `index.html`, `src/main.js`, `src/style.css`
**Acceptance:**
- A reset button appears in the HUD, visible on touch devices (hide on desktop or keep but
  unobtrusive).
- Tapping it triggers the same reset as the `R` key (position (0,2,0), zero velocity/angular
  velocity, identity quaternion).
- Tap target ≥ 44px.

### T3 — Request iOS DeviceOrientation permission for gyro mode  `[x]`
**Why:** Critical mobile unblock — gyro mode is dead on iOS 13+ without a permission prompt.
**Files:** `src/Controls.js`, `index.html` (status span), `src/style.css`
**Acceptance:**
- When the user selects "GYROSCOPE / TILT", `DeviceOrientationEvent.requestPermission()` is
  called from the change handler (user gesture). Non-iOS (no `requestPermission`) is a no-op.
- Denied permission shows a clear message and falls back to joystick mode.
- On iOS 13+, granting permission enables tilt control immediately.

### T4 — Cap devicePixelRatio for mobile performance  `[x]`
**Why:** High mobile perf — uncapped DPR causes heavy overdraw on 3x phones.
**Files:** `src/main.js`
**Acceptance:**
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` (tunable; 1.5 on low-end if
  we add detection).
- `onWindowResize()` re-applies the cap.
- Smoother FPS on a 3x phone; visuals remain sharp.

### T5 — Safe-area insets for notches / home indicator  `[x]`
**Why:** High mobile UX — controls overlap system UI on notched iPhones.
**Files:** `src/style.css`
**Acceptance:**
- HUD padding and joystick container position/padding use `env(safe-area-inset-*)`.
- On a notched iPhone in landscape, the joysticks and HUD don't overlap the notch or home
  indicator.

### T6 — Hide the debug-joystick overlay by default  `[x]`
**Why:** Polish — dev telemetry clutters the mobile screen.
**Files:** `index.html` (or `src/main.js`), `src/style.css`
**Acceptance:**
- `#debug-joystick` is hidden by default.
- `?debug=1` (or a localStorage flag) re-enables it.

### T7 — Increase touch target sizes  `[x]`
**Why:** Accessibility/mobile — buttons are below the 44px tap minimum.
**Files:** `src/style.css`
**Acceptance:**
- `.glow-btn.small` (and any HUD action buttons) have a min-height ≥ 44px and adequate padding.
- Buttons remain easy to tap without accidental misses.

### T8 — Pause the game when the portrait warning is active  `[ ]`
**Why:** Battery/UX — physics + timers keep running behind the portrait overlay.
**Files:** `src/main.js`
**Acceptance:**
- A `matchMedia('(orientation: portrait)')` (or the existing `max-width:900px and portrait`
  query) listener sets `isPlaying = false` when portrait and restores it on landscape (only if
  it was playing before).
- Timers (practice, warning, battery) freeze while paused.

### T9 — Reset battery and score on (re)start  `[ ]`
**Why:** Gameplay integrity — battery is a one-shot countdown; score never resets.
**Files:** `src/main.js` (battery), `src/LevelManager.js` (score reset)
**Acceptance:**
- `startLevel()` (and the restart handler) reset battery to 100.
- `spawnLevel()` (or a `resetScore()` method) resets `LevelManager.score` to 0 on a new mission.
- Restarting practice shows 100% battery; restarting a mission shows 0 score.

### T10 — Add a mission-complete win condition  `[ ]`
**Why:** Gameplay gap — collecting all 5 rings does nothing.
**Files:** `src/LevelManager.js` (completion check + callback), `index.html` (overlay),
`src/main.js` (handler)
**Acceptance:**
- When `rings.length === 0` after a collection, a "MISSION COMPLETE" overlay shows.
- Options to replay the mission or return to the menu.
- Score is finalized and displayed.

### T11 — Audio system  `[ ]`
**Why:** Enhancement — a flight sim with zero audio feels hollow.
**Files:** new `src/Audio.js`, `src/main.js` (hooks), `index.html` (mute toggle)
**Acceptance:**
- Engine hum whose pitch/volume scales with thrust.
- Ring-collection chime, collision thud, UI button clicks.
- A mute toggle in the HUD/settings; respects `localStorage` preference.
- Starts only after a user gesture (browser autoplay policy).

### T12 — Visual feedback: ring collection + collisions  `[ ]`
**Why:** Enhancement — `flashRing` is a no-op; building collisions have no feedback.
**Files:** `src/LevelManager.js` (`flashRing`), `src/main.js` (collision event), `src/Drone.js`
**Acceptance:**
- Ring pickup shows a particle/flash burst at the ring's position.
- Building collision shows a brief flash / screen shake.
- No noticeable perf regression.

---

## Bonus (not in the core 12; pick up if time allows)
- **Pause/resume menu** (ESC or button) mid-flight.
- **Camera snap on reset** to avoid the post-reset swing.
- **`prefers-reduced-motion`** support for the loader / tilt animation.
- **Haptics** (`navigator.vibrate`) on ring pickup / collisions for mobile.
- **Delete dead code** (`src/counter.js`, unused `src/assets/*`).
