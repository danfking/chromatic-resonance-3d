// main-menu.js - Main menu, death screen, and victory screen for roguelike flow
// Listens to RunManager state changes (run-state-changed) to show/hide screens.

export class MainMenu {
    constructor(runManager) {
        this.runManager = runManager;
        this.container = null;
        this.runStats = { zonesReached: 0, enemiesKilled: 0, goldCollected: 0 };

        this.init();
    }

    init() {
        this.createStyles();
        this.createMenuScreen();
        this.createDeathScreen();
        this.createVictoryScreen();
        this.setupEventListeners();

        // Show menu immediately if RunManager is in MENU state
        if (this.runManager.getState() === 'MENU') {
            this.showMenu();
        }
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Shared screen styles */
            .main-menu-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 500;
                display: none;
                align-items: center;
                justify-content: center;
                font-family: 'Georgia', serif;
                color: #f5f0e6;
            }

            .main-menu-screen.visible {
                display: flex;
            }

            .main-menu-bg {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: radial-gradient(ellipse at 50% 40%, #1a1a2e 0%, #0a0a14 70%, #050508 100%);
            }

            .main-menu-panel {
                position: relative;
                text-align: center;
                max-width: 520px;
                width: 90%;
                animation: menuFadeIn 0.6s ease-out;
            }

            @keyframes menuFadeIn {
                from { opacity: 0; transform: translateY(-20px); }
                to   { opacity: 1; transform: translateY(0); }
            }

            /* Title */
            .menu-title {
                font-size: 52px;
                font-weight: bold;
                letter-spacing: 6px;
                color: #d4a574;
                text-shadow: 0 0 40px rgba(212, 165, 116, 0.4),
                             0 0 80px rgba(212, 165, 116, 0.15);
                margin-bottom: 8px;
                line-height: 1.1;
            }

            .menu-subtitle {
                font-size: 16px;
                font-style: italic;
                color: #8888aa;
                letter-spacing: 3px;
                margin-bottom: 40px;
            }

            /* Particle line decoration */
            .menu-particle-line {
                width: 200px;
                height: 2px;
                margin: 0 auto 36px;
                background: linear-gradient(90deg, transparent, rgba(212, 165, 116, 0.5), transparent);
            }

            /* Fragments indicator */
            .menu-fragments {
                font-size: 13px;
                color: #8888aa;
                letter-spacing: 1px;
                margin-bottom: 32px;
            }

            .menu-fragments .frag-count {
                color: #d4a574;
                font-weight: bold;
            }

            .frag-detail-row {
                display: flex;
                justify-content: center;
                gap: 16px;
                margin-top: 8px;
            }

            .frag-type {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
            }

            .frag-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
            }

            .frag-bonus {
                font-size: 11px;
                color: #aac574;
                margin-top: 6px;
                font-style: italic;
            }

            /* Fragment pickup notification */
            .fragment-pickup-toast {
                position: fixed;
                top: 30%;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 28px;
                border-radius: 8px;
                background: rgba(10, 10, 20, 0.85);
                border: 1px solid rgba(212, 165, 116, 0.5);
                color: #d4a574;
                font-family: 'Georgia', serif;
                font-size: 18px;
                font-weight: bold;
                letter-spacing: 2px;
                z-index: 600;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
                text-shadow: 0 0 12px rgba(212, 165, 116, 0.5);
            }

            .fragment-pickup-toast.show {
                opacity: 1;
            }

            /* Buttons */
            .menu-btn {
                display: block;
                width: 260px;
                margin: 0 auto 14px;
                padding: 16px 0;
                font-family: 'Georgia', serif;
                font-size: 20px;
                font-weight: bold;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: transform 0.15s, box-shadow 0.15s;
                letter-spacing: 1px;
            }

            .menu-btn:hover {
                transform: translateY(-2px);
            }

            .menu-btn:active {
                transform: translateY(0);
            }

