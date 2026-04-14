import * as THREE from 'three';
import { PhysicsWorld } from './PhysicsWorld';
import { Drone } from './Drone';
import { Controls } from './Controls';
import { LevelManager } from './LevelManager';
import './style.css';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.loadingScreen = document.getElementById('loading-screen');
        this.menuOverlay = document.getElementById('menu-overlay');
        this.settingsOverlay = document.getElementById('settings-overlay');
        
        this.initThree();
        this.initPhysics();
        this.spawnEnvironment();
        this.initGameObjects();
        this.initUI();
        
        this.animate();
        
        // Hide loader after a short delay
        setTimeout(() => {
            this.loadingScreen.style.display = 'none';
        }, 1500);
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050505);
        this.scene.fog = new THREE.FogExp2(0x050505, 0.02);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 3, 6);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
        this.scene.add(ambientLight);

        const mainLight = new THREE.PointLight(0x00f2ff, 2, 100);
        mainLight.position.set(10, 20, 10);
        this.scene.add(mainLight);

        const hemLight = new THREE.HemisphereLight(0x00f2ff, 0xff00ff, 0.5);
        this.scene.add(hemLight);

        window.addEventListener('resize', () => this.onWindowResize());
    }

    initPhysics() {
        this.physics = new PhysicsWorld();
    }

    spawnEnvironment() {
        // Floor Grid
        const gridHelper = new THREE.GridHelper(200, 100, 0x00f2ff, 0x111111);
        this.scene.add(gridHelper);

        // Ground Physics
        const groundBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Plane(),
        });
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.physics.addBody(groundBody);
    }

    initGameObjects() {
        this.drone = new Drone(this.scene, this.physics);
        this.controls = new Controls();
        this.levelManager = new LevelManager(this.scene, this.physics);
        this.isPlaying = false;
        this.currentLevel = 0;
        
        this.warningTimer = 10;
        this.isOutOfBounds = false;
        
        // Practice Stats
        this.practiceStats = {
            flightTime: 0,
            timeLeft: 120,
            tiltsL: 0,
            tiltsR: 0,
            maxSpeed: 0,
            maxAlt: 0,
            prevRoll: 0
        };

        // Persistent stats
        this.totalFlightSeconds = parseFloat(localStorage.getItem('drone_total_flight_time') || 0);
        
        this.startLevel(0);
    }

    initUI() {
        const enterFullscreen = async () => {
            try {
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    await elem.requestFullscreen();
                } else if (elem.webkitRequestFullscreen) { /* Safari */
                    await elem.webkitRequestFullscreen();
                } else if (elem.msRequestFullscreen) { /* IE11 */
                    await elem.msRequestFullscreen();
                }
            } catch (err) {
                console.warn("Fullscreen request restricted by browser:", err);
            }
        };

        document.getElementById('start-btn').addEventListener('click', () => {
            enterFullscreen();
            console.log("UI: Start button clicked");
            this.menuOverlay.classList.remove('active');
            this.isPlaying = true;
            console.log(`Game state: isPlaying set to ${this.isPlaying}, currentLevel is ${this.currentLevel}`);
        });

        document.getElementById('settings-btn').addEventListener('click', () => {
            this.settingsOverlay.classList.add('active');
        });

        document.getElementById('back-btn').addEventListener('click', () => {
            this.settingsOverlay.classList.remove('active');
        });

        document.getElementById('help-btn').addEventListener('click', () => {
            document.getElementById('help-overlay').classList.add('active');
        });

        document.getElementById('close-help-btn').addEventListener('click', () => {
            document.getElementById('help-overlay').classList.remove('active');
        });

        document.getElementById('control-mode').addEventListener('change', (e) => {
            this.controls.setMode(e.target.value);
        });

        document.getElementById('skip-btn').addEventListener('click', () => {
            this.startLevel(1);
        });

        document.getElementById('continue-btn').addEventListener('click', () => {
            enterFullscreen();
            document.getElementById('results-overlay').classList.remove('active');
            this.startLevel(1);
            this.isPlaying = true;
        });

        document.getElementById('end-practice-btn').addEventListener('click', () => {
            if (this.currentLevel === 0) {
                console.log("UI: End Practice clicked");
                this.showResults();
            }
        });

        document.getElementById('restart-practice-btn').addEventListener('click', () => {
            enterFullscreen();
            document.getElementById('results-overlay').classList.remove('active');
            
            this.practiceStats = {
                flightTime: 0,
                timeLeft: 120,
                tiltsL: 0,
                tiltsR: 0,
                maxSpeed: 0,
                maxAlt: 0,
                prevRoll: 0
            };
            
            if (this.drone && this.drone.body) {
                this.drone.body.position.set(0, 0.05, 0);
                this.drone.body.velocity.set(0, 0, 0);
                this.drone.body.angularVelocity.set(0, 0, 0);
                this.drone.body.quaternion.set(0, 0, 0, 1);
            }

            this.startLevel(0);
            this.isPlaying = true;
        });
    }

    startLevel(levelNum) {
        console.log(`Starting Level: ${levelNum}`);
        this.currentLevel = levelNum;
        this.levelManager.spawnLevel(levelNum);
        document.getElementById('current-level').textContent = levelNum;
        
        const timerDisp = document.getElementById('timer-display');
        const skipBtn = document.getElementById('skip-btn');
        const endPracticeBtn = document.getElementById('end-practice-btn');
        const scoreDisp = document.getElementById('score-display');

        if (levelNum === 0) {
            timerDisp.style.display = 'block';
            skipBtn.style.display = 'block';
            if (endPracticeBtn) endPracticeBtn.style.display = 'block';
            scoreDisp.style.display = 'none';
        } else {
            timerDisp.style.display = 'none';
            skipBtn.style.display = 'none';
            if (endPracticeBtn) endPracticeBtn.style.display = 'none';
            scoreDisp.style.display = 'block';
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateHUD() {
        const pos = this.drone.body.position;
        const speed = this.drone.body.velocity.length() * 3.6; // m/s to km/h
        
        document.getElementById('alt-val').textContent = Math.max(0, pos.y).toFixed(1);
        document.getElementById('speed-val').textContent = speed.toFixed(0);
        
        // Progress bars
        document.getElementById('alt-fill').style.width = `${Math.min(100, pos.y * 10)}%`;
        document.getElementById('speed-fill').style.width = `${Math.min(100, speed)}%`;
        
        // Timer display for Level 0
        if (this.currentLevel === 0) {
            const mins = Math.floor(this.practiceStats.timeLeft / 60);
            const secs = Math.floor(this.practiceStats.timeLeft % 60);
            document.getElementById('practice-timer').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            // Track peaks
            this.practiceStats.maxSpeed = Math.max(this.practiceStats.maxSpeed, speed);
            this.practiceStats.maxAlt = Math.max(this.practiceStats.maxAlt, pos.y);
        }

        // Battery drain logic (simplified)
        const batFill = document.getElementById('bat-fill');
        const batVal = document.getElementById('bat-val');
        let currentBat = parseFloat(batVal.textContent);
        if (currentBat > 0 && this.isPlaying) {
            currentBat -= 0.005;
            batVal.textContent = Math.max(0, currentBat).toFixed(1);
            batFill.style.width = `${currentBat}%`;
        }
    }

    showResults() {
        console.log("Showing results for Level: ", this.currentLevel);
        this.isPlaying = false;
        const res = this.practiceStats;
        console.log("Practice Stats: ", res);
        
        // Update persistent time
        this.totalFlightSeconds += res.flightTime;
        localStorage.setItem('drone_total_flight_time', this.totalFlightSeconds);
        const totalHours = (this.totalFlightSeconds / 3600).toFixed(4);

        document.getElementById('res-time').textContent = Math.floor(res.flightTime).toFixed(0);
        document.getElementById('res-tilts-l').textContent = res.tiltsL;
        document.getElementById('res-tilts-r').textContent = res.tiltsR;
        document.getElementById('res-speed').textContent = res.maxSpeed.toFixed(1);
        document.getElementById('res-alt').textContent = res.maxAlt.toFixed(1);
        
        // Show total hours in a special box or update the summary
        if (document.getElementById('res-total-hours')) {
            document.getElementById('res-total-hours').textContent = totalHours;
        }
        
        document.getElementById('results-overlay').classList.add('active');
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = 0.016; 
        
        if (this.isPlaying) {
            this.physics.update(deltaTime);
            
            const state = this.controls.getState();
            
            if (state.reset) {
                // Instantly reset the drone if 'R' is pressed
                this.drone.body.position.set(0, 2, 0);
                this.drone.body.velocity.set(0, 0, 0);
                this.drone.body.angularVelocity.set(0, 0, 0);
                this.drone.body.quaternion.set(0, 0, 0, 1);
            } else {
                this.drone.applyThrust(state.thrust);
                if (state.pitch !== 0) this.drone.moveForward(state.pitch);
                if (state.roll !== 0) this.drone.moveSideways(state.roll);
                if (state.yaw !== 0) this.drone.rotate(state.yaw);
                
                // Automatically return to level flight when no pitch/roll input
                this.drone.autoLevel(state.pitch, state.roll);
            }
            
            // Boundary Check
            const boundary = 100;
            const dronePos = this.drone.body.position;
            const isOut = Math.abs(dronePos.x) > boundary || Math.abs(dronePos.z) > boundary || dronePos.y > 100;
            const warningOverlay = document.getElementById('warning-overlay');
            const warningTimerEl = document.getElementById('warning-timer');

            if (isOut) {
                if (!this.isOutOfBounds) {
                    this.isOutOfBounds = true;
                    this.warningTimer = 10.0;
                    if (warningOverlay) warningOverlay.classList.add('active');
                }
                
                this.warningTimer -= deltaTime;
                if (warningTimerEl) warningTimerEl.textContent = Math.max(0, this.warningTimer).toFixed(1);
                
                if (this.warningTimer <= 0) {
                    this.isOutOfBounds = false;
                    if (warningOverlay) warningOverlay.classList.remove('active');
                    
                    // Reset drone
                    this.drone.body.position.set(0, 2, 0);
                    this.drone.body.velocity.set(0, 0, 0);
                    this.drone.body.angularVelocity.set(0, 0, 0);
                    this.drone.body.quaternion.set(0, 0, 0, 1);
                    
                    // Restart level logic
                    this.startLevel(this.currentLevel);
                }
            } else {
                if (this.isOutOfBounds) {
                    this.isOutOfBounds = false;
                    if (warningOverlay) warningOverlay.classList.remove('active');
                }
            }
            
            // Track Practice Stats
            if (this.currentLevel === 0) {
                this.practiceStats.timeLeft -= deltaTime;
                this.practiceStats.flightTime += deltaTime;

                // Tilt counting (Input-based transitions with deadzone for reliability)
                const deadzone = 0.1;
                if (state.roll < -deadzone && this.practiceStats.prevRoll >= -deadzone) {
                    this.practiceStats.tiltsL++;
                } else if (state.roll > deadzone && this.practiceStats.prevRoll <= deadzone) {
                    this.practiceStats.tiltsR++;
                }
                this.practiceStats.prevRoll = state.roll;

                if (this.practiceStats.timeLeft <= 0) {
                    console.log("Practice time ended! Showing results.");
                    this.showResults();
                }
            }
            
            // Pass state into drone update for dynamic visual effects
            this.drone.update(state);
            this.levelManager.checkCollisions(this.drone.group.position);
            this.updateHUD();

            // Camera follow (Decoupled Pitch/Roll for maximum UX clarity)
            // Extract ONLY the Yaw (Y-axis rotation) from the drone
            const euler = new THREE.Euler().setFromQuaternion(this.drone.group.quaternion, 'YXZ');
            const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), euler.y);
            
            const offset = new THREE.Vector3(0, 1.2, 4); 
            offset.applyQuaternion(yawQuat); // Only orbit around Y
            
            // Add slight camera drag to create a feeling of speed
            const velocityOffset = new THREE.Vector3(
                this.drone.body.velocity.x,
                this.drone.body.velocity.y,
                this.drone.body.velocity.z
            ).multiplyScalar(-0.05); // Camera gets left behind slightly
            offset.add(velocityOffset);

            const targetPos = this.drone.group.position.clone().add(offset);
            
            // Lerp position for smoothness
            this.camera.position.lerp(targetPos, 0.1);
            
            // Look exactly at the drone
            this.camera.lookAt(this.drone.group.position);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

import * as CANNON from 'cannon-es';

new Game();

