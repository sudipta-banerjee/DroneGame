# Neon Drone — Knowledge Base

A single-source reference for the **Neon Drone** 3D flight simulator. Covers architecture, module APIs, the game loop, the input/physics model, the PWA setup, and a mobile-readiness assessment that will drive upcoming mobile work.

> Pull this file into future sessions on-demand with `#architecture` (see `.kiro/steering/architecture.md`). It is **not** auto-included, to keep everyday context lean.

---

## 1. Overview

Neon Drone is a browser-based, cyberpunk-styled 3D drone flight simulator. It renders with **Three.js** and simulates flight with **cannon-es**. Input is keyboard on desktop, and dual virtual joysticks (nipplejs) or device-tilt gyroscope on touch devices. It installs as a **PWA** (fullscreen, landscape).

| Aspect | Detail |
|---|---|
| Renderer | Three.js `WebGLRenderer` (antialias on) |
| Physics | cannon-es (fixed-step 1/60, SAP broadphase) |
| Input | Keyboard + nipplejs dual joysticks + DeviceOrientation gyro |
| Mobile UI | Two 120px joystick zones, portrait-warning overlay, settings control-mode select |
| Persistence | `localStorage` (`drone_total_flight_time`) |
| PWA | manifest.json (fullscreen + landscape) + no-op service worker |
| Build | Vite 8 (no custom `vite.config` — uses defaults) |

### Dependencies (from `package.json`)
- `three` 0.183.2
- `cannon-es` 0.20.0
- `nipplejs` 1.0.1
- `vite` 8.0.4 (dev)

### Scripts
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the built site

---

## 2. Project Structure

```
DroneGame/
├── index.html              # DOM: HUD, overlays, viewport meta, SW registration, module bootstrap
├── package.json            # Vite + three + cannon-es + nipplejs
├── public/
│   ├── favicon.svg         # App icon (also used as PWA icon)
│   ├── icons.svg           # Icon set
│   ├── manifest.json       # PWA manifest (fullscreen, landscape)
│   └── sw.js               # Service worker (skipWaiting + clients.claim, empty fetch)
└── src/
    ├── main.js             # Game class: init, loop, camera follow, HUD, state machine
    ├── Drone.js             # Drone entity: mesh + physics body + flight forces
    ├── PhysicsWorld.js     # cannon-es world wrapper
    ├── Controls.js         # Input aggregation: keyboard + joysticks + gyro
    ├── LevelManager.js     # Environment buildings + ring missions + scoring
    ├── counter.js           # UNUSED Vite boilerplate (safe to delete)
    ├── style.css           # Neon theme, HUD, overlays, joystick zones, media queries
    └── assets/             # hero.png, javascript.svg, vite.svg (unused template assets)
```

---

## 3. Architecture & Data Flow

```
index.html
   │  (module script: /src/main.js)
   ▼
src/main.js  (entry SHELL — tiny: style.css + @vercel/analytics + DOM overlay wiring)
   │  - Pure-DOM menu/settings/help/back/close-help wiring (work before the 3D bundle loads)
   │  - Lazy-loads src/game.js via dynamic import on "INITIALIZE FLIGHT"
   ▼
src/game.js  (heavy: three.js + cannon-es + nipplejs + Game class)
   └─►  new Game()
         ├── initThree()        Three.js scene/camera/renderer/lights
         ├── initPhysics()       new PhysicsWorld()
         ├── spawnEnvironment()  grid + ground plane (cannon-es)
         ├── initGameObjects()   Drone, Controls, LevelManager; practice stats; startLevel(0)
         ├── initUI()            wires in-game buttons (skip/end-practice/continue/restart/reset/control-mode)
         └── animate()           requestAnimationFrame loop → physics step → control poll →
                                 drone forces → boundary check → stats → render → camera follow
```

**Lazy-load (bundle optimization):** the initial download is ~2 KB gzipped (shell + analytics),
so the menu is interactive immediately. The ~163 KB gzipped 3D bundle only downloads when the
user clicks "INITIALIZE FLIGHT". Build output: `index-*.js` (shell) + `game-*.js` (lazy chunk).

