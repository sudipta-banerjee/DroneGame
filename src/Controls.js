import nipplejs from 'nipplejs';

export class Controls {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false,
            yawLeft: false,
            yawRight: false,
            reset: false
        };

        this.mode = 'joystick'; // 'joystick' or 'gyro'
        this.joystickData = {
            left: { x: 0, y: 0 },
            right: { x: 0, y: 0 }
        };
        
        this.gyroData = { pitch: 0, roll: 0 };

        this.initKeyboard();
        this.initMobile();
    }

    initKeyboard() {
        window.addEventListener('keydown', (e) => this.handleKey(e.code, true));
        window.addEventListener('keyup', (e) => this.handleKey(e.code, false));
    }

    handleKey(code, isPressed) {
        switch (code) {
            case 'KeyW': this.keys.forward = isPressed; break;
            case 'KeyS': this.keys.backward = isPressed; break;
            case 'KeyA': this.keys.left = isPressed; break;
            case 'KeyD': this.keys.right = isPressed; break;
            case 'Space': this.keys.up = isPressed; break;
            case 'ShiftLeft': this.keys.down = isPressed; break;
            case 'KeyQ': this.keys.yawLeft = isPressed; break;
            case 'KeyE': this.keys.yawRight = isPressed; break;
            case 'KeyR': this.keys.reset = isPressed; break;
        }
    }

    initMobile() {
        // Find existing joystick elements from DOM or create them
        let container = document.getElementById('joysticks-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'joysticks-container';
            document.body.appendChild(container);
        }

        let leftZone = document.getElementById('left-joystick');
        if (!leftZone) {
            leftZone = document.createElement('div');
            leftZone.className = 'joystick-zone';
            leftZone.id = 'left-joystick';
            container.appendChild(leftZone);
        }

        let rightZone = document.getElementById('right-joystick');
        if (!rightZone) {
            rightZone = document.createElement('div');
            rightZone.className = 'joystick-zone';
            rightZone.id = 'right-joystick';
            container.appendChild(rightZone);
        }

        // Left Joystick: Thrust (Y) and Yaw (X)
        // Using static mode keeps the joystick permanently centered inside its zone.
        this.leftJoystick = nipplejs.create({
            zone: leftZone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            size: 110,
            color: {
                back: 'rgba(0, 242, 255, 0.15)',
                front: '#00f2ff'
            },
            restOpacity: 0.75,
            catchDistance: 150
        });

        this.leftJoystick.on('move', (evt, data) => {
            if (data.vector) {
                // data.vector.x: positive is right, negative is left
                // data.vector.y: positive is up, negative is down
                // Game engine treats +1 Yaw as turning Left, so invert X
                this.joystickData.left.x = -Math.min(Math.max(data.vector.x, -1), 1);
                this.joystickData.left.y = Math.min(Math.max(data.vector.y, -1), 1);
            } else if (data.angle && data.distance !== undefined) {
                const mag = Math.min(data.distance / 55, 1.0);
                this.joystickData.left.x = -Math.cos(data.angle.radian) * mag;
                this.joystickData.left.y = Math.sin(data.angle.radian) * mag;
            }
        });

        this.leftJoystick.on('end', () => {
            this.joystickData.left.x = 0;
            this.joystickData.left.y = 0;
        });

        // Right Joystick: Pitch (Forward/Back) and Roll (Left/Right)
        this.rightJoystick = nipplejs.create({
            zone: rightZone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            size: 110,
            color: {
                back: 'rgba(255, 0, 255, 0.15)',
                front: '#ff00ff'
            },
            restOpacity: 0.75,
            catchDistance: 150
        });

        this.rightJoystick.on('move', (evt, data) => {
            if (data.vector) {
                // data.vector.x: positive is right (roll right), negative is left (roll left)
                // data.vector.y: positive is up (pitch forward), negative is down (pitch backward)
                this.joystickData.right.x = Math.min(Math.max(data.vector.x, -1), 1);
                this.joystickData.right.y = Math.min(Math.max(data.vector.y, -1), 1);
            } else if (data.angle && data.distance !== undefined) {
                const mag = Math.min(data.distance / 55, 1.0);
                this.joystickData.right.x = Math.cos(data.angle.radian) * mag;
                this.joystickData.right.y = Math.sin(data.angle.radian) * mag;
            }
        });

        this.rightJoystick.on('end', () => {
            this.joystickData.right.x = 0;
            this.joystickData.right.y = 0;
        });

        // Toggle visibility based on device touch capability
        const isTouchDevice = ('ontouchstart' in window) || 
            (navigator.maxTouchPoints > 0) || 
            (navigator.msMaxTouchPoints > 0) || 
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

        if (!isTouchDevice) {
            container.style.display = 'none';
        }
        // Expose touch state on <body> so CSS can show/hide mobile-only UI (e.g. reset button).
        document.body.classList.toggle('touch-device', isTouchDevice);

        // If a touch interaction occurs at any time, reveal joysticks and recalculate positions
        window.addEventListener('touchstart', () => {
            container.style.display = 'block';
            document.body.classList.add('touch-device');
            setTimeout(() => this.reposition(), 50);
        }, { once: true });

        // Auto-reposition joysticks when window size or orientation changes
        window.addEventListener('resize', () => {
            setTimeout(() => this.reposition(), 60);
        });
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.reposition(), 100);
        });

        // Gyroscope setup
        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', (e) => {
                if (this.mode === 'gyro') {
                    // map beta (pitch) and gamma (roll)
                    this.gyroData.pitch = (e.beta - 45) / 45; // assuming 45deg neutral
                    this.gyroData.roll = e.gamma / 45;
                }
            });
        }
    }

    reposition() {
        if (this.leftJoystick && typeof this.leftJoystick.reposition === 'function') {
            this.leftJoystick.reposition();
        }
        if (this.rightJoystick && typeof this.rightJoystick.reposition === 'function') {
            this.rightJoystick.reposition();
        }
    }

    // Set the active control mode. For 'gyro' on iOS 13+, request DeviceOrientation
    // permission. This MUST run from a user gesture — the settings <select> change event
    // calls setMode, and requestPermission() is invoked synchronously before the first
    // await, so iOS's gesture requirement is satisfied. Returns a status string:
    // 'granted' | 'denied' | 'unsupported' | 'ok' (joystick mode needs no permission).
    async setMode(mode) {
        if (mode !== 'gyro') {
            this.mode = 'joystick';
            this._setRightJoystickOpacity(false);
            return 'ok';
        }

        // gyro mode requested
        if (typeof window.DeviceOrientationEvent === 'undefined') {
            this.mode = 'joystick';
            this._setRightJoystickOpacity(false);
            return 'unsupported';
        }

        // iOS 13+ requires an explicit permission prompt triggered from a user gesture.
        // Android/desktop have DeviceOrientationEvent but no requestPermission, so they
        // fall through and use gyro directly (events fire without a prompt).
        if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await window.DeviceOrientationEvent.requestPermission();
                if (response !== 'granted') {
                    this.mode = 'joystick';
                    this._setRightJoystickOpacity(false);
                    return 'denied';
                }
            } catch (_err) {
                this.mode = 'joystick';
                this._setRightJoystickOpacity(false);
                return 'denied';
            }
        }

        this.mode = 'gyro';
        this._setRightJoystickOpacity(true);
        return 'granted';
    }

    _setRightJoystickOpacity(dim) {
        const right = document.getElementById('right-joystick');
        if (right) right.style.opacity = dim ? '0.2' : '1';
    }

    getState() {
        const state = {
            thrust: 0,
            pitch: 0,
            roll: 0,
            yaw: 0,
            reset: this.keys.reset
        };

        // Keyboard
        if (this.keys.up) state.thrust = 1;
        if (this.keys.down) state.thrust = -0.5;
        if (this.keys.forward) state.pitch = 1;
        if (this.keys.backward) state.pitch = -1;
        if (this.keys.left) state.roll = -1;
        if (this.keys.right) state.roll = 1;
        if (this.keys.yawLeft) state.yaw = 1;
        if (this.keys.yawRight) state.yaw = -1;

        // Mobile Joysticks (Combine with keyboard)
        // Left J: Y -> Thrust, X -> Yaw
        state.thrust += this.joystickData.left.y;
        state.yaw += this.joystickData.left.x;

        // Right J: Y -> Pitch, X -> Roll (or Gyro)
        if (this.mode === 'gyro') {
            state.pitch += this.gyroData.pitch;
            state.roll += this.gyroData.roll;
        } else {
            state.pitch += this.joystickData.right.y;
            state.roll += this.joystickData.right.x;
        }

        // Clamp values
        const clamp = (v) => Math.min(Math.max(v, -1), 1);
        state.thrust = clamp(state.thrust);
        state.pitch = clamp(state.pitch);
        state.roll = clamp(state.roll);
        state.yaw = clamp(state.yaw);

        return state;
    }
}

