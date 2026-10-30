# Mobile Touch & UI Standards

When working on HUD, controls, styling, or modal dialogs:

1. **Touch Actions:**
   - Scoped `touch-action: none` only to `#game-container, canvas, .joystick-zone`.
   - Modals and scrollable containers must use `touch-action: pan-y; -webkit-overflow-scrolling: touch;`.
   - Never apply `touch-action: none` to the `*` universal selector.

2. **Virtual Joysticks:**
   - Use `src/TouchJoystick.js` exclusively.
   - Left stick (cyan) controls Altitude (Y) and Yaw (X).
   - Right stick (pink) controls Pitch (Y) and Roll (X).
   - Joysticks use `setPointerCapture` on `pointerdown` to maintain finger tracking even when dragged outside the circular zone.

3. **Dialog UX Standards:**
   - Every modal (`#menu-overlay`, `#settings-overlay`, `#results-overlay`, `#help-overlay`, `#mission-complete-overlay`) must include a circular `[✕]` close button (`.dialog-close-btn`).
   - Tapping the overlay backdrop outside `.menu-content` must dismiss the dialog.
   - Layouts must be verified for short landscape mobile viewports (`max-height: 520px`).
   - Use compact padding and side-by-side columns on landscape displays.

4. **Debugging Tools:**
   - Keep `public/eruda.js` present for offline mobile debugging.
   - Support toggling Eruda from Settings or by adding `?debug=1` to the URL.
