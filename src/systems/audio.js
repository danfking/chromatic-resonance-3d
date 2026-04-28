// audio.js - Simple procedural audio system using Web Audio API

export class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.initialized = false;
        this.volume = 0.3;

        this.init();
        this.setupEventListeners();
    }

    init() {
        // Create audio context on first user interaction
        const initAudio = () => {
            if (this.initialized) return;

            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGain = this.audioContext.createGain();
                this.masterGain.connect(this.audioContext.destination);
                this.masterGain.gain.value = this.volume;
                this.initialized = true;
            } catch (e) {
                console.warn('Web Audio API not available');
            }
        };

        // Initialize on first click
        document.addEventListener('click', initAudio, { once: true });
        document.addEventListener('keydown', initAudio, { once: true });
    }

    setupEventListeners() {
        // Color extraction
        window.addEventListener('color-extracted', () => {
            this.playExtract();
        });

        // Abilities
        window.addEventListener('ability-used', (e) => {
            const { ability } = e.detail;
            this.playAbility(ability);
        });

        // Enemy hit
        window.addEventListener('enemy-hit', () => {
            this.playHit();
        });

        // Enemy death
        window.addEventListener('enemy-died', () => {
            this.playEnemyDeath();
        });

        // Player damage
        window.addEventListener('player-damaged', () => {
            this.playPlayerDamage();
        });

        // Wave complete
        window.addEventListener('wave-complete', () => {
            this.playWaveComplete();
        });

        // Level up
        window.addEventListener('level-up', () => {
            this.playLevelUp();
        });

        // Victory
        window.addEventListener('play-victory-sound', () => {
            this.playVictory();
        });

        // Combo hit
        window.addEventListener('combo-hit', (e) => {
            this.playComboHit(e.detail.combo);
        });

        // Boss spawn
        window.addEventListener('play-boss-sound', () => {
            this.playBossSpawn();
        });

        // Powerup collected
        window.addEventListener('powerup-collected', () => {
            this.playPowerupCollect();
        });
    }

    // Create an oscillator with envelope
    createTone(frequency, type, duration, attack = 0.01, release = 0.1) {
        if (!this.initialized) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = type;
        osc.frequency.value = frequency;

        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + attack);
        gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration - release);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.audioContext.currentTime + duration);
    }

    // Play noise burst (for impacts)
    playNoise(duration, filterFreq = 1000) {
        if (!this.initialized) return;

        const bufferSize = this.audioContext.sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start();
        noise.stop(this.audioContext.currentTime + duration);
    }

    // Sound effects

    playExtract() {
        // Bright ascending tones - like collecting something magical
        this.createTone(440, 'sine', 0.15, 0.01, 0.05);
        setTimeout(() => this.createTone(660, 'sine', 0.15, 0.01, 0.05), 50);
        setTimeout(() => this.createTone(880, 'sine', 0.2, 0.01, 0.1), 100);
    }

    playAbility(ability) {
        switch (ability) {
            case 'crimson-bolt':
                // Fiery whoosh
                this.createTone(200, 'sawtooth', 0.2, 0.01, 0.15);
                this.createTone(150, 'square', 0.15, 0.01, 0.1);
                break;
            case 'azure-shield':
                // Magical shimmer
                this.createTone(523, 'sine', 0.3, 0.05, 0.2);
                this.createTone(659, 'sine', 0.3, 0.05, 0.2);
                this.createTone(784, 'sine', 0.4, 0.1, 0.25);
                break;
            case 'verdant-heal':
                // Gentle healing tones
                this.createTone(330, 'sine', 0.4, 0.1, 0.2);
                setTimeout(() => this.createTone(392, 'sine', 0.3, 0.05, 0.15), 100);
                setTimeout(() => this.createTone(494, 'sine', 0.3, 0.05, 0.15), 200);
                break;
            case 'golden-radiance':
                // Bright flash
                this.createTone(880, 'sine', 0.1, 0.01, 0.05);
                this.createTone(1100, 'sine', 0.15, 0.01, 0.1);
                break;
            case 'violet-rift':
                // Distorted reality tear
                this.createTone(100, 'sawtooth', 0.5, 0.05, 0.3);
                this.createTone(103, 'sawtooth', 0.5, 0.05, 0.3);
                this.playNoise(0.3, 500);
                break;
            default:
                this.createTone(440, 'sine', 0.1);
        }
    }

    playHit() {
        // Impact sound
        this.playNoise(0.1, 2000);
        this.createTone(150, 'square', 0.08, 0.01, 0.05);
    }

    playEnemyDeath() {
        // Descending tone with noise
        this.createTone(400, 'sawtooth', 0.3, 0.01, 0.2);
        setTimeout(() => this.createTone(200, 'sawtooth', 0.2, 0.01, 0.15), 50);
        setTimeout(() => this.createTone(100, 'sawtooth', 0.2, 0.01, 0.15), 100);
        this.playNoise(0.2, 800);
    }

    playPlayerDamage() {
        // Sharp pain indicator
        this.createTone(200, 'square', 0.15, 0.01, 0.1);
        this.createTone(180, 'square', 0.15, 0.01, 0.1);
        this.playNoise(0.1, 1500);
    }

    playWaveComplete() {
        // Triumphant fanfare
        const playNote = (freq, delay) => {
            setTimeout(() => this.createTone(freq, 'sine', 0.2, 0.02, 0.1), delay);
        };

        playNote(523, 0);    // C
        playNote(659, 100);  // E
        playNote(784, 200);  // G
        playNote(1047, 300); // High C
    }

    playLevelUp() {
        // Epic level up sound - ascending arpeggio with shimmer
        const playNote = (freq, delay, duration = 0.25) => {
            setTimeout(() => this.createTone(freq, 'sine', duration, 0.02, 0.15), delay);
        };

        // Ascending major chord arpeggio
        playNote(262, 0);      // C4
        playNote(330, 80);     // E4
        playNote(392, 160);    // G4
        playNote(523, 240);    // C5
        playNote(659, 320);    // E5
        playNote(784, 400);    // G5
        playNote(1047, 500, 0.5); // C6 (sustained)

        // Add shimmer
        setTimeout(() => {
            this.createTone(1047, 'sine', 0.4, 0.1, 0.3);
            this.createTone(1319, 'sine', 0.4, 0.1, 0.3);
        }, 550);
    }

    playPowerupCollect() {
        // Magical power-up sound
        this.createTone(523, 'sine', 0.15, 0.01, 0.1);
        setTimeout(() => this.createTone(659, 'sine', 0.15, 0.01, 0.1), 50);
        setTimeout(() => this.createTone(784, 'sine', 0.15, 0.01, 0.1), 100);
        setTimeout(() => this.createTone(1047, 'sine', 0.25, 0.01, 0.15), 150);
    }

    playBossSpawn() {
        // Ominous boss warning sound
        // Deep rumble
        this.createTone(60, 'sawtooth', 1.0, 0.2, 0.5);
        this.createTone(62, 'sawtooth', 1.0, 0.2, 0.5);

        // Warning tones
        setTimeout(() => {
            this.createTone(200, 'square', 0.3, 0.01, 0.2);
        }, 200);
        setTimeout(() => {
            this.createTone(200, 'square', 0.3, 0.01, 0.2);
        }, 500);
        setTimeout(() => {
            this.createTone(150, 'square', 0.5, 0.01, 0.3);
        }, 800);

        // Impact
        setTimeout(() => {
            this.playNoise(0.3, 400);
            this.createTone(80, 'sawtooth', 0.4, 0.01, 0.3);
        }, 1200);
    }

    playComboHit(combo) {
        // Rising pitch based on combo count
        const baseFreq = 440;
        const freq = baseFreq + (combo * 30); // Higher pitch for higher combos
        const cappedFreq = Math.min(freq, 1200); // Cap at reasonable frequency

        this.createTone(cappedFreq, 'sine', 0.1, 0.01, 0.08);

        // Add harmonic for high combos
        if (combo >= 5) {
            this.createTone(cappedFreq * 1.5, 'sine', 0.08, 0.01, 0.06);
        }
        if (combo >= 10) {
            this.createTone(cappedFreq * 2, 'sine', 0.06, 0.01, 0.04);
        }
    }

    playVictory() {
        // Epic victory fanfare
        const playNote = (freq, delay, duration = 0.3) => {
            setTimeout(() => this.createTone(freq, 'sine', duration, 0.02, 0.2), delay);
        };

        // Triumphant chord progression
        playNote(262, 0);      // C4
        playNote(330, 0);      // E4
        playNote(392, 0);      // G4

        playNote(349, 300);    // F4
        playNote(440, 300);    // A4
        playNote(523, 300);    // C5

        playNote(392, 600);    // G4
        playNote(494, 600);    // B4
        playNote(587, 600);    // D5

        // Final triumphant chord
        playNote(523, 900, 0.6);  // C5
        playNote(659, 900, 0.6);  // E5
        playNote(784, 900, 0.6);  // G5
        playNote(1047, 900, 0.6); // C6

        // Shimmer finish
        setTimeout(() => {
            this.createTone(1319, 'sine', 0.5, 0.1, 0.4);
            this.createTone(1568, 'sine', 0.5, 0.1, 0.4);
        }, 1200);
    }

    /**
     * Play proximity-based hum for spark core (audio breadcrumb).
     * Call each frame with listener and target positions.
     * @param {THREE.Vector3} listenerPos - Player position
     * @param {THREE.Vector3} targetPos - Spark core position
     * @param {number} maxDist - Maximum audible distance (default 40)
     */
    playProximityHum(listenerPos, targetPos, maxDist = 40) {
        if (!this.initialized) return;

        const dx = listenerPos.x - targetPos.x;
        const dy = listenerPos.y - targetPos.y;
        const dz = listenerPos.z - targetPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const volume = Math.max(0, 1 - dist / maxDist);

        if (!this._proximityHum && volume > 0) {
            // Create hum oscillators
            const ctx = this.audioContext;
            const humGain = ctx.createGain();
            humGain.gain.value = 0;
            humGain.connect(this.masterGain);

            const hum = ctx.createOscillator();
            hum.type = 'sine';
            hum.frequency.value = 80;
            hum.connect(humGain);
            hum.start();

            const shimmerGain = ctx.createGain();
            shimmerGain.gain.value = 0;
            shimmerGain.connect(this.masterGain);

            const shimmer = ctx.createOscillator();
            shimmer.type = 'sine';
            shimmer.frequency.value = 800;
            shimmer.connect(shimmerGain);
            shimmer.start();

            this._proximityHum = { hum, humGain, shimmer, shimmerGain };
        }

        if (this._proximityHum) {
            const t = this.audioContext.currentTime;
            this._proximityHum.humGain.gain.setTargetAtTime(volume * 0.15, t, 0.1);
            this._proximityHum.shimmerGain.gain.setTargetAtTime(volume * 0.03, t, 0.1);
        }
    }

    /**
     * Stop the proximity hum (call when spark core is collected)
     */
    stopProximityHum() {
        if (!this._proximityHum) return;
        const t = this.audioContext.currentTime;
        this._proximityHum.humGain.gain.setTargetAtTime(0, t, 0.05);
        this._proximityHum.shimmerGain.gain.setTargetAtTime(0, t, 0.05);
        setTimeout(() => {
            this._proximityHum.hum.stop();
            this._proximityHum.shimmer.stop();
            this._proximityHum = null;
        }, 200);
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.masterGain) {
            this.masterGain.gain.value = this.volume;
        }
    }

    /**
     * Get the AudioContext (null if not yet initialized)
     */
    getAudioContext() {
        return this.audioContext;
    }

    /**
     * Get the master gain node (null if not yet initialized)
     */
    getMasterGain() {
        return this.masterGain;
    }
}
