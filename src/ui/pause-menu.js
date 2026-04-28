// pause-menu.js - Pause menu with settings

export class PauseMenu {
    constructor(audioSystem) {
        this.audioSystem = audioSystem;
        this.isPaused = false;
        this.container = null;

        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'pause-menu';
        container.innerHTML = `
            <div class="pause-overlay"></div>
            <div class="pause-panel">
                <h1 class="pause-title">PAUSED</h1>

                <div class="pause-section">
                    <h2>Settings</h2>

                    <div class="setting-row">
                        <label>Master Volume</label>
                        <input type="range" id="volume-slider" min="0" max="100" value="30">
                        <span class="volume-value">30%</span>
                    </div>

                    <div class="setting-row">
                        <label>Show FPS</label>
                        <input type="checkbox" id="show-fps" checked>
                    </div>

                    <div class="setting-row">
                        <label>Show Minimap</label>
                        <input type="checkbox" id="show-minimap" checked>
                    </div>
                </div>

                <div class="pause-section controls-section">
                    <h2>Controls</h2>
                    <div class="controls-list">
                        <div class="control-item"><span class="key">WASD</span> Move</div>
                        <div class="control-item"><span class="key">Mouse</span> Look</div>
                        <div class="control-item"><span class="key">Space</span> Jump</div>
                        <div class="control-item"><span class="key">Click</span> Extract Color</div>
                        <div class="control-item"><span class="key">1-5</span> Abilities</div>
                        <div class="control-item"><span class="key">ESC</span> Pause</div>
                    </div>
                </div>

                <button class="resume-btn">Resume</button>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #pause-menu {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1000;
                display: none;
            }

            #pause-menu.visible {
                display: block;
            }

            .pause-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(26, 26, 46, 0.85);
                backdrop-filter: blur(4px);
            }

            .pause-panel {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #2a2a4a, #1a1a2e);
                border: 2px solid rgba(212, 165, 116, 0.6);
                border-radius: 12px;
                padding: 30px 40px;
                min-width: 400px;
                color: #f5f0e6;
                font-family: 'Georgia', serif;
            }

            .pause-title {
                text-align: center;
                color: #d4a574;
                font-size: 36px;
                margin-bottom: 25px;
                text-shadow: 0 0 20px rgba(212, 165, 116, 0.5);
            }

            .pause-section {
                margin-bottom: 25px;
            }

            .pause-section h2 {
                color: #aaa;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 15px;
                padding-bottom: 5px;
                border-bottom: 1px solid rgba(212, 165, 116, 0.3);
            }

            .setting-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
                padding: 8px 0;
            }

            .setting-row label {
                color: #f5f0e6;
                font-size: 16px;
            }

            .setting-row input[type="range"] {
                width: 150px;
                margin: 0 15px;
                accent-color: #d4a574;
            }

            .setting-row input[type="checkbox"] {
                width: 20px;
                height: 20px;
                accent-color: #d4a574;
                cursor: pointer;
            }

            .volume-value {
                width: 40px;
                text-align: right;
                color: #d4a574;
                font-family: monospace;
            }

            .controls-list {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
            }

            .control-item {
                font-size: 14px;
                color: #ccc;
            }

            .control-item .key {
                display: inline-block;
                background: rgba(212, 165, 116, 0.2);
                border: 1px solid rgba(212, 165, 116, 0.4);
                border-radius: 4px;
                padding: 2px 8px;
                margin-right: 8px;
                font-family: monospace;
                color: #d4a574;
            }

            .resume-btn {
                display: block;
                width: 100%;
                padding: 15px;
                margin-top: 20px;
                background: linear-gradient(135deg, #d4a574, #b8956a);
                border: none;
                border-radius: 8px;
                color: #1a1a2e;
                font-size: 18px;
                font-family: 'Georgia', serif;
                font-weight: bold;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .resume-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 20px rgba(212, 165, 116, 0.4);
            }

            .resume-btn:active {
                transform: translateY(0);
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(container);
        this.container = container;

        // Store references
        this.volumeSlider = document.getElementById('volume-slider');
        this.volumeValue = document.querySelector('.volume-value');
        this.showFpsCheckbox = document.getElementById('show-fps');
        this.showMinimapCheckbox = document.getElementById('show-minimap');
        this.resumeBtn = document.querySelector('.resume-btn');
    }

    setupEventListeners() {
        // ESC to toggle pause
        // Note: main.js handles ESC when spell menu is open (closes spell menu first)
        // This handler only activates when spell menu is NOT open
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Check if spell menu is open - if so, let main.js handle it
                const spellMenu = document.getElementById('spell-menu');
                if (spellMenu && spellMenu.classList.contains('visible')) {
                    return; // Let main.js handle closing the spell menu
                }

                // Only toggle pause if not in pointer lock (game is playing)
                // or if already paused
                if (this.isPaused || !document.pointerLockElement) {
                    this.toggle();
                }
            }
        });

        // Resume button
        this.resumeBtn.addEventListener('click', () => {
            this.hide();
        });

        // Volume slider
        this.volumeSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            this.volumeValue.textContent = `${value}%`;
            if (this.audioSystem) {
                this.audioSystem.setVolume(value / 100);
            }
        });

        // FPS toggle
        this.showFpsCheckbox.addEventListener('change', (e) => {
            const debugInfo = document.getElementById('debug-info');
            if (debugInfo) {
                debugInfo.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // Minimap toggle
        this.showMinimapCheckbox.addEventListener('change', (e) => {
            const minimap = document.getElementById('minimap');
            if (minimap) {
                minimap.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // Click overlay to close
        this.container.querySelector('.pause-overlay').addEventListener('click', () => {
            this.hide();
        });
    }

    toggle() {
        if (this.isPaused) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        this.isPaused = true;
        this.container.classList.add('visible');

        // Dispatch pause event
        window.dispatchEvent(new CustomEvent('game-paused'));
    }

    hide() {
        this.isPaused = false;
        this.container.classList.remove('visible');

        // Dispatch resume event
        window.dispatchEvent(new CustomEvent('game-resumed'));
    }

    isGamePaused() {
        return this.isPaused;
    }
}
