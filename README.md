# 🚁 NEON DRONE — High Performance 3D Flight Simulator

Welcome to **NEON DRONE**, a high-performance, futuristic 3D cyberpunk drone flight simulator built with **Vite 8**, **Three.js**, and **Cannon-es**. Designed to run smoothly at 60–120 FPS across both desktop computers and mobile touchscreen devices.

---

## 🚀 Quick Start (Localhost First)

### Windows (One-Click Setup)
```powershell
.\run-win.ps1
```
*Automatically checks Node.js, installs dependencies, and boots the local dev server.*

### Cross-Platform (Desktop & Mobile on Local Network)
```bash
# 1. Install dependencies
npm install

# 2. Start dev server accessible across your local WiFi / LAN
npm run dev -- --host
```

- **Desktop URL:** `http://localhost:5173/`
- **Mobile LAN URL:** Displayed in your terminal (e.g., `http://192.168.x.x:5173/`)
- **Mobile DevTools URL:** Append `?debug=1` (e.g., `http://localhost:5173/?debug=1`) to launch with on-screen DevTools.

---

## 🎮 How to Play

### Objectives
- Fly your quadcopter through the **Neon Rings** scattered around the cyberpunk grid.
- Each ring collected awards **100 points**.
- Keep an eye on your **Battery** meter! It gently drains during flight.
- Train in Level 0 (free practice) or collect rings against the clock.

### 🕹️ Desktop Controls (Keyboard)

| Key | Action |
|:---|:---|
| **W / S** | Pitch Forward / Pitch Backward |
| **A / D** | Roll Left / Roll Right (Bank) |
| **Space** | Increase Thrust (Climb in Altitude) |
| **Left Shift** | Decrease Thrust (Descend) |
| **Q / E** | Yaw Left / Yaw Right (Rotate in place) |
| **R** | Reset Drone (Instantly return to spawn) |

### 📱 Mobile Controls (Touchscreen)
The game detects touchscreens automatically and presents custom virtual joysticks:
- **Left Joystick (Neon Cyan)**: 
  - Drag **UP** to climb in altitude (Thrust).
  - Drag **DOWN** to descend.
  - Drag **LEFT / RIGHT** to rotate (Yaw).
- **Right Joystick (Neon Pink)**: 
  - Drag in any direction to tilt Forward, Backward, Left, or Right.
- **On-Screen RESET**: Tap the `RESET` button at the top of the HUD if you get lost.
- **Gyroscope Mode**: Fly by physically tilting your phone (enable in **Settings**).

---

## ⚡ Flight Mechanics & Safety Features

- **30° Max Tilt Angle Limiter (Anti-Flip Guard):**
  The drone operates in **Angle Mode (Attitude PD Control)**. Stick inputs request a target angle capped at $\pm 30^\circ$. Once the drone reaches $30^\circ$, driving torque naturally drops to zero, making it **impossible to flip upside down**.
- **Tilt-Compensated Auto-Hover:**
  Earth gravity ($-9.82\text{ m/s}^2$) is automatically counteracted by an upward baseline thrust of $9.82\text{ N}$, scaled by $\frac{1}{\cos(\theta)}$ to prevent altitude drops during banking.
- **Ground Liftoff Assist:**
  Applying upward thrust near the floor provides an immediate vertical boost to eliminate static ground friction.
- **Collision Shock Absorption:**
  Micro-contacts on the ground are filtered out; only high-speed impacts ($> 3.2\text{ m/s}$) trigger collision thuds and non-intrusive peripheral red vignettes.

---

## 🤖 AI Agentic Coding & Available Skills

This repository follows modern **Agentic AI Coding Standards** (see [AGENTS.md](file:///c:/Projects/DroneGame/AGENTS.md) and [GEMINI.md](file:///c:/Projects/DroneGame/GEMINI.md)). AI assistants working in this codebase have access to specialized workspace skills:

### Workspace Skills (`.agents/skills/`)

| Skill / Command | Path | Description & When to Use |
|:---|:---|:---|
| **`/start`** | [`.agents/skills/start/SKILL.md`](file:///c:/Projects/DroneGame/.agents/skills/start/SKILL.md) | **Session Onboarding:** Loads the complete mental model, architectural invariants, flight mechanics, mobile standards, and bug fix history. Invoke `/start` at the beginning of any chat session. |
| **`game-testing`** | [`.agents/skills/game-testing/SKILL.md`](file:///c:/Projects/DroneGame/.agents/skills/game-testing/SKILL.md) | **Automated Verification:** Runs the headless mobile Chrome test suite (`node test_mobile_game.js`), verifying flight, virtual joysticks, 30° tilt lock, dialogs, and screenshots. |

### Recommended Slash Commands
- **`/plan`**: Use when designing complex new game modes, soundscapes, or level architectures before writing code.
- **`/goal`**: Use for deep autonomous tasks that require multi-step implementation and verification.
- **`/learn`**: Saves user corrections or project-specific preferences into persistent agent memory.
- **`/grill-me`**: Triggers an interactive interview to make design or physics decisions.

---

## 🧪 Testing & Automated Verification

Run the automated test suite locally at any time:

```powershell
# 1. Compile production bundle (must pass with 0 errors)
npm run build

# 2. Run automated headless Chrome mobile gameplay test
node test_mobile_game.js
```

The automated test checks:
- Main menu initialization
- Flight start & HUD meters
- 0 ground collision flashes on floor contact
- Responsive Help manual scrolling & close button
- Virtual joystick altitude climb
- 30° Max Tilt Angle Limiter & anti-flip recovery
- Training Complete dialog dismissal via `[✕]`
- On-screen RESET button

Visual artifacts are saved to `test_screenshots/` for easy visual inspection.

---

## 🏗️ Repository Architecture

```text
c:/Projects/DroneGame/
├── AGENTS.md                 # Universal AI agent instructions & coding standards
├── GEMINI.md                 # Antigravity/Gemini workspace configuration
├── .agents/                  # Customization root
│   ├── rules/                # Domain-specific constraints (physics, mobile UX)
│   └── skills/               # Reusable agentic skills (/start, game-testing)
├── docs/
│   ├── DHRUV_GUIDE.md        # Educational aerospace guide for creator Dhruv (Age 10)
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

## 🎓 Dhruv's Guide
Looking for the real aerospace science behind this game? Check out **[docs/DHRUV_GUIDE.md](file:///c:/Projects/DroneGame/docs/DHRUV_GUIDE.md)**! Written for 10-year-old creator Dhruv, it explains **Newton's Laws**, **the 4 Forces of Flight**, **Differential Thrust**, **Einstein's Frame of Reference**, and **why real drones never flip** in exciting, kid-friendly language. ✈️
