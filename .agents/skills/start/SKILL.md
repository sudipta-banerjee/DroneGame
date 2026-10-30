---
name: start
description: >-
  Use this skill at the beginning of a chat session, when the user invokes /start,
  or before starting any fixes or enhancements on Neon Drone. It provides the full
  project context, core architectural invariants, flight mechanics, mobile standards,
  recent bug fix history, and testing runbooks.
---

# /start — Neon Drone Project Context & Onboarding Guide

Welcome! This skill provides the complete mental model, engineering invariants, and operational workflows for the **Neon Drone** (`DroneGame`) repository. 

Whenever you begin a session or the user types `/start`, review this checklist before modifying or adding code.

---

## 1. Project Overview & Architecture

Neon Drone is a high-performance 3D cyberpunk drone simulator designed to run at 60–120 FPS across both desktop and mobile devices.

```text
c:/Projects/DroneGame/
├── AGENTS.md                 # Universal AI agent instructions & coding standards
├── GEMINI.md                 # Antigravity/Gemini workspace configuration
├── .agents/                  # Customization root
│   ├── rules/                # Domain-specific constraints (physics, mobile UX)
│   └── skills/
│       ├── start/SKILL.md    # This file: session onboarding & project context
│       └── game-testing/     # Automated mobile & desktop test runbook
├── docs/
│   ├── DHRUV_GUIDE.md        # Aerospace & physics guide for creator Dhruv (Age 10)
│   ├── KNOWLEDGE_BASE.md     # In-depth architectural & flight mechanics notes
│   └── MOBILE_ENHANCEMENT_TASKS.md # Mobile UX roadmap
├── public/
│   ├── eruda.js              # Standalone mobile in-browser DevTools (offline)
│   ├── manifest.json         # PWA Web App manifest
│   └── sw.js                 # Service worker
├── src/
│   ├── main.js               # Game loop, Three.js renderer, HUD orchestration, state
│   ├── Drone.js              # Quadcopter 3D model, physics body, attitude PD controller
│   ├── Controls.js           # Multi-input coordinator (Keyboard, TouchJoystick, Gyro)
│   ├── TouchJoystick.js      # Zero-dependency Pointer Events virtual joystick engine
│   ├── PhysicsWorld.js       # Cannon-es physics world setup, gravity, materials
│   ├── LevelManager.js       # Spawner for rings, obstacles, collision detection
│   ├── Audio.js              # Web Audio API procedural sound engine (no audio assets)
│   └── style.css             # Cyberpunk design system, responsive HUD, dialog styles
├── test_mobile_game.js       # Automated Puppeteer headless mobile verification suite
├── test_screenshots/        # Captured visual artifacts from test runs
├── index.html                # Entry HTML, HUD structure, dialog modals
├── package.json              # Dependencies and scripts
└── vite.config.js            # Vite build configuration
```

---

## 2. Immutable Invariants (NEVER Break These)

### 🚫 1. Localhost First (Never Push Without User Permission)
- **NEVER** run `git push` or deploy unless the user explicitly tells you to do so.
- Keep all fixes verified locally on `localhost`.

### 🚁 2. Quadcopter Flight Physics & The 30° Max Tilt Limiter
- **Coordinate System:** $+Y$ is **UP**, $-Z$ is **FORWARD**, $+X$ is **RIGHT**.
- **Gravity & Auto-Hover:** Gravity is $(0, -9.82, 0)\text{ m/s}^2$. The drone body has mass $= 1\text{ kg}$. Auto-hover baseline upward force is $9.82\text{ N}$ along local $+Y$.
- **Tilt Compensation:** Upward thrust is scaled by $\frac{1}{\cos(\text{tilt})}$, clamped at $\cos(\text{tilt}) \ge 0.5$, to maintain altitude during banking.
- **The 30° Max Tilt Angle Limiter (Anti-Flip Guard):**
  - The drone operates in **Angle Mode (Attitude PD Control)** in `src/Drone.js`.
  - Stick/keyboard inputs specify a target angle bounded to $\pm 30^\circ$ ($0.5236\text{ radians}$).
  - Diagonal inputs are normalized so $\sqrt{\text{pitch}^2 + \text{roll}^2} \le 30^\circ$.
  - An emergency restorative safety net pulls the drone upright if disturbed past $30^\circ$ by collisions, making it physically **impossible to flip upside down**.
  - **Never** add unbounded open-loop torques for pitch or roll that fight the attitude controller!

