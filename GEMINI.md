# GEMINI.md — Antigravity Workspace Guidelines

This file configures Google Antigravity and Gemini coding assistants operating in the `DroneGame` repository.

## Operational Rules

1. **Localhost First:** Never push code to remote git repositories without the user's explicit consent.
2. **Quadcopter Flight Dynamics:**
   - Always preserve the **30° Max Tilt Angle Limiter** in `Drone.js`.
   - Never replace the closed-loop attitude PD controller with unbounded open-loop torques.
   - Maintain tilt-compensated auto-hover baseline ($9.82\text{ N}$).
3. **Mobile-First Responsiveness:**
   - Keep `touch-action: none` restricted to the 3D canvas and `.joystick-zone`.
   - Ensure all dialogs support vertical finger-scrolling (`touch-action: pan-y`).
   - Every modal dialog must include a top-right circular `[✕]` close button (`.dialog-close-btn`).
   - Use the native `src/TouchJoystick.js` module for on-screen sticks.
4. **Educational Integrity:**
   - Preserve `docs/DHRUV_GUIDE.md` for Dhruv (Age 10). When adding features or fixing flight physics, document the concepts in Dhruv's guide in engaging, kid-friendly aerospace language.
5. **Quality Gate:**
   - Always validate code changes by running `npm run build` and `node test_mobile_game.js` before marking tasks as complete.
