// music.js - Procedural music and ambient audio system
// Generates layered oscillator/filter patterns per element theme
// Two states: exploration (sparse, calm) and combat (intense, faster)

import { ELEMENT_TYPES } from '../creatures/particle-life-creature.js';

// Musical scales (semitone offsets from root)
const SCALES = {
    minor:      [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    phrygian:   [0, 1, 3, 5, 7, 8, 10],
    lydian:     [0, 2, 4, 6, 7, 9, 11],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    wholetone:  [0, 2, 4, 6, 8, 10],
};

// Per-element music definitions
const THEME_MUSIC = {
    [ELEMENT_TYPES.FIRE]: {
        root: 55,           // A1
        scale: SCALES.phrygian,
        tempo: 0.45,        // seconds per beat (exploration)
        combatTempo: 0.28,
        oscTypes: ['sawtooth', 'square'],
        filterFreq: 800,
        combatFilterFreq: 1400,
        filterQ: 2,
        reverbDecay: 0.8,
        bassOctave: 0,
        melodyOctave: 2,
        padOctave: 1,
    },
    [ELEMENT_TYPES.WATER]: {
        root: 65.41,        // C2
        scale: SCALES.pentatonic,
        tempo: 0.6,
        combatTempo: 0.35,
        oscTypes: ['sine', 'triangle'],
        filterFreq: 600,
        combatFilterFreq: 1200,
        filterQ: 4,
        reverbDecay: 1.5,
        bassOctave: 0,
        melodyOctave: 3,
        padOctave: 1,
    },
    [ELEMENT_TYPES.EARTH]: {
        root: 41.2,         // E1
        scale: SCALES.dorian,
        tempo: 0.7,
        combatTempo: 0.4,
        oscTypes: ['triangle', 'sawtooth'],
        filterFreq: 500,
        combatFilterFreq: 1000,
        filterQ: 1.5,
        reverbDecay: 1.2,
        bassOctave: 0,
        melodyOctave: 2,
        padOctave: 1,
    },
    [ELEMENT_TYPES.AIR]: {
        root: 73.42,        // D2
        scale: SCALES.lydian,
        tempo: 0.55,
        combatTempo: 0.3,
        oscTypes: ['sine', 'sine'],
        filterFreq: 1200,
        combatFilterFreq: 2000,
        filterQ: 3,
        reverbDecay: 2.0,
        bassOctave: 1,
        melodyOctave: 3,
        padOctave: 2,
    },
    [ELEMENT_TYPES.SHADOW]: {
        root: 49,           // G1
        scale: SCALES.phrygian,
        tempo: 0.65,
        combatTempo: 0.35,
        oscTypes: ['sawtooth', 'square'],
        filterFreq: 400,
        combatFilterFreq: 900,
        filterQ: 6,
        reverbDecay: 1.8,
        bassOctave: 0,
        melodyOctave: 2,
        padOctave: 1,
    },
    [ELEMENT_TYPES.LIGHT]: {
        root: 82.41,        // E2
        scale: SCALES.lydian,
        tempo: 0.5,
        combatTempo: 0.28,
        oscTypes: ['sine', 'triangle'],
        filterFreq: 1500,
        combatFilterFreq: 2400,
        filterQ: 2,
        reverbDecay: 1.0,
        bassOctave: 1,
        melodyOctave: 3,
        padOctave: 2,
    },
};

// Ambient sound definitions per element
const AMBIENT_DEFS = {
    [ELEMENT_TYPES.FIRE]: {
        // Crackling + low rumble
        noiseFilterFreq: 3000,
        noiseFilterQ: 0.5,
        noiseGain: 0.04,
        rumbleFreq: 40,
        rumbleGain: 0.03,
        crackleRate: 2.5,  // crackles per second
    },
    [ELEMENT_TYPES.WATER]: {
        // Water drips + flowing
        noiseFilterFreq: 1200,
        noiseFilterQ: 8,
        noiseGain: 0.03,
        rumbleFreq: 80,
        rumbleGain: 0.02,
        crackleRate: 1.5,
    },
    [ELEMENT_TYPES.EARTH]: {
        // Low rumble + echoes
        noiseFilterFreq: 300,
        noiseFilterQ: 1,
        noiseGain: 0.02,
        rumbleFreq: 30,
        rumbleGain: 0.04,
        crackleRate: 0.8,
    },
    [ELEMENT_TYPES.AIR]: {
        // Wind + whispers
        noiseFilterFreq: 2000,
        noiseFilterQ: 0.3,
        noiseGain: 0.05,
        rumbleFreq: 120,
        rumbleGain: 0.01,
        crackleRate: 0.5,
    },
    [ELEMENT_TYPES.SHADOW]: {
        // Eerie tones + shadows
        noiseFilterFreq: 600,
        noiseFilterQ: 12,
        noiseGain: 0.03,
        rumbleFreq: 55,
        rumbleGain: 0.03,
        crackleRate: 1.0,
    },
    [ELEMENT_TYPES.LIGHT]: {
        // Chimes + light tones
        noiseFilterFreq: 4000,
        noiseFilterQ: 2,
        noiseGain: 0.02,
        rumbleFreq: 200,
        rumbleGain: 0.01,
        crackleRate: 1.8,
    },
};

const CROSSFADE_DURATION = 2.5; // seconds

export class MusicSystem {
    constructor(audioContext, masterGain) {
        this.ctx = audioContext;
        this.masterGain = masterGain;

        // Music gain nodes (for crossfade)
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.12;
        this.musicGain.connect(this.masterGain);

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.15;
        this.ambientGain.connect(this.masterGain);

        // State
        this.element = ELEMENT_TYPES.FIRE;
        this.state = 'exploration'; // 'exploration' | 'combat'
        this.targetState = 'exploration';
        this.stateBlend = 0; // 0 = exploration, 1 = combat

        // Active nodes for cleanup
        this.activeNodes = [];
        this.ambientNodes = [];

        // Sequencer
        this.beatTimer = 0;
        this.beatIndex = 0;
        this.melodyStep = 0;
        this.bassStep = 0;

        // Melody sequence (regenerated periodically)
        this.melodySequence = [];
        this.bassSequence = [];
        this._generateSequences();

        // Ambient crackle timer
        this.crackleTimer = 0;

        // Pause state
        this.paused = false;
        this.prePauseGain = 0.12;

        this._setupAmbientDrone();
        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Combat state tracking
        window.addEventListener('wave-start', () => {
            this.targetState = 'combat';
        });
        window.addEventListener('wave-complete', () => {
            this.targetState = 'exploration';
        });
        window.addEventListener('enemy-died', (e) => {
            if (e.detail?.type?.isBoss) {
                this.targetState = 'exploration';
            }
        });

        // Pause/resume
        window.addEventListener('game-paused', () => {
            this.paused = true;
            this.prePauseGain = this.musicGain.gain.value;
            this.musicGain.gain.linearRampToValueAtTime(
                this.prePauseGain * 0.3,
                this.ctx.currentTime + 0.5
            );
            this.ambientGain.gain.linearRampToValueAtTime(
                0.05,
                this.ctx.currentTime + 0.5
            );
        });
        window.addEventListener('game-resumed', () => {
            this.paused = false;
            this.musicGain.gain.linearRampToValueAtTime(
                this.prePauseGain,
                this.ctx.currentTime + 0.5
            );
            this.ambientGain.gain.linearRampToValueAtTime(
                0.15,
                this.ctx.currentTime + 0.5
            );
        });

        // Room change can shift element
        window.addEventListener('room-entered', (e) => {
            const cell = e.detail?.cell;
            if (cell && cell.element !== undefined && cell.element !== this.element) {
                this.setElement(cell.element);
            }
        });
    }

    /**
     * Set the current zone element — changes musical theme
     */
    setElement(element) {
        if (THEME_MUSIC[element] === undefined) return;
        this.element = element;
        this._generateSequences();
        this._restartAmbientDrone();
    }

    /**
     * Get the current theme config
     */
    _getTheme() {
        return THEME_MUSIC[this.element] || THEME_MUSIC[ELEMENT_TYPES.FIRE];
    }

    /**
     * Get the ambient config
     */
    _getAmbient() {
        return AMBIENT_DEFS[this.element] || AMBIENT_DEFS[ELEMENT_TYPES.FIRE];
    }

    /**
     * Generate random melody and bass sequences from the theme scale
     */
    _generateSequences() {
        const theme = this._getTheme();
        const scale = theme.scale;
        const len = 8;

        this.melodySequence = [];
        this.bassSequence = [];

        for (let i = 0; i < len; i++) {
            // Melody: pick from scale, sometimes rest (null)
            if (Math.random() < 0.3) {
                this.melodySequence.push(null); // rest
            } else {
                const degree = scale[Math.floor(Math.random() * scale.length)];
                this.melodySequence.push(degree);
            }

            // Bass: root-fifth alternation with occasional variation
            if (i % 2 === 0) {
                this.bassSequence.push(0); // root
            } else {
                this.bassSequence.push(Math.random() < 0.6 ? 7 : scale[Math.floor(Math.random() * scale.length)]);
            }
        }
    }

    /**
     * Convert semitone offset + octave to frequency
     */
    _noteFreq(root, semitone, octave) {
        return root * Math.pow(2, octave + semitone / 12);
    }

    /**
     * Play a single procedural note
     */
    _playNote(freq, type, duration, gain = 0.1, filterFreq = null) {
        if (!this.ctx || this.ctx.state === 'closed') return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = type;
        osc.frequency.value = freq;

        // ADSR envelope
        const attack = Math.min(0.05, duration * 0.1);
        const release = Math.min(0.2, duration * 0.4);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(gain, now + attack);
        gainNode.gain.setValueAtTime(gain, now + duration - release);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);

        if (filterFreq) {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = filterFreq;
            filter.Q.value = 1;
            osc.connect(filter);
            filter.connect(gainNode);
        } else {
            osc.connect(gainNode);
        }

        gainNode.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + duration + 0.01);

        // Track for cleanup
        const entry = { osc, gainNode, endTime: now + duration + 0.01 };
        this.activeNodes.push(entry);
    }

    /**
     * Play a pad chord (sustained, filtered)
     */
    _playPad(freq, duration) {
        const theme = this._getTheme();
        const now = this.ctx.currentTime;
        const filterFreq = theme.filterFreq + (theme.combatFilterFreq - theme.filterFreq) * this.stateBlend;

        // Two detuned oscillators for thickness
        for (const detune of [-5, 5]) {
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            osc.detune.value = detune;

            filter.type = 'lowpass';
            filter.frequency.value = filterFreq;
            filter.Q.value = theme.filterQ;

            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.04, now + duration * 0.3);
            gainNode.gain.setValueAtTime(0.04, now + duration * 0.7);
            gainNode.gain.linearRampToValueAtTime(0, now + duration);

            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.musicGain);

            osc.start(now);
            osc.stop(now + duration + 0.01);

            this.activeNodes.push({ osc, gainNode, endTime: now + duration + 0.01 });
        }
    }

    /**
     * Setup ambient drone layer (continuous noise + sub rumble)
     */
    _setupAmbientDrone() {
        const amb = this._getAmbient();

        // White noise through bandpass for texture
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.noiseSource = this.ctx.createBufferSource();
        this.noiseSource.buffer = buffer;
        this.noiseSource.loop = true;

        this.noiseFilter = this.ctx.createBiquadFilter();
        this.noiseFilter.type = 'bandpass';
        this.noiseFilter.frequency.value = amb.noiseFilterFreq;
        this.noiseFilter.Q.value = amb.noiseFilterQ;

        this.noiseGainNode = this.ctx.createGain();
        this.noiseGainNode.gain.value = amb.noiseGain;

        this.noiseSource.connect(this.noiseFilter);
        this.noiseFilter.connect(this.noiseGainNode);
        this.noiseGainNode.connect(this.ambientGain);
        this.noiseSource.start();

        // Sub rumble oscillator
        this.rumbleOsc = this.ctx.createOscillator();
        this.rumbleOsc.type = 'sine';
        this.rumbleOsc.frequency.value = amb.rumbleFreq;

        this.rumbleGainNode = this.ctx.createGain();
        this.rumbleGainNode.gain.value = amb.rumbleGain;

        this.rumbleOsc.connect(this.rumbleGainNode);
        this.rumbleGainNode.connect(this.ambientGain);
        this.rumbleOsc.start();

        this.ambientNodes = [this.noiseSource, this.rumbleOsc];
    }

    /**
     * Restart ambient drone when element changes
     */
    _restartAmbientDrone() {
        // Stop old ambient nodes
        for (const node of this.ambientNodes) {
            try { node.stop(); } catch (e) { /* already stopped */ }
        }
        this.ambientNodes = [];

        this._setupAmbientDrone();
    }

    /**
     * Play a short ambient crackle/drip sound (per-element character)
     */
    _playCrackle() {
        const amb = this._getAmbient();
        const now = this.ctx.currentTime;
        const duration = 0.05 + Math.random() * 0.1;

        // Short noise burst with element-specific filter
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = amb.noiseFilterFreq * (0.5 + Math.random());
        filter.Q.value = amb.noiseFilterQ * 2;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ambientGain);

        noise.start(now);
        noise.stop(now + duration);
    }

    /**
     * Main update — called each frame from game loop
     */
    update(delta) {
        if (!this.ctx || this.ctx.state === 'closed') return;

        // Crossfade state blend
        const targetBlend = this.targetState === 'combat' ? 1 : 0;
        const fadeSpeed = 1 / CROSSFADE_DURATION;
        if (this.stateBlend < targetBlend) {
            this.stateBlend = Math.min(targetBlend, this.stateBlend + fadeSpeed * delta);
        } else if (this.stateBlend > targetBlend) {
            this.stateBlend = Math.max(targetBlend, this.stateBlend - fadeSpeed * delta);
        }

        // Sequencer
        const theme = this._getTheme();
        const tempo = theme.tempo + (theme.combatTempo - theme.tempo) * this.stateBlend;

        this.beatTimer += delta;
        if (this.beatTimer >= tempo) {
            this.beatTimer -= tempo;
            this._onBeat(theme, tempo);
        }

        // Ambient crackle
        const amb = this._getAmbient();
        this.crackleTimer += delta;
        const crackleInterval = 1 / (amb.crackleRate * (1 + this.stateBlend * 0.5));
        if (this.crackleTimer >= crackleInterval) {
            this.crackleTimer -= crackleInterval;
            if (Math.random() < 0.7) {
                this._playCrackle();
            }
        }

        // Cleanup expired nodes
        const now = this.ctx.currentTime;
        this.activeNodes = this.activeNodes.filter(n => n.endTime > now);
    }

    /**
     * Sequencer beat tick
     */
    _onBeat(theme, tempo) {
        const seqLen = this.melodySequence.length;

        // Bass note every beat
        const bassSemitone = this.bassSequence[this.bassStep % seqLen];
        const bassFreq = this._noteFreq(theme.root, bassSemitone, theme.bassOctave);
        const bassGain = 0.06 + this.stateBlend * 0.04;
        this._playNote(bassFreq, theme.oscTypes[0], tempo * 0.8, bassGain, theme.filterFreq);
        this.bassStep++;

        // Melody note (may rest)
        const melodySemitone = this.melodySequence[this.melodyStep % seqLen];
        if (melodySemitone !== null) {
            const melodyFreq = this._noteFreq(theme.root, melodySemitone, theme.melodyOctave);
            const melodyGain = 0.05 + this.stateBlend * 0.03;
            this._playNote(melodyFreq, theme.oscTypes[1], tempo * 0.6, melodyGain);
        }
        this.melodyStep++;

        // Pad chord every 4 beats
        if (this.beatIndex % 4 === 0) {
            const padFreq = this._noteFreq(theme.root, 0, theme.padOctave);
            this._playPad(padFreq, tempo * 4);

            // Fifth above for thickness
            const fifthFreq = this._noteFreq(theme.root, 7, theme.padOctave);
            this._playPad(fifthFreq, tempo * 4);
        }

        // Combat: add rhythmic percussion hits
        if (this.stateBlend > 0.3) {
            const percGain = 0.03 * this.stateBlend;
            if (this.beatIndex % 2 === 0) {
                // Kick-like low hit
                this._playNote(theme.root * 0.5, 'sine', 0.08, percGain);
            }
            if (this.beatIndex % 4 === 2) {
                // Noise snap
                this._playPercNoise(0.05, percGain);
            }
        }

        this.beatIndex++;

        // Regenerate sequences periodically (every 32 beats)
        if (this.beatIndex % 32 === 0) {
            this._generateSequences();
        }
    }

    /**
     * Short noise hit for percussion
     */
    _playPercNoise(duration, gain) {
        const now = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(gain, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.musicGain);

        noise.start(now);
        noise.stop(now + duration);
    }

    /**
     * Set zone theme by music key (maps to element for themed music)
     * @param {string} musicKey - Zone music key from zone config (e.g. 'industrial', 'desert', 'tension')
     */
    setZoneTheme(musicKey) {
        const ZONE_MUSIC_MAP = {
            'industrial': ELEMENT_TYPES.SHADOW,
            'desert': ELEMENT_TYPES.FIRE,
            'tension': ELEMENT_TYPES.AIR,
        };
        const element = ZONE_MUSIC_MAP[musicKey];
        if (element !== undefined) {
            this.setElement(element);
        }
    }

    /**
     * Set music volume (0-1)
     */
    setMusicVolume(value) {
        this.musicGain.gain.linearRampToValueAtTime(
            Math.max(0, Math.min(0.2, value * 0.2)),
            this.ctx.currentTime + 0.1
        );
    }

    /**
     * Set ambient volume (0-1)
     */
    setAmbientVolume(value) {
        this.ambientGain.gain.linearRampToValueAtTime(
            Math.max(0, Math.min(0.2, value * 0.2)),
            this.ctx.currentTime + 0.1
        );
    }

    /**
     * Dispose all audio resources
     */
    dispose() {
        for (const node of this.activeNodes) {
            try { node.osc.stop(); } catch (e) { /* ok */ }
        }
        this.activeNodes = [];

        for (const node of this.ambientNodes) {
            try { node.stop(); } catch (e) { /* ok */ }
        }
        this.ambientNodes = [];
    }
}
