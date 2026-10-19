/**
 * Audio.js — T11
 *
 * Manages all game audio via the Web Audio API.
 *
 * Sounds:
 *   - Engine hum: continuous oscillator whose pitch/volume track thrust level.
 *   - Ring chime: short ascending tone played on ring collection.
 *   - Collision thud: noise burst played on building hit.
 *   - UI click: brief tick played on button press.
 *
 * Design notes:
 *   - AudioContext is created lazily on the first user gesture (browser autoplay policy).
 *   - All gain nodes are routed through a master gain so the mute toggle is a single operation.
 *   - Mute preference is persisted to localStorage ('drone_audio_muted').
 *   - The engine hum uses two slightly detuned oscillators for a richer drone sound.
 */
export class Audio {
    constructor() {
        this._ctx = null;
        this._masterGain = null;

        // Engine oscillators (created once the context is ready)
        this._engineGain = null;
        this._osc1 = null;
        this._osc2 = null;

        // Mute state (persisted)
        this.muted = localStorage.getItem('drone_audio_muted') === 'true';

        // Start context on any user gesture (once)
        this._gestureHandler = () => this._initContext();
        window.addEventListener('pointerdown', this._gestureHandler, { once: true });
        window.addEventListener('keydown',     this._gestureHandler, { once: true });
    }

    // ─── Internal context bootstrap ───────────────────────────────────────────

    _initContext() {
        if (this._ctx) return;

        this._ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Master gain → destination
        this._masterGain = this._ctx.createGain();
        this._masterGain.gain.value = this.muted ? 0 : 1;
        this._masterGain.connect(this._ctx.destination);

        this._startEngine();
    }

    /** Ensure context is running (it can be suspended by the browser). */
    _resume() {
        if (this._ctx && this._ctx.state === 'suspended') {
            this._ctx.resume();
        }
    }

    // ─── Engine hum ───────────────────────────────────────────────────────────

    _startEngine() {
        const ctx = this._ctx;

        this._engineGain = ctx.createGain();
        this._engineGain.gain.value = 0.08; // quiet idle hum
        this._engineGain.connect(this._masterGain);

        // Two oscillators, slightly detuned, give a richer multi-rotor texture
        this._osc1 = ctx.createOscillator();
        this._osc1.type = 'sawtooth';
        this._osc1.frequency.value = 90;   // base pitch at idle
        this._osc1.connect(this._engineGain);
        this._osc1.start();

        this._osc2 = ctx.createOscillator();
        this._osc2.type = 'sawtooth';
        this._osc2.frequency.value = 94;   // slightly detuned for beating effect
        this._osc2.connect(this._engineGain);
        this._osc2.start();
    }

    /**
     * Call every frame with the current normalised thrust value (−1 … 1).
     * At 0 thrust the drone hovers; positive values raise pitch/volume.
     */
    updateEngine(thrustNorm) {
        if (!this._ctx || !this._osc1) return;
        const now = this._ctx.currentTime;

        // Map thrust [-1, 1] → frequency [70, 180] Hz and gain [0.05, 0.18]
        const freq = 70 + (thrustNorm + 1) * 0.5 * 110;
        const gain = 0.05 + (thrustNorm + 1) * 0.5 * 0.13;

        this._osc1.frequency.setTargetAtTime(freq,       now, 0.1);
        this._osc2.frequency.setTargetAtTime(freq + 4,   now, 0.1);
        this._engineGain.gain.setTargetAtTime(gain,      now, 0.1);
    }

    // ─── One-shot sounds ──────────────────────────────────────────────────────

    /** Short ascending chime on ring collection. */
    playRingChime() {
        if (!this._ctx) return;
        this._resume();
        const ctx = this._ctx;
        const now = ctx.currentTime;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        gain.connect(this._masterGain);

        // Two-note ascending arpeggio (C5 → E5)
        [523.25, 659.25].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.connect(gain);
            osc.start(now + i * 0.08);
            osc.stop(now + 0.6);
        });
    }

    /** Low-frequency thud on building collision. */
    playCollisionThud() {
        if (!this._ctx) return;
        this._resume();
        const ctx = this._ctx;
        const now = ctx.currentTime;

        // Filtered noise burst for the physical impact feel
        const bufLen = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 120;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this._masterGain);

        source.start(now);
        source.stop(now + 0.15);
    }

    /** Brief tick for UI button presses. */
    playUIClick() {
        if (!this._ctx) return;
        this._resume();
        const ctx = this._ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 880;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(this._masterGain);

        osc.start(now);
        osc.stop(now + 0.06);
    }

    // ─── Mute toggle ──────────────────────────────────────────────────────────

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('drone_audio_muted', this.muted);
        if (this._masterGain) {
            const now = this._ctx.currentTime;
            this._masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.05);
        }
        return this.muted;
    }
}
