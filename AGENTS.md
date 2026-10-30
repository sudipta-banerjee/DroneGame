# AGENTS.md — AI Coding Assistant Guidelines & Architectural Standards

Welcome, AI Agent! This document defines the engineering standards, architectural invariants, and workflow guidelines for contributing to **Neon Drone** (`DroneGame`).

Always read and adhere to these guidelines before writing or modifying code in this repository.

> 🚀 **New Session Onboarding:** Whenever a new chat begins or you are asked to make fixes/enhancements, invoke or review the **`/start`** skill ([.agents/skills/start/SKILL.md](file:///c:/Projects/DroneGame/.agents/skills/start/SKILL.md)) to immediately load the full repository mental model, recent bug fix history, and flight invariants.

---

## 1. Project Overview & Tech Stack

Neon Drone is a high-performance, futuristic 3D cyberpunk drone simulator designed to run smoothly at 60–120 FPS across both desktop computers and mobile devices.

- **Build Tool:** Vite 8 (`npm run dev`, `npm run build`, `npm run preview`)
- **3D Graphics Engine:** Three.js (`three` ^0.183.2)
- **Physics Engine:** Cannon-es (`cannon-es` ^0.20.0)
- **Virtual Controls:** Custom `TouchJoystick.js` (native Pointer Events + Pointer Capture)
- **Audio System:** Web Audio API (procedural synthesis, zero external sound assets)
- **Styling:** Vanilla CSS3 with Cyberpunk neon variables, CSS Grid/Flexbox, glassmorphism
- **Mobile Debugging:** Local Eruda (`public/eruda.js`, on-screen DevTools)
- **Telemetry & Analytics:** `@vercel/analytics`, `@vercel/speed-insights`

---

## 2. Core Agentic Invariants & Safety Protocols

### 🚫 Localhost-First (Never Push Without User Permission)
- **DO NOT** execute `git push` or deploy unless the user explicitly requests it.
- Always test, build, and verify changes locally on `localhost` first.
- Maintain existing comments, documentation integrity, and Dhruv's educational guides (`docs/DHRUV_GUIDE.md`).

### 🎮 Physics Invariants (Quadcopter Flight Model)
1. **Coordinate System:**
   - $+Y$ is **UP** (World Up).
   - $-Z$ is **FORWARD** (Nose facing forward into the grid).
   - $+X$ is **RIGHT**.
2. **Auto-Hover & Gravity:**
   - Gravity is set to $(0, -9.82, 0)\text{ m/s}^2$ in `PhysicsWorld.js`.
   - The drone physics body has mass $= 1\text{ kg}$.
   - Baseline hover force is exactly $9.82\text{ N}$ directed along local $+Y$.
   - Tilt compensation scales upward thrust by $\frac{1}{\cos(\theta)}$ to prevent altitude drops during banking.
3. **The 30° Max Tilt Angle Limiter (Anti-Flip Guard):**
   - **Never apply unbounded open-loop torque for pitch or roll.**
   - The drone operates in **Angle Mode (Attitude PD Control)**: user input represents a target angle bounded to $\pm 30^\circ$ ($0.5236\text{ radians}$).
   - Combined diagonal tilt is normalized: $\sqrt{\text{pitch}^2 + \text{roll}^2} \le 30^\circ$.
   - An emergency restorative safety net automatically rightens the drone if knocked past $30^\circ$ by a high-speed collision, making it physically **impossible to flip upside down**.
4. **Collision Event Filtering:**
   - Do not trigger collision sound or screen flash for resting or sliding on the floor.
   - Filter `collide` events by impact velocity: ignore impacts $< 3.2\text{ m/s}$.

### 📱 Mobile Touch & Responsiveness Invariants
1. **Never use global `* { touch-action: none; }`:**
   - Scoped `touch-action: none` strictly to `#game-container, canvas, .joystick-zone`.
   - Modals and overlays (`.overlay`, `.menu-content`) MUST allow `touch-action: pan-y; -webkit-overflow-scrolling: touch;` so touch dragging and scrolling work naturally.
2. **Virtual Joysticks:**
   - Avoid legacy external touch libraries (e.g. `nipplejs`).
   - Use the native `src/TouchJoystick.js` module, which uses `setPointerCapture` to maintain touch tracking even when fingers move beyond the joystick circle.
3. **Landscape Viewport Rules:**
   - Mobile gaming occurs primarily in landscape mode. Always verify layouts under short viewport heights (`@media screen and (max-height: 520px)`).
   - All modal dialogs must feature a prominent, thumb-friendly circular `[✕]` close button (`.dialog-close-btn`) and dismiss when tapping the backdrop.

### ⚡ Performance & Rendering Constraints
1. **Device Pixel Ratio (DPR) Cap:**
   - In `main.js`, `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` is strictly enforced to prevent GPU overheating and frame drops on 3×/4× mobile displays.
2. **Delta Time Clamping:**
   - Physics delta time must be clamped to `Math.min(deltaTime, 0.05)` to avoid physics explosions when switching browser tabs.

---

## 3. Repository Architecture Map

```text
c:/Projects/DroneGame/
├── AGENTS.md                 # This file: AI agent instructions & coding standards
├── GEMINI.md                 # Antigravity agent configuration & workspace rules
├── .agents/                  # Agent customizations root
│   ├── rules/                # Domain-specific constraints & guidelines
│   └── skills/               # Reusable agentic testing & workflow skills
├── docs/
│   ├── DHRUV_GUIDE.md        # Educational aerospace guide for 10-year-old creator Dhruv
│   ├── KNOWLEDGE_BASE.md     # Deep architecture, flight mechanics & performance notes
│   └── MOBILE_ENHANCEMENT_TASKS.md # Mobile UX roadmap & task tracking
├── public/
│   ├── eruda.js              # Full standalone mobile in-browser DevTools
│   ├── manifest.json         # PWA Web App manifest
│   └── sw.js                 # Service worker
├── src/
│   ├── main.js               # Game loop, Three.js renderer, HUD orchestration, state
│   ├── Drone.js              # Quadcopter 3D model, physics body, attitude PD controller
│   ├── Controls.js           # Multi-input coordinator (Keyboard, TouchJoystick, Gyro)
│   ├── TouchJoystick.js      # Zero-dependency Pointer Events virtual joystick engine
│   ├── PhysicsWorld.js       # Cannon-es world setup, gravity, materials
│   ├── LevelManager.js       # Level ring spawner, collision checks, score tracking
│   ├── Audio.js              # Web Audio API synthesizer for engine hum and SFX
│   └── style.css             # Cyberpunk design system, responsive HUD, dialog styles
├── test_mobile_game.js       # Automated Puppeteer headless mobile verification suite
├── test_screenshots/        # Verification visual artifacts
├── index.html                # Main entry HTML, HUD structure, dialog modals
├── package.json              # Dependencies and scripts
└── vite.config.js            # Vite build configuration
```

---

## 4. Verification & Testing Workflow

Before concluding any task, verify your changes using the following sequence:

1. **Static Build Check:**
   ```powershell
   npm run build
   ```
   *Must exit with code 0 and generate `dist/` without warnings or syntax errors.*

2. **Automated Mobile & Desktop Gameplay Test:**
   ```powershell
   node test_mobile_game.js
   ```
   *Runs headless Chrome in mobile landscape touchscreen emulation to test:*
   - Main menu initialization
   - Flight start & HUD meters
   - 0 collision flashes on floor contact
   - Responsive Help dialog & scrolling
   - Virtual joystick altitude climb
   - 30° Max Tilt Angle Limiter & anti-flip recovery
   - Training Complete dialog dismissal via `[✕]`
   - On-screen RESET button

3. **Visual Inspection:**
   Inspect the captured test screenshots in `test_screenshots/` to confirm layout aesthetics and UI alignment.

---

## 5. Development Server Protocol

- **Starting Local Dev Server (accessible to desktop and local mobile devices):**
  ```powershell
  npm run dev -- --host
  ```
- **Windows Bootstrap Script:**
  ```powershell
  .\run-win.ps1
  ```
