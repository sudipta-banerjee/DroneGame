---
name: game-testing
description: >-
  Use this skill to run automated end-to-end gameplay tests for the Neon Drone game,
  verifying flight physics, mobile virtual joysticks, dialog responsiveness, tilt limits,
  and rendering stability using headless Chrome.
---

# Game Testing & Verification Skill

This skill guides the agent in running automated mobile and desktop end-to-end gameplay verification for the Neon Drone project.

## Verification Procedure

1. **Verify Dev Server is Running:**
   Ensure the local Vite dev server is running on `http://localhost:5173`. If not, start it:
   ```powershell
   npm run dev -- --host
   ```

2. **Execute Automated Gameplay Test:**
   Run the headless Puppeteer test script:
   ```powershell
   node test_mobile_game.js
   ```

3. **Check Test Output Checklist:**
   Ensure all automated assertions pass:
   - [x] `Settings dialog opened & closed via [✕]`
   - [x] `Eruda Mobile DevTools initialized: true`
   - [x] `Ground collision flashes triggered (0 expected): 0`
   - [x] `Help dialog columns count: 2 (Desktop & Mobile)`
   - [x] `Virtual joysticks visible on mobile touch`
   - [x] `Altitude after 3s climbing thrust: > initial altitude (CLIMB TEST: PASS)`
   - [x] `30° TILT LIMITER TEST: PASS (Max tilt ≤ 30.5°)`
   - [x] `ANTI-FLIP TEST: PASS (Drone never flipped)`
   - [x] `Training Complete dialog closed via [✕]`
   - [x] `On-screen RESET button restored spawn position`

4. **Inspect Captured Visual Screenshots:**
   Review generated screenshots in `test_screenshots/`:
   - `01_main_menu.png`
   - `02_settings_dialog.png`
   - `04_flight_started.png`
   - `05_help_dialog.png`
   - `06_climbing_altitude.png`
   - `06b_tilt_limited_flight.png`
   - `07_training_complete_dialog.png`
   - `09_after_reset.png`