### 📱 3. Mobile Touch & Responsive Guidelines
- **Touch Actions:** Never apply global `* { touch-action: none; }`. Only `#game-container, canvas, .joystick-zone`.
- **Modals:** All overlays (`.overlay`, `.menu-content`) must have `touch-action: pan-y; -webkit-overflow-scrolling: touch;` so touch scrolling works naturally.
- **Close Buttons:** Every modal dialog must have a circular `[✕]` close button (`.dialog-close-btn`) in the top-right corner and dismiss when tapping the backdrop.
- **Landscape Viewport:** Optimize all layouts for short phone screens (`@media screen and (max-height: 520px)`).
- **Virtual Joysticks:** Use `src/TouchJoystick.js` exclusively (uses native `setPointerCapture` to maintain touch tracking outside the circle).

### ⚡ 4. Collision Event Filtering
- In `main.js`, `collide` events from Cannon-es must filter by impact velocity: ignore impacts $< 3.2\text{ m/s}$ to prevent continuous floor flashes.
- Screen flash is a peripheral vignette (`box-shadow: inset 0 0 70px rgba(255, 30, 30, 0.85)`), never an opaque screen cover.

### 🎓 5. Educational Integrity
- Preserve and update `docs/DHRUV_GUIDE.md` for creator Dhruv (Age 10). Document flight mechanics and physics concepts in engaging, kid-friendly aerospace language.

---

## 3. History of Key Problems Solved (Context Continuity)

1. **Screen Flickering Black/Red:**
   - *Cause:* Cannon-es was dispatching micro-contacts on the floor plane every 500ms, triggering full-screen red flashes over black background.
   - *Fix:* Added `impactVel < 3.2 m/s` threshold in `main.js` and changed `#collision-flash` to a transparent peripheral vignette.
2. **Mobile Dialogs Unresponsive & Cannot Close:**
   - *Cause:* Global `* { touch-action: none; }` blocked touch scrolling; dialogs were too tall for landscape mobile screens and lacked close buttons.
   - *Fix:* Scoped touch-action, added `pan-y` scrolling, added circular `[✕]` close buttons, and redesigned Help into side-by-side Desktop and Mobile columns.
3. **Mobile Altitude Climb / Liftoff Failure:**
   - *Cause:* Legacy `nipplejs` library had touch coordinate bugs; static ground friction held the drone down.
   - *Fix:* Replaced `nipplejs` with custom native `TouchJoystick.js`, increased `thrustForce` to 22, and added ground liftoff boost when thrust $> 0.05$ near the floor.
4. **Drone Flipping Upside Down:**
   - *Cause:* Unbounded open-loop torques overpowered the auto-leveling torque, letting the drone tilt to $86.7^\circ$ and flip.
   - *Fix:* Implemented an Attitude PD Controller with a strict 30° Max Tilt Angle Limiter and emergency anti-flip recovery envelope.
5. **"Frozen" Drone Illusion:**
   - *Cause:* Early prototype had camera welded to the drone body; both moved together at identical speed, making the drone look stationary relative to the screen.
   - *Fix:* Positioned the camera in independent world space with a smooth lerp chase follow, camera drag, and decoupled pitch/roll.

---

## 4. Verification Workflow for Any New Task

Before marking any task as complete, execute this 3-step verification sequence:

### Step 1: Static Build Check
```powershell
npm run build
```
*Must build in < 2s with code 0 and 0 warnings.*

### Step 2: Automated Mobile & Desktop Gameplay Test
```powershell
node test_mobile_game.js
```
*Runs headless Chrome in mobile touchscreen landscape emulation to verify:*
- Settings modal & Eruda DevTools toggle
- Main menu flight initialization
- 0 ground collision flashes
- Help manual columns & scrolling
- Left virtual joystick altitude climb
- Right virtual joystick 30° tilt limit & anti-flip recovery
- Training Complete dialog dismissal via `[✕]`
- On-screen RESET button

### Step 3: Visual Inspection
Inspect screenshots in `test_screenshots/` (`05_help_dialog.png`, `06_climbing_altitude.png`, `06b_tilt_limited_flight.png`, `07_training_complete_dialog.png`) to ensure visual perfection.

---

## 5. Local Dev Server Commands

- **Start Dev Server (Desktop + Mobile LAN):**
  ```powershell
  npm run dev -- --host
  ```
  - Local URL: `http://localhost:5173/`
  - Mobile LAN URL: Check network output in terminal (e.g. `http://192.168.x.x:5173/`)
  - DevTools URL: Append `?debug=1` to auto-launch on-screen mobile console.
- **Windows All-in-One Launcher:**
  ```powershell
  .\run-win.ps1
  ```
