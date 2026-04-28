// run-manager.js - Game state machine for roguelike run flow
// Controls: MENU -> ZONE_INTRO -> PLAYING -> SHOP -> DEAD -> VICTORY

const RUN_STATES = {
    MENU: 'MENU',
    ZONE_INTRO: 'ZONE_INTRO',
    PLAYING: 'PLAYING',
    SHOP: 'SHOP',
    DEAD: 'DEAD',
    VICTORY: 'VICTORY',
};

// Valid state transitions
const VALID_TRANSITIONS = {
    [RUN_STATES.MENU]:       [RUN_STATES.ZONE_INTRO],
    [RUN_STATES.ZONE_INTRO]: [RUN_STATES.PLAYING],
    [RUN_STATES.PLAYING]:    [RUN_STATES.SHOP, RUN_STATES.DEAD, RUN_STATES.VICTORY],
    [RUN_STATES.SHOP]:       [RUN_STATES.ZONE_INTRO],
    [RUN_STATES.DEAD]:       [RUN_STATES.MENU],
    [RUN_STATES.VICTORY]:    [RUN_STATES.MENU],
};

// Alpha has 3 zones (0-2): Facility Ruins, Desert Scrapyard, Rural Town
const ALPHA_ZONE_COUNT = 3;

class RunManager {
    constructor() {
        this.state = RUN_STATES.MENU;
        this.zoneIndex = 0;
        this.seed = 0;
        this.coreFragments = this._loadFragments();
        this.runFragments = { vitality: 0, shell: 0, spark: 0, essence: 0 };

        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Collect core fragments dispatched by CoreSystem
        window.addEventListener('core-fragment-collected', (e) => {
            const { type, count } = e.detail;
            this.addCoreFragments(type, count);
            // Track per-run gains
            if (!this.runFragments[type]) this.runFragments[type] = 0;
            this.runFragments[type] += count;
        });
    }

    /**
     * Get the current run state
     */
    getState() {
        return this.state;
    }

    /**
     * Get the current zone index (0-based)
     */
    getZoneIndex() {
        return this.zoneIndex;
    }

    /**
     * Get the run seed
     */
    getSeed() {
        return this.seed;
    }

    /**
     * Get persisted core fragments
     */
    getCoreFragments() {
        return this.coreFragments;
    }

    /**
     * Get fragments collected during the current run
     */
    getRunFragments() {
        return this.runFragments;
    }

    /**
     * Start a new roguelike run. Resets all run state, generates seed,
     * transitions to ZONE_INTRO for zone 0.
     * @param {number} [seed] - Optional fixed seed for deterministic runs
     */
    startNewRun(seed) {
        // Allow starting a new run from terminal states (DEAD, VICTORY) by going through MENU first
        if (this.state === RUN_STATES.DEAD || this.state === RUN_STATES.VICTORY) {
            this._transition(RUN_STATES.MENU);
        }

        this.seed = seed ?? Math.floor(Math.random() * 2147483647);
        this.zoneIndex = 0;
        this.runFragments = { vitality: 0, shell: 0, spark: 0, essence: 0 };

        console.log(`[RunManager] New run started. Seed: ${this.seed}, Fragments: ${JSON.stringify(this.coreFragments)}`);

        // Dispatch reset event so other systems can clear their state
        window.dispatchEvent(new CustomEvent('run-reset', {
            detail: { seed: this.seed, fragments: this.coreFragments }
        }));

        this._transition(RUN_STATES.ZONE_INTRO);
    }

    /**
     * Enter a zone. Transitions from ZONE_INTRO to PLAYING.
     * Called after zone loading is complete.
     * @param {number} zoneIndex - Zone to enter (0-2 for alpha)
     */
    enterZone(zoneIndex) {
        if (zoneIndex !== undefined) {
            this.zoneIndex = zoneIndex;
        }
        this._transition(RUN_STATES.PLAYING);
    }

    /**
     * Exit the current zone. Transitions to SHOP (between zones)
     * or VICTORY if this was the final zone.
     */
    exitZone() {
        if (this.zoneIndex >= ALPHA_ZONE_COUNT - 1) {
            // Last zone completed — victory
            this.win();
        } else {
            this._transition(RUN_STATES.SHOP);
        }
    }

    /**
     * Player died. Save core fragments and transition to DEAD.
     */
    die() {
        this._saveFragments();
        console.log(`[RunManager] Player died in zone ${this.zoneIndex}. Fragments saved.`);
        this._transition(RUN_STATES.DEAD);
    }

    /**
     * Player won the run. Save core fragments and transition to VICTORY.
     */
    win() {
        this._saveFragments();
        console.log(`[RunManager] Victory! Run complete. Fragments saved.`);
        this._transition(RUN_STATES.VICTORY);
    }

    /**
     * Continue to next zone from shop. Increments zone index and enters ZONE_INTRO.
     */
    continueFromShop() {
        this.zoneIndex++;
        console.log(`[RunManager] Continuing to zone ${this.zoneIndex}`);
        this._transition(RUN_STATES.ZONE_INTRO);
    }

    /**
     * Return to main menu from DEAD or VICTORY screens.
     */
    returnToMenu() {
        this._transition(RUN_STATES.MENU);
    }

    /**
     * Add core fragments (meta-progression currency)
     * @param {string} type - Fragment type: 'vitality', 'shell', 'spark', 'essence'
     * @param {number} count - Number of fragments to add
     */
    addCoreFragments(type, count) {
        if (!this.coreFragments[type]) {
            this.coreFragments[type] = 0;
        }
        this.coreFragments[type] += count;
        console.log(`[RunManager] +${count} ${type} fragment(s). Total: ${this.coreFragments[type]}`);
    }

    // --- Private methods ---

    /**
     * Transition to a new state with validation and event dispatch.
     */
    _transition(newState) {
        const from = this.state;

        // Validate transition
        const allowed = VALID_TRANSITIONS[from];
        if (!allowed || !allowed.includes(newState)) {
            console.warn(`[RunManager] Invalid transition: ${from} -> ${newState}`);
            return;
        }

        this.state = newState;

        console.log(`[RunManager] ${from} -> ${newState} (zone ${this.zoneIndex})`);

        window.dispatchEvent(new CustomEvent('run-state-changed', {
            detail: { from, to: newState, zoneIndex: this.zoneIndex, seed: this.seed }
        }));
    }

    /**
     * Load core fragments from localStorage (meta-progression persistence).
     */
    _loadFragments() {
        try {
            const stored = localStorage.getItem('chromatic-resonance-fragments');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('[RunManager] Failed to load fragments:', e);
        }
        return { vitality: 0, shell: 0, spark: 0, essence: 0 };
    }

    /**
     * Save core fragments to localStorage.
     */
    _saveFragments() {
        try {
            localStorage.setItem('chromatic-resonance-fragments', JSON.stringify(this.coreFragments));
        } catch (e) {
            console.warn('[RunManager] Failed to save fragments:', e);
        }
    }
}

export { RunManager, RUN_STATES, ALPHA_ZONE_COUNT };
