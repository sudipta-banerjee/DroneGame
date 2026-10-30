import * as THREE from 'three';
import { PhysicsWorld } from './PhysicsWorld';
import { Drone } from './Drone';
import { Controls } from './Controls';
import { LevelManager } from './LevelManager';
import { Audio } from './Audio';
import { inject as injectAnalytics } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import './style.css';

injectAnalytics();
injectSpeedInsights();

class Game {
    constructor() {
        // Debug telemetry (T6): only show #debug-joystick when ?debug=1 is in the URL.
        document.body.classList.toggle(
            'debug',
            new URLSearchParams(location.search).get('debug') === '1'
        );

        this.container = document.getElementById('game-container');
        this.loadingScreen = document.getElementById('loading-screen');
        this.menuOverlay = document.getElementById('menu-overlay');
        this.settingsOverlay = document.getElementById('settings-overlay');
        
        this.initThree();
        this.initPhysics();
        this.spawnEnvironment();
        this.initGameObjects();
        this.initUI();
        window.__drone = this.drone;

        // Frame timing baseline for a frame-rate-independent loop (T1).
        // Real, clamped delta time makes physics + timers behave identically on 60/90/120Hz
        // and prevents a physics explosion when returning from a backgrounded tab.
        this.lastFrameTime = performance.now();

        // Portrait-pause (T8): freeze physics + timers while the portrait warning is visible,
        // and restore play state when the user rotates back to landscape.
        this._wasPlayingBeforePortrait = false;
        const portraitQuery = window.matchMedia('(orientation: portrait)');
        const handleOrientationChange = (e) => {
            if (e.matches) {
                // Entering portrait — pause only if currently playing
                this._wasPlayingBeforePortrait = this.isPlaying;
                if (this.isPlaying) {
                    this.isPlaying = false;
                }
            } else {
                // Returning to landscape — resume only if we paused it
                if (this._wasPlayingBeforePortrait) {
                    this.isPlaying = true;
                    this._wasPlayingBeforePortrait = false;
                    // Reset frame timer so the first delta after resume isn't huge
                    this.lastFrameTime = performance.now();
                }
            }
        };
        portraitQuery.addEventListener('change', handleOrientationChange);
        // Run once at start in case the page loads in portrait
        handleOrientationChange(portraitQuery);

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
        // Cap DPR at 2 (T4): prevents 3×–4× fillrate overdraw on high-end phones.
        // 2 is visually indistinguishable from native DPR at typical viewing distances
        // and roughly halves GPU load on a 3× device.
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
        this.audio = new Audio(); // T11: audio system

        // T11/T12: give LevelManager access to audio for ring chime
        this.levelManager.audio = this.audio;

        // T10: wire the mission-complete callback
        this.levelManager.onMissionComplete = (finalScore) => this.showMissionComplete(finalScore);

        // T12: collision thud — cannon-es fires 'collide' on the body when it hits something.
        // Throttle to once per 500 ms to avoid rapid-fire thuds during a sustained contact.
        this._lastCollisionTime = 0;
        if (this.drone && this.drone.body) {
            this.drone.body.addEventListener('collide', (e) => {
                // Ignore resting on the ground, sliding, or gentle contact (< 3.2 m/s impact)
                const impactVel = e.contact ? Math.abs(e.contact.getImpactVelocityAlongNormal()) : this.drone.body.velocity.length();
                if (impactVel < 3.2) return;

                const now = performance.now();
                if (now - this._lastCollisionTime > 500) {
                    this._lastCollisionTime = now;
                    this.audio.playCollisionThud();
                    this._triggerScreenFlash();
                }
            });
        }

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
        const versionEl = document.getElementById('app-version');
        if (versionEl && import.meta.env.VITE_APP_VERSION) {
            versionEl.textContent = `V_${import.meta.env.VITE_APP_VERSION}`;
        }

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
            setTimeout(() => {
                if (this.controls && typeof this.controls.reposition === 'function') {
                    this.controls.reposition();
                }
            }, 100);
        };