**Per-frame data flow inside `animate()`** (`src/main.js`, the `Game.animate` method):

1. `physics.update(deltaTime)` — steps cannon-es (fixed 1/60, maxSubSteps 3).
2. `state = controls.getState()` — aggregates keyboard + joysticks + gyro into `{thrust, pitch, roll, yaw, reset}`, each clamped to [-1, 1].
3. If `state.reset` → instantly reposition drone to (0,2,0) and zero velocities. Otherwise:
   - `drone.applyThrust(state.thrust)` (hover baseline 9.82 + input)
   - `drone.moveForward(state.pitch)` / `moveSideways(state.roll)` / `rotate(state.yaw)` (torques)
   - `drone.autoLevel(pitch, roll)` — spring torque aligning local-up to world-up (always runs; prevents flips).
4. Boundary check (±100 on X/Z, y<100). If out, show 10s warning overlay; on timeout, reset drone and `startLevel(currentLevel)`.
5. Practice-mode bookkeeping (level 0): decrement `timeLeft`, increment `flightTime`, count left/right tilt transitions (deadzone 0.1), auto-show results at 0.
6. `drone.update(state)` — sync mesh↔physics, spin rotors, modulate thrust trails by per-rotor engine load.
7. `levelManager.checkCollisions(drone.group.position)` — distance-based ring collection (+100 each).
8. `updateHUD()` — altitude/speed/battery bars, timer, debug-joystick text.
9. **Camera follow**: decoupled — only yaw is extracted from the drone quaternion (pitch/roll ignored so the view stays steady). Offset `(0, 1.2, 4)` rotated by yaw, nudged by `-0.05 * velocity` for speed-drag, then `camera.position.lerp(target, 0.1)` and `camera.lookAt(drone)`.
10. `renderer.render(scene, camera)`.

**State machine** (simple, flag-based — no formal FSM):
- `isPlaying` (bool) gates the simulation + camera follow.
- `currentLevel` (0 = practice, 1 = mission/rings).
- Overlays toggled via `.active` class on DOM nodes: `menu-overlay`, `settings-overlay`, `results-overlay`, `warning-overlay`, `help-overlay`, `portrait-warning`.
- `isOutOfBounds` + `warningTimer` drive the out-of-zone countdown.

---

## 4. Module Reference

### `src/main.js` — `Game` class (entry point)
- Constructs everything, runs the loop. The `import * as CANNON from 'cannon-es'` sits at the **bottom** of the file (hoisted by ESM, so `spawnEnvironment` can use `CANNON.Plane()`). Unusual style — keep it in mind.
- `initThree()`: `PerspectiveCamera(75, w/h, 0.1, 1000)`; `renderer.setPixelRatio(window.devicePixelRatio)` (**uncapped** — see §7); `FogExp2(0x050505, 0.02)`.
- `initUI()`: wires all buttons. `enterFullscreen()` requests fullscreen on start/continue/restart (requires user gesture — OK).
- `startLevel(n)`: spawns level via `LevelManager`, toggles timer vs score UI visibility.
- `onWindowResize()`: updates camera aspect + renderer size — does **not** re-read `devicePixelRatio`.
- `updateHUD()`: updates alt/speed/battery bars; battery drains `0.005/frame` (frame-rate dependent — see §7); writes debug-joystick text.
- `showResults()`: persists `totalFlightSeconds` to `localStorage`, populates results grid.
- `animate()`: see §3. `deltaTime = 0.016` is **hardcoded** (see §7).
- Bottom of file: `new Game();` boots everything.