            .menu-btn-primary {
                background: linear-gradient(135deg, #d4a574, #b8956a);
                color: #1a1a2e;
                box-shadow: 0 4px 24px rgba(212, 165, 116, 0.35);
            }

            .menu-btn-primary:hover {
                box-shadow: 0 6px 30px rgba(212, 165, 116, 0.55);
            }

            .menu-btn-secondary {
                background: rgba(80, 80, 100, 0.4);
                color: #c0bfcf;
                border: 1px solid rgba(212, 165, 116, 0.25);
            }

            .menu-btn-secondary:hover {
                background: rgba(80, 80, 100, 0.6);
            }

            /* Death screen */
            .death-title {
                font-size: 52px;
                color: #c44444;
                text-shadow: 0 0 40px rgba(196, 68, 68, 0.5);
                margin-bottom: 8px;
            }

            .death-subtitle {
                font-size: 16px;
                font-style: italic;
                color: #886666;
                margin-bottom: 30px;
            }

            /* Victory screen */
            .victory-title {
                font-size: 52px;
                color: #ddaa44;
                text-shadow: 0 0 40px rgba(221, 170, 68, 0.5);
                margin-bottom: 8px;
            }

            .victory-subtitle {
                font-size: 16px;
                font-style: italic;
                color: #aa9966;
                margin-bottom: 30px;
            }

            /* Stats grid (death + victory) */
            .run-stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 12px;
                margin-bottom: 28px;
            }

            .run-stat-item {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 8px;
                padding: 14px 8px;
                text-align: center;
            }

            .run-stat-value {
                font-size: 28px;
                font-weight: bold;
                color: #d4a574;
            }

            .run-stat-label {
                font-size: 11px;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-top: 4px;
            }

            /* Fragments earned row */
            .run-fragments-earned {
                font-size: 14px;
                color: #d4a574;
                margin-bottom: 24px;
                letter-spacing: 1px;
            }

            /* First-death meta hint */
            .death-meta-hint {
                font-size: 14px;
                font-style: italic;
                color: #aaa8c0;
                margin-bottom: 20px;
                letter-spacing: 0.5px;
                animation: metaHintGlow 2s ease-in-out infinite alternate;
            }