        document.getElementById('start-btn').addEventListener('click', () => {
            this.audio.playUIClick();
            enterFullscreen();
            console.log("UI: Start button clicked");
            this.menuOverlay.classList.remove('active');
            this.isPlaying = true;
            console.log(`Game state: isPlaying set to ${this.isPlaying}, currentLevel is ${this.currentLevel}`);
        });

        document.getElementById('settings-btn').addEventListener('click', () => {
            this.audio.playUIClick();
            this.settingsOverlay.classList.add('active');
        });

        document.getElementById('back-btn').addEventListener('click', () => {
            this.audio.playUIClick();
            this.settingsOverlay.classList.remove('active');
        });

        document.getElementById('help-btn').addEventListener('click', () => {
            this.audio.playUIClick();
            document.getElementById('help-overlay').classList.add('active');
        });

        document.getElementById('close-help-btn').addEventListener('click', () => {
            this.audio.playUIClick();
            document.getElementById('help-overlay').classList.remove('active');
        });

        // On-screen reset (T2): touch users have no 'R' key — this button shares the reset path.
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetDrone());
        }

        document.getElementById('control-mode').addEventListener('change', async (e) => {
            const status = await this.controls.setMode(e.target.value);
            this.updateGyroStatus(status, e.target);
        });

        document.getElementById('skip-btn').addEventListener('click', () => {
            this.audio.playUIClick();
            this.startLevel(1);
        });

        document.getElementById('continue-btn').addEventListener('click', () => {
            this.audio.playUIClick();
            enterFullscreen();
            document.getElementById('results-overlay').classList.remove('active');
            this.startLevel(1);
            this.isPlaying = true;
        });

        document.getElementById('end-practice-btn').addEventListener('click', () => {
            if (this.currentLevel === 0) {
                this.audio.playUIClick();
                console.log("UI: End Practice clicked");
                this.showResults();
            }
        });

        document.getElementById('restart-practice-btn').addEventListener('click', () => {
            this.audio.playUIClick();
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
                this.drone.body.position.set(0, 1.5, 0);
                this.drone.body.velocity.set(0, 0, 0);
                this.drone.body.angularVelocity.set(0, 0, 0);
                this.drone.body.quaternion.set(0, 0, 0, 1);
            }

            this.startLevel(0);
            this.isPlaying = true;
        });

        // Mission complete overlay buttons (T10)
        document.getElementById('mission-replay-btn').addEventListener('click', () => {
            this.audio.playUIClick();
            enterFullscreen();
            document.getElementById('mission-complete-overlay').classList.remove('active');
            this.resetDrone();
            this.startLevel(1);
            this.isPlaying = true;
        });

        document.getElementById('mission-menu-btn').addEventListener('click', () => {
            this.audio.playUIClick();
            document.getElementById('mission-complete-overlay').classList.remove('active');
            this.isPlaying = false;
            this.menuOverlay.classList.add('active');
        });

        // Close buttons for dialogs
        const settingsClose = document.getElementById('settings-dialog-close');
        if (settingsClose) {
            settingsClose.addEventListener('click', () => {
                this.audio.playUIClick();
                this.settingsOverlay.classList.remove('active');
            });
        }

        const resultsClose = document.getElementById('results-dialog-close');
        if (resultsClose) {
            resultsClose.addEventListener('click', () => {
                this.audio.playUIClick();
                document.getElementById('results-overlay').classList.remove('active');
                this.isPlaying = true;
            });
        }

        const helpClose = document.getElementById('help-dialog-close');
        if (helpClose) {
            helpClose.addEventListener('click', () => {
                this.audio.playUIClick();
                document.getElementById('help-overlay').classList.remove('active');
            });
        }

        const missionClose = document.getElementById('mission-dialog-close');
        if (missionClose) {
            missionClose.addEventListener('click', () => {
                this.audio.playUIClick();
                document.getElementById('mission-complete-overlay').classList.remove('active');
                this.isPlaying = false;
                this.menuOverlay.classList.add('active');
            });
        }

        // Tap backdrop to dismiss dialogs
        ['settings-overlay', 'results-overlay', 'help-overlay'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', (e) => {
                    if (e.target === el) {
                        this.audio.playUIClick();
                        el.classList.remove('active');
                        if (id === 'results-overlay') this.isPlaying = true;
                    }
                });
            }
        });

        // Mobile DevTools (Eruda) toggle button
        const toggleErudaBtn = document.getElementById('toggle-eruda-btn');
        if (toggleErudaBtn) {
            const isErudaActive = () => !!(document.getElementById('eruda') || (window.eruda && window.eruda._isInit));
            const updateErudaLabel = () => {
                toggleErudaBtn.textContent = isErudaActive() ? 'HIDE MOBILE DEVTOOLS' : 'ENABLE MOBILE DEVTOOLS';
            };
            updateErudaLabel();
            toggleErudaBtn.addEventListener('click', () => {
                this.audio.playUIClick();
                if (window.eruda) {
                    if (isErudaActive()) {
                        window.eruda.destroy();
                        localStorage.setItem('drone_eruda', '0');
                    } else {
                        window.eruda.init();
                        localStorage.setItem('drone_eruda', '1');
                    }
                    updateErudaLabel();
                }
            });
        }

        // Mute toggle button (T11)
        const muteBtn = document.getElementById('mute-btn');
        if (muteBtn) {
            // Initialise icon from persisted state
            muteBtn.textContent = this.audio.muted ? '🔇' : '🔊';
            muteBtn.addEventListener('click', () => {
                const nowMuted = this.audio.toggleMute();
                muteBtn.textContent = nowMuted ? '🔇' : '🔊';
            });
        }
    }

    startLevel(levelNum) {
        console.log(`Starting Level: ${levelNum}`);
        this.currentLevel = levelNum;
        this.levelManager.spawnLevel(levelNum);
        document.getElementById('current-level').textContent = levelNum;

        // T9: Reset battery to 100% on every (re)start so it's always a fresh countdown.
        const batFill = document.getElementById('bat-fill');
        const batVal = document.getElementById('bat-val');
        if (batVal) batVal.textContent = '100';
        if (batFill) batFill.style.width = '100%';

        // T9: Reset score display. LevelManager.spawnLevel already zeros this.score;
        // we keep the DOM in sync here so the HUD never shows a stale value.
        const scoreEl = document.getElementById('current-score');
        if (scoreEl) scoreEl.textContent = '0';

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
        // Re-apply the DPR cap in case the window moved to a different display (T4).
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    // Shared drone reset (T2): used by both the 'R' key and the on-screen reset button.
    resetDrone() {
        if (!this.drone || !this.drone.body) return;
        this.drone.body.position.set(0, 2, 0);
        this.drone.body.velocity.set(0, 0, 0);
        this.drone.body.angularVelocity.set(0, 0, 0);
        this.drone.body.quaternion.set(0, 0, 0, 1);
    }

    // Gyro permission status feedback (T3). Reverts the <select> to 'joystick' on deny/unsupported.
    updateGyroStatus(status, selectEl) {
        const statusEl = document.getElementById('gyro-status');
        if (!statusEl) return;
        if (status === 'granted') {
            statusEl.textContent = 'TILT CONTROLS ENABLED';
            statusEl.className = 'gyro-status ok';
        } else if (status === 'denied') {
            statusEl.textContent = 'PERMISSION DENIED — USING JOYSTICKS';
            statusEl.className = 'gyro-status error';
            if (selectEl) selectEl.value = 'joystick';
        } else if (status === 'unsupported') {
            statusEl.textContent = 'GYRO NOT SUPPORTED — USING JOYSTICKS';
            statusEl.className = 'gyro-status error';
            if (selectEl) selectEl.value = 'joystick';
        } else {
            // 'ok' — joystick mode, no permission needed
            statusEl.textContent = '';
            statusEl.className = 'gyro-status';
        }
    }

    updateHUD(dt) {
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

        // Battery drain logic (frame-rate-independent): 0.3%/s ≈ the old 0.005/frame at 60fps.
        const batFill = document.getElementById('bat-fill');
        const batVal = document.getElementById('bat-val');
        let currentBat = parseFloat(batVal.textContent);
        if (currentBat > 0 && this.isPlaying) {
            currentBat -= 0.3 * dt;
            batVal.textContent = Math.max(0, currentBat).toFixed(1);
            batFill.style.width = `${currentBat}%`;
        }

        const dbg = document.getElementById('debug-joystick');
        if (dbg && this.controls) {
            const lj = this.controls.joystickData.left;
            const rj = this.controls.joystickData.right;
            const state = this.controls.getState();
            dbg.textContent = `L [Thrust/Yaw] X: ${lj.x.toFixed(2)} Y: ${lj.y.toFixed(2)} => Thrust: ${state.thrust.toFixed(2)} Yaw: ${state.yaw.toFixed(2)}\nR [Pitch/Roll] X: ${rj.x.toFixed(2)} Y: ${rj.y.toFixed(2)} => Pitch: ${state.pitch.toFixed(2)} Roll: ${state.roll.toFixed(2)}`;
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

    // T10: show the mission-complete overlay with the final score.
    showMissionComplete(score) {
        this.isPlaying = false;
        const el = document.getElementById('mission-final-score');
        if (el) el.textContent = score;
        document.getElementById('mission-complete-overlay').classList.add('active');
    }

    /**
     * T12: Brief red screen flash on collision.
     * Uses a simple CSS-animated overlay div rather than a Three.js post-process
     * to keep it lightweight and frame-rate-independent.
     */
    _triggerScreenFlash() {
        let flashEl = document.getElementById('collision-flash');
        if (!flashEl) {
            flashEl = document.createElement('div');
            flashEl.id = 'collision-flash';
            document.body.appendChild(flashEl);
        }
        // Reset animation by removing and re-adding the class
        flashEl.classList.remove('active');
        // Trigger reflow so the removal is processed before we re-add
        void flashEl.offsetWidth;
        flashEl.classList.add('active');
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Real, clamped delta time (T1). Cap at 0.05s so physics never explodes after a
        // tab is backgrounded; cannon-es's 3 sub-steps at 1/60 exactly absorb 0.05s.
        const now = performance.now();
        const deltaTime = Math.max(0, Math.min((now - this.lastFrameTime) / 1000, 0.05));
        this.lastFrameTime = now;
        
        if (this.isPlaying) {
            this.physics.update(deltaTime);
            
            const state = this.controls.getState();
            
            if (state.reset) {
                // Instantly reset the drone if 'R' is pressed (T2: shared with on-screen button)
                this.resetDrone();
            } else {
                // Ground assist: if player gives pitch/roll input while touching the floor, gently lift off
                if (this.drone.body.position.y < 0.25 && (state.pitch !== 0 || state.roll !== 0)) {
                    this.drone.body.applyForce(new CANNON.Vec3(0, 8, 0), new CANNON.Vec3(0, 0, 0));
                }

                // Liftoff assist: if player pushes left stick up (thrust), provide solid initial takeoff boost from floor
                if (this.drone.body.position.y < 0.35 && state.thrust > 0.05) {
                    this.drone.body.applyForce(new CANNON.Vec3(0, 10 * state.thrust, 0), new CANNON.Vec3(0, 0, 0));
                }

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
            this.audio.updateEngine(state.thrust); // T11: modulate engine hum
            this.levelManager.checkCollisions(this.drone.group.position);
            this.levelManager.update(deltaTime); // T12: tick ring flash lights
            this.updateHUD(deltaTime);

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

