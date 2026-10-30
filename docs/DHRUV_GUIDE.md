# Neon Drone — Dhruv's Code Guide 🚁

**Written for Dhruv Banerjee, Age 10 — the person who built this game!**

This guide explains *exactly* what's happening in your code, the real science
of flight, and some aerospace and aerodynamics basics that actual drone
engineers and pilots use every day. You already used all of this science in
your game — you just didn't know the fancy names yet!

---

## Table of Contents

1. [How a Real Drone Flies](#1-how-a-real-drone-flies)
2. [The Four Forces of Flight](#2-the-four-forces-of-flight)
3. [The Six Movements of a Drone (Degrees of Freedom)](#3-the-six-movements-of-a-drone)
4. [Aerodynamics: Why Rotors Work](#4-aerodynamics-why-rotors-work)
5. [How Your Game Simulates Physics](#5-how-your-game-simulates-physics)
6. [Walking Through Your Code, File by File](#6-walking-through-your-code-file-by-file)
7. [The Math Behind the Game](#7-the-math-behind-the-game)
8. [Glossary — Cool Words to Know](#8-glossary)

---

## 1. How a Real Drone Flies

A drone (properly called a **quadcopter** because it has 4 rotors) flies by
spinning four propellers really fast. Each propeller pushes air downward.
When you push air down, the air pushes *back up* on the drone — this is
**Newton's Third Law**: *every action has an equal and opposite reaction.*

Your game drone has exactly 4 rotors, placed at the four corners of two
crossed arms — just like a real DJI Mavic or Phantom!

```
    [Rotor]      [Rotor]
       \            /
        [===BODY===]
       /            \
    [Rotor]      [Rotor]
```

Real quadcopters spin diagonal pairs of rotors in *opposite directions*. This
is so the spinning forces cancel each other out and the drone doesn't slowly
spin in circles by itself. In your game, `autoLevel()` in `Drone.js` does
that job — it constantly corrects any unwanted rotation.

---

## 2. The Four Forces of Flight

Every flying object — drones, planes, helicopters, rockets — deals with the
same four forces:

```
              ↑  LIFT (thrust pushing up)
              |
    DRAG ←----+----→ THRUST (rotors pushing forward when tilted)
              |
              ↓  WEIGHT (gravity pulling down)
```

| Force | What it is | In your game |
|---|---|---|
| **Lift** | Force pushing the drone UP | `applyThrust()` in `Drone.js` |
| **Weight** | Gravity pulling the drone DOWN | `gravity = (0, -9.82, 0)` in `PhysicsWorld.js` |
| **Thrust** | Force pushing the drone FORWARD | `moveForward()` — drone tilts and lift pushes it forward |
| **Drag** | Air resistance slowing the drone | `linearDamping = 0.3` in `Drone.js` |

The number **9.82** appears in multiple places in your code. That's not a
coincidence — it is **gravitational acceleration** (often written as *g*),
the speed at which gravity accelerates any object downward on Earth:
**9.82 metres per second, every second**.

---

## 3. The Six Movements of a Drone

Anything that flies in 3D space can move in **six different ways**. Pilots and
aerospace engineers call these the **6 Degrees of Freedom** (6DOF):

### Three ways to *move* (translations):
| Movement | Direction | Your keyboard key |
|---|---|---|
| **Heave** | Up / Down | Space / Shift |
| **Surge** | Forward / Backward | W / S |
| **Sway** | Left / Right | A / D |

### Three ways to *rotate* (rotations):
| Rotation | What it does | Your keyboard key |
|---|---|---|
| **Pitch** | Nose tips forward or backward | W / S |
| **Roll** | One side dips left or right | A / D |
| **Yaw** | Drone spins left or right on the spot | Q / E |

Here's a diagram to help picture it:

```
         PITCH (nose up/down)
              ↕
         ___________
        |           |
ROLL ←→ |   DRONE   | ←→ ROLL (left/right tilt)
        |___________|
              ↕
         YAW (spin left/right when seen from above)
```

In your `Controls.js` file, `getState()` returns exactly these five values:
`thrust` (heave), `pitch`, `roll`, `yaw` — and `reset`. That five-number
bundle is everything the drone needs to know every single frame!

---

## 4. Aerodynamics: Why Rotors Work

**Aerodynamics** is the study of how air moves around objects.

A rotor blade is shaped like a tiny wing — one side is curved more than the
other. When it spins, air moves *faster* over the curved top than the flat
bottom. Faster air has **lower pressure** (this is **Bernoulli's Principle**).
Lower pressure on top means the rotor gets *sucked upward* — that's LIFT!

```
      Curved top → air moves FAST → LOW pressure
     ___________
    /           \    ← rotor blade cross-section
   /____________ \
      Flat bottom → air moves SLOW → HIGH pressure
      
   HIGH pressure pushes UP toward LOW pressure = LIFT ↑
```

In your game you don't simulate every air molecule (that would need a
supercomputer!). Instead you fake the same result: `applyThrust()` in
`Drone.js` applies an upward force equal to `mass × gravity = 1 × 9.82`
just to hover, plus extra to climb. Same outcome, much simpler maths.

### Why does tilting move the drone forward?

When the drone is level, the rotor thrust points straight up — it only fights
gravity. When you tilt the drone forward (pitch), the thrust now points
*slightly forward* as well as up. That forward component pushes the drone
through the air!

```
  Level:                     Tilted forward:
   ↑ thrust                  ↗ thrust
   |                        /|
 [DRONE]                 [DRONE]
                       forward + up
```

Your code does this with:
```javascript
// applyThrust() in Drone.js
const localUp = this.body.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
const tiltCos = Math.max(0.5, localUp.y);
const compensatedForce = totalForce / tiltCos; // Tilt compensation!

const force = new CANNON.Vec3(0, compensatedForce, 0);  // force in LOCAL coordinates
const worldForce = this.body.quaternion.vmult(force);   // rotate into WORLD coordinates
this.body.applyForce(worldForce, new CANNON.Vec3(0,0,0));
```
`quaternion.vmult` rotates the upward force by however much the drone is
tilted — so if the drone is pitched forward 20°, some of that force becomes
forward motion automatically. Real drones work *exactly* like this.

Notice the **tilt compensation** (`totalForce / tiltCos`): when a drone tilts,
some of its vertical lift turns into forward speed. If you didn't boost the
rotors slightly while tilting, the drone would lose altitude and fall! Dividing
by `tiltCos` ensures the drone stays at the exact same height while flying forward!

---

## 5. How Your Game Simulates Physics

Your game uses a library called **cannon-es** to simulate a physics world. 
Here's how it works:

### The Physics Engine (PhysicsWorld.js)

```javascript
this.world.gravity.set(0, -9.82, 0); // pull everything DOWN at 9.82 m/s²
```

Every object in the physics world has:
- A **mass** (how heavy it is — your drone is 1 kg)
- A **position** (where it is in 3D space)
- A **velocity** (how fast it's moving)
- A **quaternion** (its rotation in 3D — see below)

Every frame (60 times per second), the physics engine:
1. Adds gravity to every object's velocity
2. Checks if any objects are touching (collision detection)
3. Calculates the new positions

```javascript
world.step(1/60, deltaTime, 3); // run physics at 60 steps/second
```

### What is a Quaternion? 🤔

A **quaternion** is a special set of 4 numbers (x, y, z, w) that describes a
rotation in 3D space. They're trickier than normal angles but they never get
"stuck" the way angles can (a problem called **Gimbal Lock** that caused
problems on the Apollo 13 spacecraft!).

You don't need to understand the maths yet. Just know: wherever you see
`quaternion` in your code, it means "the rotation of this object in 3D space".

### Damping — The Virtual Air Resistance

```javascript
linearDamping: 0.3,   // slows down movement (like air drag)
angularDamping: 0.8,  // slows down spinning (keeps the drone stable)
```

`linearDamping` makes the drone slow down when you stop pushing, just like
real air resistance. `angularDamping` stops the drone from spinning wildly —
it's like the drone's body shape naturally resisting rotation in air.

### Auto-Levelling (Drone.js — the coolest bit!)

```javascript
autoLevel(_pitchState, _rollState) {
    const localUp = this.body.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
    const worldUp = new CANNON.Vec3(0, 1, 0);
    const alignAxis = new CANNON.Vec3();
    localUp.cross(worldUp, alignAxis);      // find the tilt axis
    alignAxis.scale(8, alignAxis);          // spring strength = 8
    this.body.applyTorque(alignAxis);       // push back toward level
}
```

This runs **every single frame** even when you're not touching the controls.
It's your drone's **autopilot stabiliser**.

Here's the idea:
- `localUp` = which direction is "up" *from the drone's point of view*
- `worldUp` = which direction is *actually* up
- **Cross product** = finds the axis you'd need to rotate around to make them match
- `applyTorque` = applies a spinning force to correct the tilt

The number `8` is the "spring stiffness" — bigger = snappier correction.
This is very similar to the **attitude control system** on real drones and
even rockets like SpaceX's Falcon 9!

---

## 6. Walking Through Your Code, File by File

### 📁 `src/main.js` — The Boss of Everything

This is where the whole game starts. Think of it as the **flight controller
computer** on a real drone — it coordinates everything.

```javascript
animate() {
    requestAnimationFrame(() => this.animate()); // ask browser to call this again next frame

    const deltaTime = Math.min((now - this.lastFrameTime) / 1000, 0.05); // real time since last frame

    if (this.isPlaying) {
        this.physics.update(deltaTime);          // 1. move the physics world forward
        const state = this.controls.getState();  // 2. read the controls
        this.drone.applyThrust(state.thrust);    // 3. apply forces to the drone
        this.drone.update(state);                // 4. spin rotors visually
        this.levelManager.checkCollisions(...);  // 5. did we hit a ring?
        this.updateHUD(deltaTime);               // 6. update the screen display
        // 7. move the camera to follow the drone
    }

    this.renderer.render(this.scene, this.camera); // draw the frame
}
```

This loop runs ~60 times per second. Each run is one **frame**. 
`deltaTime` is the real time (in seconds) since the last frame — this is
important because phones and computers run at different speeds. By
multiplying everything by `deltaTime`, the game runs at the same *speed*
whether your device is fast or slow.

#### 🔍 The Mystery of the "Frozen" Drone (And How the Camera Saved It!)

When we first started building this game, we ran into a bizarre, hilarious mystery:
**We pressed the controls, the code worked, but the drone looked completely frozen in place!**

Why did that happen?

In the early prototype, the camera was **fixed directly to the drone** (like a rigid selfie stick welded to the drone's frame). 
When the physics engine moved the drone forward by 5 metres, the camera moved forward by 5 metres at the exact same millisecond. 
Because both the drone and the camera were moving in lockstep, the distance between them was **always zero**! To the player looking at the screen, the drone appeared totally stationary.

In physics, this is a famous discovery by **Galileo Galilei and Albert Einstein** called a **Frame of Reference** (or Relative Motion):
- Imagine you are sitting inside an ultra-smooth high-speed train travelling at 300 km/h.
- If you place a juice bottle on your tray table, it looks completely still to you.
- But to someone standing outside on the platform, both you and the bottle are zooming past at 300 km/h!

**How We Fixed It:**
Instead of welding the camera to the drone, we gave the camera its **own independent position in the world**:
1. The camera floats independently in world space behind the drone (`offset = (0, 1.2, 4)`).
2. It uses **Lerp (smooth interpolation)**: instead of snapping instantly, it smoothly glides toward the target position (`this.camera.position.lerp(targetPos, 0.1)`).
3. It adds **camera drag**: when the drone accelerates, the camera lags slightly behind (`velocityOffset * -0.05`), creating an exhilarating feeling of speed and acceleration!
4. It only turns with the drone's **Yaw (steering)** — so when the drone pitches forward or banks left/right, the camera stays upright, allowing you to clearly see the drone tilting, diving, and carving through the sky!

---

### 📁 `src/Drone.js` — The Drone Itself

This file creates both the **visual drone** (what you see) and the
**physics drone** (the invisible body that has mass, gravity, and collisions).

The key insight: the visual drone and physics drone are **separate objects**
that are synced every frame:

```javascript
update(state) {
    // Copy physics position → visual position every frame
    this.group.position.set(
        this.body.position.x,
        this.body.position.y,
        this.body.position.z
    );
}
```

**Why two separate objects?** Because graphics (Three.js) and physics
(cannon-es) use different internal systems. The physics body does all the
real calculations. The visual mesh just copies where it ended up.

#### Rotor spin direction and engine load

```javascript
this.rotors.forEach((r, i) => {
    let engineLoad = baseThrust;
    if (pitchInput > 0 && i < 2) engineLoad += pitchInput; // rear works harder
    ...
    r.rotation.y += 0.3 * (1 + engineLoad); // spin faster under load
});
```

When you pitch forward, the rear rotors (index 0 and 1) work harder and
spin faster visually — just like on a real quadcopter! This is called
**differential thrust**.

#### The 30° Max Tilt Limiter (Why your drone never flips!)

In real life, commercial drones like DJI Mavics have an automatic safety rule
built into their flight computer called **Angle Mode** (or Attitude Limiter).

If a drone tilted 90°, it would point sideways. If it tilted 180°, it would
be upside down and crash! To prevent this, the drone's flight controller limits
the maximum tilt angle to **30 degrees** (`maxTiltAngle = (30 * π) / 180`).

When you push the stick all the way forward:
1. Your input doesn't say "keep spinning forever". It says "tilt forward to 30°".
2. The `autoLevel()` controller in `Drone.js` calculates the difference between
   your 30° target angle and the drone's current angle.
3. As the drone approaches 30°, the turning torque smoothly decreases to zero,
   locking the drone rock-steady at 30°!
4. When you let go of the stick, the target becomes 0°, and the drone smoothly
   snaps back to flat, level hover. Even during a collision, an emergency safety
   net pulls the drone upright so it cannot flip upside down!

---

### 📁 `src/Controls.js` — Reading Player Input

This file translates what you do (press a key, move a joystick, tilt the
phone) into the five numbers the drone needs.

```javascript
getState() {
    // All inputs are combined and clamped between -1 and 1
    // -1 means "full left/back/down", +1 means "full right/forward/up"
    return { thrust, pitch, roll, yaw, reset };
}
```

The **clamping** (`Math.min(Math.max(v, -1), 1)`) means no matter how
many buttons you press at once, the value never goes above 1 or below -1.
This is the same concept as a **limiter** in real aircraft fly-by-wire systems.

#### Mobile Virtual Joysticks
On phones and tablets, the game renders two glowing on-screen joysticks:
- **Left Joystick (Neon Cyan)**: controls **Thrust** (climb up / descend) and **Yaw** (spin left / right).
- **Right Joystick (Neon Pink)**: controls **Direction** — drag up to pitch **Forward**, down for **Backward**, left for **Roll Left**, and right for **Roll Right**.

These use `mode: 'static'` inside fixed round zones so the joysticks stay perfectly in place under your thumbs instead of jumping around the screen. When you let go, springs snap the knobs back to center, and auto-hover takes over!

The **gyroscope mode** reads the phone's tilt sensors:
```javascript
this.gyroData.pitch = (e.beta - 45) / 45;  // phone tilted forward = drone pitches
this.gyroData.roll  = e.gamma / 45;         // phone tilted sideways = drone rolls
```
`beta` and `gamma` are angles measured by the phone's accelerometer.
Subtracting 45° sets the "neutral" position to holding the phone at a
comfortable angle rather than completely flat.

---

### 📁 `src/PhysicsWorld.js` — The Laws of Nature

```javascript
this.world.gravity.set(0, -9.82, 0);
```

This single line recreates Earth's gravity. Every physics body in the world
falls downward at 9.82 m/s² unless something pushes it up (like rotors!).

```javascript
contactMaterial: { friction: 0.1, restitution: 0.3 }
```

- **Friction 0.1** — surfaces are quite slippery (good — the drone slides
  off buildings rather than sticking)
- **Restitution 0.3** — objects bounce back at 30% of the impact speed
  (like a slightly deflated basketball)

---

### 📁 `src/LevelManager.js` — Buildings and Rings

Buildings are created with **static physics bodies** (mass = 0). A mass of
zero means the physics engine never moves them — they're immovable, like the
ground. Only objects with mass > 0 (your drone, mass = 1 kg) get pushed
around by gravity and forces.

The ring collection check:
```javascript
const dist = dronePosition.distanceTo(ring.position);
if (dist < 2.0) { /* collect! */ }
```

This is the **distance formula** in 3D space:
```
distance = √((x₂-x₁)² + (y₂-y₁)² + (z₂-z₁)²)
```
If the drone centre is within 2 metres of a ring centre, you've collected it.

---

### 📁 `src/Audio.js` — Sounds

The audio is made entirely in code using the **Web Audio API** — no sound
files needed! The engine hum uses two **oscillators** (waves):

```javascript
this._osc1.frequency.value = 90;  // base pitch
this._osc2.frequency.value = 94;  // slightly different — creates a "beating" effect
```

When two sound waves are close in frequency, they create a **beating**
pattern — a slow wobble in volume. That wobble is what makes the engine
sound feel like a real multi-rotor rather than a single clean tone. You can
hear this same effect when two aircraft engines aren't perfectly synchronised!

The engine pitch changes with thrust:
```javascript
const freq = 70 + (thrustNorm + 1) * 0.5 * 110; // higher thrust = higher pitch
```
This mirrors real life — a drone's rotors spin faster under load, which
makes a higher-pitched sound.

---

## 7. The Math Behind the Game

You don't need to know all of this now — but it's cool to see how the
maths you learn at school actually shows up in a real game!

### Vectors

A **vector** is just a set of numbers that describe direction and amount.
`CANNON.Vec3(0, 9.82, 0)` means "in the Y direction, strength 9.82".

```javascript
const force = new CANNON.Vec3(0, totalForce, 0); // up-force as a vector
```

### Newton's Second Law: F = ma

Force = mass × acceleration. Your drone has mass = 1 kg, so:
```
Force needed to hover = 1 kg × 9.82 m/s² = 9.82 Newtons
```
That's exactly the number in `applyThrust()`:
```javascript
const hoverForce = 9.82; // exactly enough to counteract gravity on a 1kg drone
```

### Cross Product

The cross product of two vectors gives a third vector that is perpendicular
to both. In `autoLevel()`:

```javascript
localUp.cross(worldUp, alignAxis);
```

This finds the exact axis to spin around to align the drone with gravity.
If `localUp` is pointing north-east and `worldUp` is pointing straight up,
the cross product tells you "spin around this axis to fix it". Super useful
for attitude control!

### Lerp (Linear Interpolation)

```javascript
trail.scale.y = THREE.MathUtils.lerp(trail.scale.y, targetScale, 0.2);
```

**Lerp** smoothly moves a value from where it is toward where you want it.
`0.2` means "move 20% of the remaining gap each frame". This makes the
thrust trail grow and shrink smoothly instead of snapping instantly.

Formula: `result = start + (end - start) × factor`

---

## 8. Glossary

| Word | What it means |
|---|---|
| **Aerodynamics** | The science of how air moves around objects |
| **Quaternion** | A set of 4 numbers that describes 3D rotation without Gimbal Lock |
| **Delta Time (dt)** | The real time in seconds between two frames; used to make the game speed consistent |
| **Degrees of Freedom** | The different ways something can move in space (6 for a drone) |
| **Differential Thrust** | Spinning some rotors faster/slower than others to tilt or turn |
| **Gimbal Lock** | A problem where using normal angles loses one direction of rotation |
| **Gravity (g)** | Earth's pull downward — 9.82 m/s² at sea level |
| **Hover** | Flying in place — lift exactly equals weight |
| **Lerp** | Smoothly sliding a number from one value to another over time |
| **Pitch** | Nose tilting up or down |
| **Quaternion** | 4-number rotation representation used by physics engines and spacecraft |
| **Restitution** | How bouncy a collision is (0 = no bounce, 1 = perfect bounce) |
| **Roll** | Tipping left or right |
| **Torque** | A spinning force (like how tightening a bolt takes a turning force) |
| **Vector** | A direction + strength, stored as (x, y, z) numbers |
| **Yaw** | Spinning left or right while staying level |

---

## Fun Facts 🚀

- Real DJI drones use the **same** pitch/roll/yaw control system as your game
- The `autoLevel()` algorithm is similar to the attitude control used on the
  **Mars Ingenuity helicopter** — the first aircraft to fly on another planet!
- **Einstein's Frame of Reference:** In our very first prototype, the drone looked
  completely frozen because the camera was welded to it! Both moved at the exact
  same speed, proving Galileo & Einstein's law: motion is always relative to your
  viewpoint. Giving the camera an independent position in the world brought the
  flight to life!
- The **9.82** constant in your code is why astronauts feel weightless in
  space — there's no floor pushing back up on them
- The **cross product** you use in `autoLevel()` is also used by GPS
  satellites to calculate their orbits
- Your drone has **6 degrees of freedom** — the same as the International
  Space Station

---

*Built by Dhruv Banerjee, Age 10. Keep building — you're already thinking
like an aerospace engineer!* ✈️
