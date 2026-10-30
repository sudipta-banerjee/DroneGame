/**
 * TouchJoystick - Zero-dependency, high-performance virtual joystick
 * designed specifically for mobile touchscreens and pointer events.
 *
 * Features:
 * - Uses Pointer Events with Pointer Capture (never drops touch when dragging outside the circle)
 * - Independent tracking per pointerId (rock-solid multitouch)
 * - Hardware-accelerated 3D transforms
 * - Deadzone and linear scaling
 * - Automatic spring-back to center on release
 */

export class TouchJoystick {
    constructor(options) {
        this.zone = options.zone;
        this.size = options.size || 130;
        this.deadzone = options.deadzone || 0.05;
        this.theme = options.theme || 'cyan'; // 'cyan' or 'pink'
        this.onMove = options.onMove || (() => {});
        this.onEnd = options.onEnd || (() => {});

        this.radius = this.size / 2;
        this.value = { x: 0, y: 0 };
        this.activePointerId = null;

        this.initDOM();
        this.initEvents();
    }

    initDOM() {
        // Clear any previous children (e.g. leftover nipple elements)
        const labels = this.zone.querySelectorAll('.joystick-label');
        this.zone.innerHTML = '';
        labels.forEach(l => this.zone.appendChild(l));

        this.base = document.createElement('div');
        this.base.className = `touch-joystick-base ${this.theme}`;

        // Crosshairs inside the base
        const reticle = document.createElement('div');
        reticle.className = 'touch-joystick-reticle';
        this.base.appendChild(reticle);

        // Movable thumb puck
        this.thumb = document.createElement('div');
        this.thumb.className = `touch-joystick-thumb ${this.theme}`;
        this.base.appendChild(this.thumb);

        this.zone.appendChild(this.base);
    }

    initEvents() {
        // Prevent gesture navigation or zoom on touch
        this.zone.style.touchAction = 'none';

        this.zone.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        this.zone.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        this.zone.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        this.zone.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
        this.zone.addEventListener('lostpointercapture', () => this.reset());
    }

    handlePointerDown(e) {
        if (this.activePointerId !== null) return;
        this.activePointerId = e.pointerId;

        try {
            this.zone.setPointerCapture(e.pointerId);
        } catch (_err) {
            // fallback
        }

        this.thumb.style.transition = 'none';
        this.zone.classList.add('active');
        this.updateFromPointer(e.clientX, e.clientY);
    }

    handlePointerMove(e) {
        if (e.pointerId !== this.activePointerId) return;
        this.updateFromPointer(e.clientX, e.clientY);
    }

    handlePointerUp(e) {
        if (e.pointerId !== this.activePointerId) return;
        this.reset();
        try {
            this.zone.releasePointerCapture(e.pointerId);
        } catch (_err) {
            // fallback
        }
        this.activePointerId = null;
    }

    updateFromPointer(clientX, clientY) {
        const rect = this.zone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);

        // Clamp travel to radius
        const maxRadius = this.radius * 0.75; // travel distance
        let clampedDx = dx;
        let clampedDy = dy;
        if (dist > maxRadius) {
            clampedDx = (dx / dist) * maxRadius;
            clampedDy = (dy / dist) * maxRadius;
        }

        // Move thumb element directly using 3D transform
        this.thumb.style.transform = `translate3d(${clampedDx}px, ${clampedDy}px, 0)`;

        // Compute normalized output coordinates: -1.0 to +1.0
        // X: positive right, negative left
        // Y: positive UP (screen Y is inverted), negative DOWN
        const rawNormX = clampedDx / maxRadius;
        const rawNormY = -clampedDy / maxRadius;
        const normDist = Math.hypot(rawNormX, rawNormY);

        if (normDist < this.deadzone) {
            this.value.x = 0;
            this.value.y = 0;
        } else {
            // Rescale so input starts smoothly from deadzone
            const scaled = (normDist - this.deadzone) / (1 - this.deadzone);
            this.value.x = (rawNormX / normDist) * scaled;
            this.value.y = (rawNormY / normDist) * scaled;
        }

        this.onMove(this.value);
    }

    reset() {
        this.activePointerId = null;
        this.zone.classList.remove('active');
        this.value.x = 0;
        this.value.y = 0;

        // Spring snap back to center
        this.thumb.style.transition = 'transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        this.thumb.style.transform = 'translate3d(0, 0, 0)';

        this.onEnd();
    }

    reposition() {
        // Pointer events dynamically use getBoundingClientRect, so no state cache to invalidate
    }
}
