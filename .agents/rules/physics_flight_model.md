# Physics & Flight Model Rules

When modifying `src/Drone.js`, `src/PhysicsWorld.js`, or the physics update loop in `src/main.js`:

1. **Mass & Dimensions:**
   - Drone mass is $1.0\text{ kg}$.
   - Collision shape is `CANNON.Box(new CANNON.Vec3(0.25, 0.05, 0.25))` ($50\text{cm} \times 10\text{cm} \times 50\text{cm}$).
   - `linearDamping` is $0.3$ (allows high-speed cruising while preventing runaway velocity).
   - `angularDamping` is $0.8$ (maintains gyroscopic stability).

2. **Attitude PD Controller & 30° Tilt Limit:**
   - Maximum tilt angle is $\text{maxTiltAngle} = 30^\circ$ ($0.5236\text{ radians}$).
   - Orientation is extracted using Three.js Euler angles in `'YXZ'` order to decouple Yaw from Pitch and Roll.
   - Closed-loop PD controller drives current pitch and roll to target angles:
     - $K_p = 3.5$ (Proportional stiffness)
     - $K_d = 0.6$ (Derivative angular damping)
   - Do NOT add open-loop turning torques that fight the attitude controller.
   - Maintain the emergency anti-flip recovery envelope: if `localUp.y < cos(30°)`, apply upright alignment torque.

3. **Auto-Hover & Lift:**
   - Baseline vertical thrust is $9.82\text{ N}$ (counteracting Earth gravity).
   - Tilt compensation scales upward thrust by $\frac{1}{\cos(\text{tilt})}$, clamped at $\cos(\text{tilt}) \ge 0.5$.
   - Ground assist provides an initial upward boost of $10 \times \text{thrust}$ when $\text{pos.y} < 0.35\text{m}$ to overcome static friction on liftoff.

4. **Collision Event Filtering:**
   - `drone.body.addEventListener('collide')` must check impact velocity along normal.
   - Disregard contacts with impact velocity $< 3.2\text{ m/s}$ to prevent continuous ground contact flashes.
