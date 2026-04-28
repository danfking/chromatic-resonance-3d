// hint-system.js - Lightweight contextual hint toasts for onboarding
// Shows brief gameplay hints triggered by events. Each hint shown once per run.

export class HintSystem {
    constructor() {
        this._container = this._createContainer();
        this._shown = new Set();
        this._activeHint = null;
        this._hideTimer = null;
        this._setupListeners();
    }

    _createContainer() {
        const el = document.createElement('div');
        el.id = 'hint-toast';
        el.style.cssText = `
            position: fixed;
            bottom: 18%;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 28px;
            border-radius: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: #f0ece0;
            font-family: 'Georgia', serif;
            font-size: 16px;
            letter-spacing: 1px;
            z-index: 450;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            text-align: center;
            white-space: nowrap;
        `;
        document.body.appendChild(el);
        return el;
    }

    _setupListeners() {
        // WASD hint on entering PLAYING state
        window.addEventListener('run-state-changed', (e) => {
            const { to } = e.detail;
            if (to === 'PLAYING') {
                // Reset hints each run so returning players see them again
                this._shown.clear();
                setTimeout(() => this._showHint('move', 'WASD to move'), 2000);
            }
        });

        // E to interact when near Keeper NPC
        window.addEventListener('npc-dialogue-open', () => {
            // Hint was useful — don't need to show it anymore
        });

        // First enemy kill
        window.addEventListener('enemy-died', () => {
            setTimeout(() => this._showHint('kill', 'Enemies drop gold'), 1000);
        });

        // Gold collected — pulse the counter (no text hint)
        window.addEventListener('gold-collected', () => {
            this._shown.add('gold');
        });
    }

    /**
     * Check proximity-based hints per frame.
     * Call from main.js update loop.
     * @param {THREE.Vector3} playerPos - Player world position
     * @param {object} context - { npcSystem, vehicleMesh }
     */
    updateProximity(playerPos, context) {
        if (!playerPos) return;

        // E to interact when near NPC
        if (context.npcSystem && context.npcSystem.hasNearbyNPC()) {
            this._showHint('interact', 'Press E to interact');
        }

        // F to enter vehicle
        if (context.vehicleMesh) {
            const dist = playerPos.distanceTo(context.vehicleMesh.position);
            if (dist < 5.0) {
                this._showHint('vehicle', 'Press F to enter vehicle');
            }
        }
    }

    _showHint(key, text) {
        if (this._shown.has(key)) return;
        this._shown.add(key);

        this._container.textContent = text;
        this._container.style.opacity = '1';

        clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => {
            this._container.style.opacity = '0';
        }, 3000);
    }

    dispose() {
        clearTimeout(this._hideTimer);
        if (this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
    }
}
