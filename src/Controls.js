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
        // Create Joystick containers if they don't exist
        const container = document.createElement('div');
        container.id = 'joysticks-container';
        document.body.appendChild(container);

        const leftZone = document.createElement('div');
        leftZone.className = 'joystick-zone';
        leftZone.id = 'left-joystick';
        container.appendChild(leftZone);

        const rightZone = document.createElement('div');
        rightZone.className = 'joystick-zone';
        rightZone.id = 'right-joystick';
        container.appendChild(rightZone);

        // Left Joystick: Thrust and Yaw
        this.leftJoystick = nipplejs.create({
            zone: leftZone,
            mode: 'semi',
            catchDistance: 150,
            color: '#00f2ff'
        });

        this.leftJoystick.on('move', (evt, data) => {
            if (data.angle && data.distance !== undefined) {
                const mag = Math.min(data.distance / 50, 1.0);
                // Invert X because the game engine treats +1 Yaw as turning Left
                this.joystickData.left.x = -Math.cos(data.angle.radian) * mag;
                this.joystickData.left.y = Math.sin(data.angle.radian) * mag;
            }
        });

        this.leftJoystick.on('end', () => {
            this.joystickData.left.x = 0;
            this.joystickData.left.y = 0;
        });

        // Right Joystick: Pitch and Roll
        this.rightJoystick = nipplejs.create({
            zone: rightZone,
            mode: 'semi',
            catchDistance: 150,
            color: '#ff00ff'
        });

        this.rightJoystick.on('move', (evt, data) => {
            if (data.angle && data.distance !== undefined) {
                const mag = Math.min(data.distance / 50, 1.0);
                this.joystickData.right.x = Math.cos(data.angle.radian) * mag;
                this.joystickData.right.y = Math.sin(data.angle.radian) * mag;
            }
        });

        this.rightJoystick.on('end', () => {
            this.joystickData.right.x = 0;
            this.joystickData.right.y = 0;
        });

        // Toggle visibility based on device
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
        if (!isTouchDevice) {
            container.style.display = 'none';
        }
        // Expose touch state on <body> so CSS can show/hide mobile-only UI (e.g. reset button).
        document.body.classList.toggle('touch-device', isTouchDevice);

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