### `src/Drone.js` — `Drone` class
Settings: `thrustForce = 15`, `rotationSpeed = 0.8`, `tiltForce = 4`.
- `initMesh()`: Group with a multi-material box body (green top / red bottom for orientation), a yellow front marker on -Z, two crossed arms, four cyan rotors, and four downward "thrust trail" cylinders (additive blending, scale/opacity animated by load).
- `initPhysics()`: `CANNON.Box(0.25, 0.05, 0.25)`, `mass = 1`, `linearDamping = 0.3`, `angularDamping = 0.8` (high for flight stability). Positioned at `(0, 0.05, 0)`.
- `update(state)`: copies body pos/quat to the group; per-rotor computes `engineLoad` from `thrust + pitch/roll bias`, spins `rotation.y += 0.3*(1+load)`, lerps trail scale/opacity.
- `applyThrust(amount)`: hover baseline `9.82` counters gravity; positive input adds up to `(thrustForce - hoverForce)`; negative input subtracts (max -0.5 from controls). Force applied along local +Y rotated by body quaternion (so tilted thrust moves the drone).
- `moveForward(amount)` / `moveSideways(amount)` / `rotate(amount)`: apply local torques (pitch = -X torque, roll = -Z torque, yaw = +Y torque), each rotated to world by the body quaternion.
- `autoLevel(pitch, roll)`: **always runs**. Cross product of local-up and world-up gives the alignment axis; scaled by `levelingStrength = 8` and applied as torque. Special-cases fully-inverted (`localUp.y < -0.9`) to nudge recovery. This is what keeps the drone from flipping and gives the "return to level" feel when you release pitch/roll.

### `src/PhysicsWorld.js` — `PhysicsWorld` class
Thin cannon-es wrapper.
- `gravity = (0, -9.82, 0)`.
- `broadphase = SAPBroadphase`, `allowSleep = true`.
- Default contact material: `friction 0.1`, `restitution 0.3`.
- `update(dt)`: `world.step(1/60, dt, 3)` — fixed timestep 1/60, max 3 substeps.

### `src/Controls.js` — `Controls` class
Aggregates three input sources. Default `mode = 'joystick'`.
- `initKeyboard()`: WASD (pitch/roll), Space/Shift (thrust up/down), Q/E (yaw), R (reset).
- `initMobile()`: creates `#joysticks-container` with two `.joystick-zone` divs, instantiates two nipplejs managers (mode `semi`, `catchDistance 150`, left=cyan, right=magenta). Left joystick Y→thrust, X→yaw (X inverted). Right joystick Y→pitch, X→roll. Hides the container on non-touch devices via `ontouchstart`/`maxTouchPoints` detection. Also binds `deviceorientation` (beta→pitch, gamma→roll, only active when `mode === 'gyro'`).
- `setMode(mode)`: switches right-stick source between joystick and gyro; dims the right joystick UI in gyro mode.
- `getState()`: returns `{thrust, pitch, roll, yaw, reset}`, summing keyboard + active mobile source, clamped to [-1, 1]. This is the single function the game loop polls.

