// vehicle-audio.js - Procedural vehicle audio using Web Audio API
// Engine hum, collision impacts, weapon fire sounds

export class VehicleAudio {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.initialized = false;

        // Engine sound nodes
        this._engineOsc = null;
        this._engineGain = null;
        this._engineFilter = null;
        this._noiseSource = null;
        this._noiseGain = null;
        this._noiseBuffer = null;

        // Engine state
        this._currentFreq = 80;
        this._targetFreq = 80;

        this._init();
    }

    _init() {
        const initAudio = () => {
            if (this.initialized) return;
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGain = this.audioContext.createGain();
                this.masterGain.gain.value = 0.3;
                this.masterGain.connect(this.audioContext.destination);
                this._createEngineSound();
                this.initialized = true;
            } catch (e) {
                console.warn('VehicleAudio: Web Audio API not available');
            }
        };

        document.addEventListener('click', initAudio, { once: false });
        document.addEventListener('keydown', initAudio, { once: false });

        // Store the init function so we can clean up listeners
        this._initAudio = initAudio;
    }

    _createEngineSound() {
        const ctx = this.audioContext;

        // Main engine oscillator (sawtooth for richness, filtered)
        this._engineOsc = ctx.createOscillator();
        this._engineOsc.type = 'sawtooth';
        this._engineOsc.frequency.value = 80;

        this._engineFilter = ctx.createBiquadFilter();
        this._engineFilter.type = 'lowpass';
        this._engineFilter.frequency.value = 300;
        this._engineFilter.Q.value = 2;

        this._engineGain = ctx.createGain();
        this._engineGain.gain.value = 0;

        this._engineOsc.connect(this._engineFilter);
        this._engineFilter.connect(this._engineGain);
        this._engineGain.connect(this.masterGain);
        this._engineOsc.start();

        // Noise for engine rumble
        const bufferSize = ctx.sampleRate * 2;
        this._noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = this._noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this._startNoiseLoop();
    }

    _startNoiseLoop() {
        const ctx = this.audioContext;

        this._noiseSource = ctx.createBufferSource();
        this._noiseSource.buffer = this._noiseBuffer;
        this._noiseSource.loop = true;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 200;
        this._noiseFilter = noiseFilter;

        this._noiseGain = ctx.createGain();
        this._noiseGain.gain.value = 0;

        this._noiseSource.connect(noiseFilter);
        noiseFilter.connect(this._noiseGain);
        this._noiseGain.connect(this.masterGain);
        this._noiseSource.start();
    }

    /**
     * Update engine sound each frame
     * @param {number} speed - current vehicle speed
     * @param {number} throttle - -1..1 throttle input
     */
    update(speed, throttle) {
        if (!this.initialized) return;

        const absSpeed = Math.abs(speed);
        const maxSpeed = 20;
        const speedRatio = Math.min(absSpeed / maxSpeed, 1);

        // Engine frequency: 80Hz idle + speed modulation
        this._targetFreq = 80 + absSpeed * 4;

        // Throttle spike: brief pitch increase when accelerating
        if (throttle > 0) {
            this._targetFreq += 20 * throttle;
        } else if (throttle === 0 && absSpeed > 0.5) {
            // Engine braking: lower pitch when coasting
            this._targetFreq -= 10;
        }

        // Smooth frequency transition
        this._currentFreq += (this._targetFreq - this._currentFreq) * 0.1;
        this._engineOsc.frequency.value = Math.max(60, this._currentFreq);

        // Filter opens with RPM
        this._engineFilter.frequency.value = 200 + speedRatio * 400;

        // Volume: 0.05 idle -> 0.15 at max speed
        const engineVol = 0.05 + speedRatio * 0.10;
        this._engineGain.gain.value = engineVol;

        // Rumble noise volume scales with speed
        if (this._noiseGain) {
            this._noiseGain.gain.value = 0.02 + speedRatio * 0.04;
        }
    }

    /**
     * Play collision impact sound
     * @param {number} speed - speed at collision
     */
    playCollision(speed) {
        if (!this.initialized) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const duration = 0.1;
        const volume = Math.min(speed / 20, 1) * 0.3;

        // White noise burst through bandpass
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(bufferSize)), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        filter.Q.value = 1.5;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + duration);
    }

    /**
     * Play turret fire sound (sine chirp 800->400Hz)
     */
    playTurretFire() {
        if (!this.initialized) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const duration = 0.05;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(400, now + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + duration);
    }

    /**
     * Play spell launcher fire sound (sweep 200->1200Hz with decay)
     */
    playSpellFire() {
        if (!this.initialized) return;

        const ctx = this.audioContext;
        const now = ctx.currentTime;
        const duration = 0.15;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0, now + duration + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + duration + 0.05);
    }

    /**
     * Start engine sound (call when entering vehicle)
     */
    startEngine() {
        if (!this.initialized) return;
        this._engineGain.gain.value = 0.05;
        if (this._noiseGain) this._noiseGain.gain.value = 0.02;
    }

    /**
     * Stop engine sound (call when exiting vehicle)
     */
    stopEngine() {
        if (!this.initialized) return;
        this._engineGain.gain.value = 0;
        if (this._noiseGain) this._noiseGain.gain.value = 0;
    }

    dispose() {
        if (this._engineOsc) {
            this._engineOsc.stop();
            this._engineOsc.disconnect();
        }
        if (this._noiseSource) {
            this._noiseSource.stop();
            this._noiseSource.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        document.removeEventListener('click', this._initAudio);
        document.removeEventListener('keydown', this._initAudio);
    }
}