            @keyframes metaHintGlow {
                from { color: #aaa8c0; text-shadow: none; }
                to   { color: #d4a574; text-shadow: 0 0 12px rgba(212, 165, 116, 0.3); }
            }

            /* Settings panel */
            .menu-settings-panel {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #2a2a4a, #1a1a2e);
                border: 2px solid rgba(212, 165, 116, 0.5);
                border-radius: 12px;
                padding: 30px 40px;
                min-width: 360px;
                display: none;
                z-index: 10;
                animation: menuFadeIn 0.3s ease-out;
            }

            .menu-settings-panel.visible {
                display: block;
            }

            .settings-title {
                text-align: center;
                color: #d4a574;
                font-size: 24px;
                margin-bottom: 20px;
            }

            .settings-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 14px;
                padding: 6px 0;
            }

            .settings-row label {
                color: #f5f0e6;
                font-size: 15px;
            }

            .settings-row input[type="range"] {
                width: 140px;
                accent-color: #d4a574;
            }

            .settings-row input[type="checkbox"] {
                width: 18px;
                height: 18px;
                accent-color: #d4a574;
                cursor: pointer;
            }

            .settings-vol-value {
                width: 36px;
                text-align: right;
                color: #d4a574;
                font-family: monospace;
                font-size: 14px;
            }

            .settings-back-btn {
                display: block;
                width: 100%;
                margin-top: 18px;
                padding: 12px;
                background: rgba(80, 80, 100, 0.4);
                border: 1px solid rgba(212, 165, 116, 0.3);
                border-radius: 8px;
                color: #c0bfcf;
                font-family: 'Georgia', serif;
                font-size: 16px;
                cursor: pointer;
                transition: background 0.15s;
            }

            .settings-back-btn:hover {
                background: rgba(80, 80, 100, 0.6);
            }
        `;
        document.head.appendChild(style);
    }

    // --- Main Menu ---

    createMenuScreen() {
        const screen = document.createElement('div');
        screen.id = 'main-menu';
        screen.className = 'main-menu-screen';

        const fragments = this.runManager.getCoreFragments();
        const totalFragments = (fragments.vitality || 0) + (fragments.shell || 0) +
                               (fragments.spark || 0) + (fragments.essence || 0);

        screen.innerHTML = `
            <div class="main-menu-bg"></div>
            <div class="main-menu-panel">
                <h1 class="menu-title">CHROMATIC<br>RESONANCE</h1>
                <div class="menu-subtitle">A PARTICLE AWAKENS</div>
                <div class="menu-particle-line"></div>
                ${totalFragments > 0
                    ? `<div class="menu-fragments">Core Fragments: <span class="frag-count">${totalFragments}</span></div>`
                    : ''
                }
                <button class="menu-btn menu-btn-primary" id="menu-new-blob">New Blob</button>
                <button class="menu-btn menu-btn-secondary" id="menu-settings-btn">Settings</button>
            </div>

            <div class="menu-settings-panel" id="menu-settings">
                <h2 class="settings-title">Settings</h2>
                <div class="settings-row">
                    <label>Master Volume</label>
                    <input type="range" id="menu-volume" min="0" max="100" value="30">
                    <span class="settings-vol-value" id="menu-vol-value">30%</span>
                </div>
                <div class="settings-row">
                    <label>Show FPS</label>
                    <input type="checkbox" id="menu-show-fps" checked>
                </div>
                <button class="settings-back-btn" id="menu-settings-back">Back</button>
            </div>
        `;

        document.body.appendChild(screen);
        this.menuScreen = screen;
    }

    // --- Death Screen ---

    createDeathScreen() {
        const screen = document.createElement('div');
        screen.id = 'death-screen';
        screen.className = 'main-menu-screen';
        screen.innerHTML = `
            <div class="main-menu-bg"></div>
            <div class="main-menu-panel">
                <h1 class="death-title">YOU DISSOLVED</h1>
                <div class="death-subtitle">Your particles scattered into the void...</div>
                <div class="menu-particle-line"></div>

                <div class="run-stats-grid">
                    <div class="run-stat-item">
                        <div class="run-stat-value" id="death-zones">0</div>
                        <div class="run-stat-label">Zones</div>
                    </div>
                    <div class="run-stat-item">
                        <div class="run-stat-value" id="death-kills">0</div>
                        <div class="run-stat-label">Enemies</div>
                    </div>
                    <div class="run-stat-item">
                        <div class="run-stat-value" id="death-gold">0</div>
                        <div class="run-stat-label">Gold</div>
                    </div>
                </div>

                <div id="death-meta-hint"></div>

                <div class="run-fragments-earned" id="death-fragments"></div>

                <button class="menu-btn menu-btn-primary" id="death-try-again">Try Again</button>
            </div>
        `;

        document.body.appendChild(screen);
        this.deathScreen = screen;
    }

    // --- Victory Screen ---

    createVictoryScreen() {
        const screen = document.createElement('div');
        screen.id = 'victory-screen-rm';
        screen.className = 'main-menu-screen';
        screen.innerHTML = `
            <div class="main-menu-bg"></div>
            <div class="main-menu-panel">
                <h1 class="victory-title">ESCAPED</h1>
                <div class="victory-subtitle">Freedom. The particles are yours to command.</div>
                <div class="menu-particle-line"></div>

                <div class="run-stats-grid">
                    <div class="run-stat-item">
                        <div class="run-stat-value" id="vic-rm-zones">3</div>
                        <div class="run-stat-label">Zones</div>
                    </div>
                    <div class="run-stat-item">
                        <div class="run-stat-value" id="vic-rm-kills">0</div>
                        <div class="run-stat-label">Enemies</div>
                    </div>
                    <div class="run-stat-item">
                        <div class="run-stat-value" id="vic-rm-gold">0</div>
                        <div class="run-stat-label">Gold</div>
                    </div>
                </div>

                <div class="run-fragments-earned" id="vic-rm-fragments"></div>

                <button class="menu-btn menu-btn-primary" id="victory-new-run">New Run</button>
            </div>
        `;

        document.body.appendChild(screen);
        this.victoryScreen = screen;
    }

    // --- Event Listeners ---

    setupEventListeners() {
        // New Blob button
        document.getElementById('menu-new-blob').addEventListener('click', () => {
            this.hideMenu();
            window.dispatchEvent(new CustomEvent('start-run'));
        });

        // Settings
        document.getElementById('menu-settings-btn').addEventListener('click', () => {
            document.getElementById('menu-settings').classList.add('visible');
        });

        document.getElementById('menu-settings-back').addEventListener('click', () => {
            document.getElementById('menu-settings').classList.remove('visible');
        });

        // Volume slider
        const volumeSlider = document.getElementById('menu-volume');
        const volValue = document.getElementById('menu-vol-value');
        volumeSlider.addEventListener('input', (e) => {
            volValue.textContent = `${e.target.value}%`;
            window.dispatchEvent(new CustomEvent('volume-changed', {
                detail: { volume: e.target.value / 100 }
            }));
        });

        // FPS toggle
        document.getElementById('menu-show-fps').addEventListener('change', (e) => {
            const debugInfo = document.getElementById('debug-info');
            if (debugInfo) {
                debugInfo.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // Try Again (from death)
        document.getElementById('death-try-again').addEventListener('click', () => {
            this.hideAll();
            window.dispatchEvent(new CustomEvent('start-run'));
        });

        // New Run (from victory)
        document.getElementById('victory-new-run').addEventListener('click', () => {
            this.hideAll();
            window.dispatchEvent(new CustomEvent('start-run'));
        });

        // Listen for state changes from RunManager
        window.addEventListener('run-state-changed', (e) => {
            const { to } = e.detail;
            this.onStateChanged(to);
        });

        // Track run stats
        window.addEventListener('enemy-died', () => {
            this.runStats.enemiesKilled++;
        });

        window.addEventListener('gold-collected', (e) => {
            this.runStats.goldCollected += (e.detail?.amount || 0);
        });

        // Reset stats on new run
        window.addEventListener('run-reset', () => {
            this.runStats = { zonesReached: 0, enemiesKilled: 0, goldCollected: 0 };
        });

        // Fragment pickup notification (in-game toast)
        window.addEventListener('core-fragment-collected', (e) => {
            this._showPickupToast(e.detail.type);
        });
    }

    onStateChanged(newState) {
        // Hide everything first
        this.hideAll();

        switch (newState) {
            case 'MENU':
                this.showMenu();
                break;
            case 'DEAD':
                this.showDeathScreen();
                break;
            case 'VICTORY':
                this.showVictoryScreen();
                break;
            // PLAYING, ZONE_INTRO, SHOP: all screens hidden (handled above)
        }
    }

    // --- Show / Hide ---

    showMenu() {
        // Update fragments display
        const fragments = this.runManager.getCoreFragments();
        const totalFragments = (fragments.vitality || 0) + (fragments.shell || 0) +
                               (fragments.spark || 0) + (fragments.essence || 0);

        // Re-render fragments indicator in the panel
        const panel = this.menuScreen.querySelector('.main-menu-panel');
        const existingFrag = panel.querySelector('.menu-fragments');
        if (totalFragments > 0) {
            const html = this._buildFragmentsHTML(fragments, totalFragments);
            if (existingFrag) {
                existingFrag.innerHTML = html;
            } else {
                const fragDiv = document.createElement('div');
                fragDiv.className = 'menu-fragments';
                fragDiv.innerHTML = html;
                const line = panel.querySelector('.menu-particle-line');
                if (line) line.after(fragDiv);
            }
        } else if (existingFrag) {
            existingFrag.remove();
        }

        this.menuScreen.classList.add('visible');
        window.dispatchEvent(new CustomEvent('game-paused'));

        // Release pointer lock
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    hideMenu() {
        this.menuScreen.classList.remove('visible');
        // Close settings if open
        document.getElementById('menu-settings').classList.remove('visible');
        window.dispatchEvent(new CustomEvent('game-resumed'));
    }

    showDeathScreen() {
        // Update stats
        this.runStats.zonesReached = this.runManager.getZoneIndex() + 1;
        document.getElementById('death-zones').textContent = this.runStats.zonesReached;
        document.getElementById('death-kills').textContent = this.runStats.enemiesKilled;
        document.getElementById('death-gold').textContent = this.runStats.goldCollected;

        // First-death meta-progression hint
        const metaEl = document.getElementById('death-meta-hint');
        const hasSeenDeath = localStorage.getItem('cr3d-first-death');
        if (!hasSeenDeath) {
            localStorage.setItem('cr3d-first-death', '1');
            metaEl.className = 'death-meta-hint';
            metaEl.textContent = 'Core fragments persist between runs. Each death makes you stronger.';
        } else {
            metaEl.className = '';
            metaEl.textContent = '';
        }

        // Show fragments earned this run
        const fragEl = document.getElementById('death-fragments');
        const runFrags = this.runManager.getRunFragments();
        const runTotal = (runFrags.vitality || 0) + (runFrags.shell || 0) +
                         (runFrags.spark || 0) + (runFrags.essence || 0);
        if (runTotal > 0) {
            fragEl.innerHTML = this._buildRunFragmentsHTML(runFrags, runTotal);
        } else {
            fragEl.textContent = '';
        }

        this.deathScreen.classList.add('visible');
        window.dispatchEvent(new CustomEvent('game-paused'));

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    showVictoryScreen() {
        this.runStats.zonesReached = this.runManager.getZoneIndex() + 1;
        document.getElementById('vic-rm-zones').textContent = this.runStats.zonesReached;
        document.getElementById('vic-rm-kills').textContent = this.runStats.enemiesKilled;
        document.getElementById('vic-rm-gold').textContent = this.runStats.goldCollected;

        const fragEl = document.getElementById('vic-rm-fragments');
        const runFrags = this.runManager.getRunFragments();
        const runTotal = (runFrags.vitality || 0) + (runFrags.shell || 0) +
                         (runFrags.spark || 0) + (runFrags.essence || 0);
        if (runTotal > 0) {
            fragEl.innerHTML = this._buildRunFragmentsHTML(runFrags, runTotal);
        } else {
            fragEl.textContent = '';
        }

        this.victoryScreen.classList.add('visible');
        window.dispatchEvent(new CustomEvent('game-paused'));

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    hideAll() {
        this.menuScreen.classList.remove('visible');
        this.deathScreen.classList.remove('visible');
        this.victoryScreen.classList.remove('visible');
        document.getElementById('menu-settings').classList.remove('visible');
        window.dispatchEvent(new CustomEvent('game-resumed'));
    }

    // --- Fragment display helpers ---

    _getFragColors() {
        return {
            vitality: '#ff3333',
            shell: '#999999',
            spark: '#ffaa00',
            essence: '#4488ff',
        };
    }

    _buildFragmentsHTML(fragments, totalFragments) {
        const colors = this._getFragColors();
        let detailDots = '';
        for (const [type, count] of Object.entries(fragments)) {
            if (count > 0) {
                detailDots += `<span class="frag-type"><span class="frag-dot" style="background:${colors[type] || '#fff'}"></span>${count}</span>`;
            }
        }

        // Show active bonuses
        const bonuses = [];
        if ((fragments.vitality || 0) >= 3) bonuses.push('+2 Vitality capacity');
        if ((fragments.spark || 0) >= 3) bonuses.push('Spark starts at Lv.2');
        if (totalFragments >= 5) bonuses.push('+1 Augment slot');

        return `Core Fragments: <span class="frag-count">${totalFragments}</span>` +
            `<div class="frag-detail-row">${detailDots}</div>` +
            (bonuses.length > 0 ? `<div class="frag-bonus">${bonuses.join(' / ')}</div>` : '');
    }

    _buildRunFragmentsHTML(runFrags, runTotal) {
        const colors = this._getFragColors();
        let dots = '';
        for (const [type, count] of Object.entries(runFrags)) {
            if (count > 0) {
                dots += `<span class="frag-type"><span class="frag-dot" style="background:${colors[type] || '#fff'}"></span>${count}</span>`;
            }
        }
        return `Fragments Earned: <span class="frag-count">${runTotal}</span>` +
            `<div class="frag-detail-row">${dots}</div>`;
    }

    // --- Fragment pickup toast ---

    _createPickupToast() {
        const toast = document.createElement('div');
        toast.className = 'fragment-pickup-toast';
        toast.id = 'fragment-pickup-toast';
        document.body.appendChild(toast);
        this._pickupToast = toast;
        this._pickupTimeout = null;
    }

    _showPickupToast(type) {
        if (!this._pickupToast) this._createPickupToast();
        const colors = this._getFragColors();
        const color = colors[type] || '#d4a574';
        const name = type.charAt(0).toUpperCase() + type.slice(1);

        this._pickupToast.innerHTML = `<span style="color:${color}">Fragment Absorbed</span> <span style="font-size:14px; color:#8888aa;">${name}</span>`;
        this._pickupToast.classList.add('show');

        if (this._pickupTimeout) clearTimeout(this._pickupTimeout);
        this._pickupTimeout = setTimeout(() => {
            this._pickupToast.classList.remove('show');
            this._pickupTimeout = null;
        }, 2000);
    }
}