### `src/LevelManager.js` — `LevelManager` class
- `initEnvironment()`: scatters 20 cyberpunk buildings (box meshes + static cannon body each), skipping the center 10-unit radius.
- `spawnLevel(n)`: clears existing rings. `n === 0` (practice) → no rings. `n >= 1` → spawns 5 torus rings climbing away in -Z. **Note:** the constructor calls `spawnLevel(1)`, then `main.js` immediately calls `startLevel(0)` which calls `spawnLevel(0)` — so rings spawn then get cleared on every boot. Minor waste, not a bug.
- `checkCollisions(dronePos)`: distance check `< 2.0` to any ring → remove, `score += 100`, update `#current-score`, call `flashRing` (currently a no-op placeholder).
- `score` is reset only by reconstructing `LevelManager` (which doesn't happen across levels) — worth noting if scoring feels sticky.

### `src/counter.js`
Unused Vite template boilerplate (`setupCounter`). Not imported anywhere. Safe to delete.

---

## 5. Input System

| Source | thrust | pitch | roll | yaw | reset |
|---|---|---|---|---|---|
| Keyboard | Space / Shift | W / S | A / D | Q / E | R |
| Left joystick | Y (up=+) | — | — | X (inverted) | — |
| Right joystick (joystick mode) | — | Y | X | — | — |
| DeviceOrientation (gyro mode) | — | beta (−45 neutral)/45 | gamma/45 | — | — |

`getState()` sums all active sources and clamps to [-1, 1], so keyboard + touch can combine. `R` (reset) is keyboard-only — **there is no on-screen reset for touch users** (see §7).

---

## 6. UI / HUD / Overlays

Defined in `index.html`, styled in `src/style.css`.

- **HUD** (`#hud`, `pointer-events: none`): top row = LEVEL / TIMER / SCORE / END-PRACTICE / SKIP / HELP buttons; bottom row = ALTITUDE / SPEED / BATTERY meter groups.
- **Overlays** (`.overlay` + `.active`): menu, settings (control-mode `<select>`), results (practice stats grid + cumulative flight hours), warning (red out-of-zone countdown), help (desktop + mobile instructions), loading screen (1.5s auto-hide), portrait-warning.
- **Joysticks container**: `position: absolute; bottom: 40px; padding: 0 40px; height: 150px;` with two 120px circular zones. `pointer-events: none` on the container, `auto` on the zones.
- **Global CSS**: `user-select: none`, `-webkit-tap-highlight-color: transparent`, `touch-action: none` on `*` — good for a game (prevents text selection / double-tap zoom on touch).
- **Media queries**:
  - `max-width: 900px and portrait` → show `#portrait-warning`.
  - `max-height: 500px` → compact menu (smaller h1, inline buttons).
- **Theme**: CSS variables `--neon-cyan #00f2ff`, `--neon-pink #ff00ff`, `--bg-dark #050505`; fonts Orbitron (accent) + Rajdhani (main) from Google Fonts.

### PWA / Mobile meta (in `index.html`)
- viewport: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover` (good — `viewport-fit=cover` enables safe-area insets, which are **not yet used** in CSS).
- `apple-mobile-web-app-capable=yes`, status bar `black-translucent`, title `Neon Drone`.
- Service worker registered on `window load` (best-effort, errors logged).
- `manifest.json`: `display: fullscreen`, `orientation: landscape`, single SVG icon declared for 192/512/any/maskable.
- `sw.js`: `skipWaiting` + `clients.claim` on install/activate; **empty fetch listener** (intentionally non-intercepting so it doesn't break Vite's module loading). Satisfies PWA install criteria only — no offline caching.

---

## 7. Mobile-Readiness Assessment (drives the next phase)

The game already has touch input (nipplejs + gyro scaffolding), a viewport meta, and portrait handling — so it is **not** keyboard-only. However, several gaps currently make it unplayable or degraded on mobile. Ranked by impact.

### Critical (blocks playability)
1. **iOS 13+ gyro permission never requested.** `Controls.initMobile()` listens to `deviceorientation` but never calls `DeviceOrientationEvent.requestPermission()`. On iOS 13+, the gyro mode produces no data until a user-gesture triggers the permission prompt. Fix: request permission on a user gesture (e.g., a "Enable Tilt" button, or when the user switches control-mode to `gyro` in Settings).
2. **No on-screen reset.** `state.reset` is only set by the `R` key. Touch users cannot manually reset — they must wait for the 10-second out-of-bounds auto-reset. Add a mobile reset button to the HUD.
3. **Frame-rate-dependent simulation.** `deltaTime = 0.016` is hardcoded in `animate()`, and `physics.update(0.016)` is called every RAF tick. On 90/120Hz phones the loop fires more often, so the physics, practice timer, warning timer, and battery drain all run fast (roughly proportional to refresh rate). Fix: compute real `dt = clamp(now - last, 0, 0.05)` and pass it through; keep cannon-es's fixed internal step.

### High (degrades experience / performance)
4. **Uncapped `devicePixelRatio`.** `renderer.setPixelRatio(window.devicePixelRatio)` on phones with 3x–4x DPR causes massive overdraw (antialias + fog + many materials). Fix: `Math.min(window.devicePixelRatio, 2)` (or 1.5 on low-end).
5. **No safe-area-inset usage.** `viewport-fit=cover` is set, but CSS uses fixed `bottom: 40px` / `padding: 0 40px` for the joystick container and `padding: 20px` for the HUD. On notched/home-indicator iPhones these overlap system UI. Fix: add `env(safe-area-inset-*)` padding/margins.
6. **Debug-joystick overlay always visible.** `#debug-joystick` is a dev tool that clutters the top-center of the mobile screen. Gate it behind a flag (e.g., `?debug=1` or `localStorage`) and hide by default.

### Medium (polish / accessibility)
7. **Small tap targets.** `.glow-btn.small` (help/skip/end-practice) is ~32px tall — below the 44px (iOS) / 48px (Android) recommendation. Increase min height for touch.
8. **Joystick zones are fixed 120px / 40px padding.** Fine on most phones, but thumb-reach on small landscape viewports (e.g., iPhone SE-class 320px tall) is tight. Consider sizing relative to viewport or anchoring to safe areas.
9. **Portrait warning doesn't pause the game.** The overlay shows but physics + render continue behind it, draining battery. Pause `isPlaying` while portrait-warning is active.
10. **No haptics.** `navigator.vibrate()` on ring-collection / collisions would improve mobile feel. Nice-to-have.

### Low
11. `onWindowResize` doesn't re-read `devicePixelRatio` (matters mostly for desktop multi-monitor). 
12. Help overlay is desktop-first in tone; mobile instructions exist but the entry button is the small `?`.
13. `counter.js` is dead code.

---

## 8. Gotchas & Conventions

- **`import * as CANNON` is at the bottom of `main.js`** (ESM hoists it, so it works, but it reads oddly).
- **`LevelManager` constructor calls `spawnLevel(1)`**, then `main.js` calls `startLevel(0)` → rings spawn then immediately clear every boot.
- **`LevelManager.score` is not reset between levels** in the current flow (no reconstruction between missions). Verify before relying on it.
- **`autoLevel` always runs** — intentional. It is the anti-flip mechanism; do not early-return on pitch/roll input.
- **Hover baseline is hardcoded `9.82`** in `Drone.applyThrust`, tied to `PhysicsWorld` gravity and `mass = 1`. Changing any of those three breaks hover.
- **Camera follow uses yaw only** (extracted via `Euler('YXZ')`) so the horizon stays level even when the drone pitches/rolls. This is a deliberate UX choice.
- **Battery drain (`0.005/frame`) and timers are frame-rate-coupled** — fixing §7.3 fixes all of them together.
- **Service worker intentionally does not cache** — adding real caching must avoid breaking Vite's module loading in dev (use a build-only/preview-only strategy).

---

## 9. Development Commands

```bash
npm install      # one-time
npm run dev      # Vite dev server (run manually in a terminal — long-running)
npm run build    # production build to dist/
npm run preview  # serve the built site
```

No `vite.config` exists — Vite runs on defaults. There is no test framework configured.


---

## 10. Deployment

| Aspect | Detail |
|---|---|
| Host | Vercel (static) |
| Live site | https://dhruv.sudiptabanerjee.com |
| Project | https://vercel.com/sudipta-banerjees-projects/drone-game |
| Build output | Vite default `dist/` (SPA) |

### Notes for mobile work
- Vercel serves static assets over HTTPS with correct MIME types — good for `manifest.json`, service worker registration, and the Web GPU/WebGL context.
- The current `sw.js` has an **empty fetch handler** (no caching), so Vercel's CDN handles all asset delivery. If we add real offline caching later, scope the cache to built assets only and skip module requests in dev — but since this is a Vercel deploy of a built bundle, a runtime caching strategy (stale-while-revalidate for hashed assets) becomes viable and won't interfere with Vite dev.
- Validate mobile fixes on the live URL after each deploy (real device testing matters more than desktop emulation for touch, gyro, safe-area, and DPR behavior).
- Vercel auto-deploys on push to the connected branch, so commits land on `dhruv.sudiptabanerjee.com` quickly — keep commits small and self-contained during the mobile enhancement work.
