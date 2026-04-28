// tutorial.js - First-time player tutorial overlay

export class TutorialOverlay {
    constructor() {
        this.currentStep = 0;
        this.hasSeenTutorial = localStorage.getItem('cr3d-tutorial-seen') === 'true';
        this.container = null;

        if (!this.hasSeenTutorial) {
            this.init();
        }
    }

    init() {
        this.createUI();
        this.show();
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'tutorial-overlay';
        container.innerHTML = `
            <div class="tutorial-backdrop"></div>
            <div class="tutorial-panel">
                <div class="tutorial-header">
                    <span class="tutorial-icon">📖</span>
                    <h1>Welcome to Chromatic Resonance</h1>
                </div>

                <div class="tutorial-content">
                    <div class="tutorial-section">
                        <h2>🎨 The Color System</h2>
                        <p>Extract colors from glowing objects in the world to power your abilities.
                        Each color has unique properties - Crimson for damage, Azure for defense,
                        Verdant for healing, and more.</p>
                    </div>

                    <div class="tutorial-section">
                        <h2>⚔️ Combat</h2>
                        <p>Enemies spawn in waves. Defeat them to earn XP, level up, and collect
                        color drops. Survive 10 waves to achieve victory!</p>
                    </div>

                    <div class="tutorial-section controls-grid">
                        <h2>🎮 Controls</h2>
                        <div class="control-row">
                            <span class="key-badge">WASD</span>
                            <span>Move</span>
                        </div>
                        <div class="control-row">
                            <span class="key-badge">Mouse</span>
                            <span>Look Around</span>
                        </div>
                        <div class="control-row">
                            <span class="key-badge">Click</span>
                            <span>Extract Color</span>
                        </div>
                        <div class="control-row">
                            <span class="key-badge">1-5</span>
                            <span>Use Abilities</span>
                        </div>
                        <div class="control-row">
                            <span class="key-badge">ESC</span>
                            <span>Pause Menu</span>
                        </div>
                    </div>
                </div>

                <div class="tutorial-footer">
                    <label class="dont-show-again">
                        <input type="checkbox" id="tutorial-dont-show">
                        Don't show this again
                    </label>
                    <button class="tutorial-start-btn">Begin Adventure</button>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #tutorial-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 3000;
                display: none;
                align-items: center;
                justify-content: center;
            }

            #tutorial-overlay.visible {
                display: flex;
            }

            .tutorial-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: radial-gradient(ellipse at center,
                    rgba(26, 26, 46, 0.95) 0%,
                    rgba(10, 10, 20, 0.98) 100%);
            }

            .tutorial-panel {
                position: relative;
                background: linear-gradient(135deg, #2a2a4a 0%, #1a1a2e 100%);
                border: 2px solid rgba(212, 165, 116, 0.6);
                border-radius: 16px;
                padding: 30px 40px;
                max-width: 600px;
                color: #f5f0e6;
                animation: tutorialFadeIn 0.5s ease-out;
                box-shadow: 0 0 60px rgba(212, 165, 116, 0.2);
            }

            @keyframes tutorialFadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            .tutorial-header {
                text-align: center;
                margin-bottom: 25px;
            }

            .tutorial-icon {
                font-size: 40px;
                display: block;
                margin-bottom: 10px;
            }

            .tutorial-header h1 {
                font-family: 'Georgia', serif;
                font-size: 28px;
                color: #d4a574;
                margin: 0;
                text-shadow: 0 0 20px rgba(212, 165, 116, 0.5);
            }

            .tutorial-content {
                margin-bottom: 25px;
            }

            .tutorial-section {
                margin-bottom: 20px;
                padding: 15px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
                border-left: 3px solid rgba(212, 165, 116, 0.5);
            }

            .tutorial-section h2 {
                font-family: 'Georgia', serif;
                font-size: 16px;
                color: #d4a574;
                margin: 0 0 10px 0;
            }

            .tutorial-section p {
                font-size: 14px;
                line-height: 1.6;
                color: #ccc;
                margin: 0;
            }

            .controls-grid {
                display: block;
            }

            .control-row {
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 8px 0;
                border-bottom: 1px solid rgba(100, 100, 120, 0.3);
            }

            .control-row:last-child {
                border-bottom: none;
            }

            .key-badge {
                background: rgba(212, 165, 116, 0.2);
                border: 1px solid rgba(212, 165, 116, 0.5);
                border-radius: 4px;
                padding: 4px 12px;
                font-family: monospace;
                font-size: 13px;
                color: #d4a574;
                min-width: 60px;
                text-align: center;
            }

            .tutorial-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-top: 15px;
                border-top: 1px solid rgba(212, 165, 116, 0.3);
            }

            .dont-show-again {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #888;
                font-size: 13px;
                cursor: pointer;
            }

            .dont-show-again input {
                accent-color: #d4a574;
                cursor: pointer;
            }

            .tutorial-start-btn {
                padding: 12px 30px;
                background: linear-gradient(135deg, #d4a574, #b8956a);
                border: none;
                border-radius: 8px;
                color: #1a1a2e;
                font-size: 16px;
                font-family: 'Georgia', serif;
                font-weight: bold;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .tutorial-start-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 20px rgba(212, 165, 116, 0.5);
            }

            .tutorial-start-btn:active {
                transform: translateY(0);
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(container);
        this.container = container;

        // Event listeners
        container.querySelector('.tutorial-start-btn').addEventListener('click', () => {
            this.hide();
        });

        container.querySelector('#tutorial-dont-show').addEventListener('change', (e) => {
            if (e.target.checked) {
                localStorage.setItem('cr3d-tutorial-seen', 'true');
            } else {
                localStorage.removeItem('cr3d-tutorial-seen');
            }
        });
    }

    show() {
        if (this.container) {
            this.container.classList.add('visible');
        }
    }

    hide() {
        if (this.container) {
            this.container.classList.remove('visible');
        }
    }
}
