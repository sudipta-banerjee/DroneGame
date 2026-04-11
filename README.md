# 🚁 NEON DRONE - Development Guide

Welcome to **NEON DRONE**, a high-performance 3D flight simulator built with Vite, Three.js, and Cannon-es. This document explains how to set up, run, and play the game locally.

## 🛠 Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (Version 18 or higher recommended)
- [npm](https://www.npmjs.com/) (Comes with Node.js)

## 🚀 Getting Started

Follow these steps to get the game running in your local development environment:

### 1. Install Dependencies
Open your terminal in the project directory and run:
```bash
npm install
```

### 2. Run in Development Mode
Start the Vite development server:
```bash
npm run dev
```

### 3. Open the Game
Vite will provide a local URL (e.g., `http://localhost:5173`). Open this URL in any modern web browser.

---

## 🎮 How to Play

### Objectives
- Navigate your drone through the **Neon Rings** scattered around the environment.
- Each ring collected adds **100 points** to your score.
- Watch your **Battery** level! It drains over time while flying.

### Desktop Controls (Keyboard)

*Note: Like a real drone, the directional keys (`W/A/S/D`) only tilt the drone. To actually move forward or sideways, you must hold the thrust key (`Space`) while tilted! Whenever you release the tilt keys, the drone will automatically right itself into a flat hover.*

| Key | Action |
|-----|--------|
| **W** | Pitch Forward (Tilt forward) |
| **S** | Pitch Backward (Tilt backward) |
| **A** | Roll Left (Tilt left) |
| **D** | Roll Right (Tilt right) |
| **Q** | Yaw Left (Spin left) |
| **E** | Yaw Right (Spin right) |
| **Space** | Increase Thrust (Fly Up) |
| **Left Shift** | Decrease Thrust (Descend) |
| **R** | Emergency Reset (Instantly rights the drone) |

### Mobile Controls
The game automatically detects touch devices and displays **Virtual Joysticks**.
- **Left Joystick**: Controls **Thrust (Vertical)** and **Yaw (Horizontal)**.
- **Right Joystick**: Controls **Pitch (Vertical)** and **Roll (Horizontal)**.
- **Gyroscope Mode**: Can be enabled in **Settings** to fly by tilting your phone!

---

## 🏗 Project Architecture

- **`src/main.js`**: The heart of the game. Manages the Three.js scene and the animation loop.
- **`src/Drone.js`**: Handles the drone's 3D model and physics forces.
- **`src/PhysicsWorld.js`**: Manages the `cannon-es` physical world.
- **`src/LevelManager.js`**: Handles obstacle placement and collision logic.
- **`src/Controls.js`**: Bridges keyboard and touch inputs into a single data stream.

## 🎨 Aesthetic Notes
The game uses a high-contrast **Cyberpunk / Futuristic** theme. Ground grids and emissive materials are used to simulate a neon-lit night city without the need for expensive textures, ensuring high performance on mobile devices.

---

## 📦 Deployment
To build the game for production (standard web hosting):
```bash
npm run build
```
The output will be in the `/dist` folder.
