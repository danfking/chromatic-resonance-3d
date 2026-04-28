// game-state.js - Game over and victory screens with stats

export class GameStateUI {
    constructor() {
        this.finalWave = 0;
        this.finalScore = 0;
        this.finalLevel = 1;
        this.enemiesDefeated = 0;
        this.colorsExtracted = 0;
        this.victoryWave = 10; // Win after completing wave 10

        this.init();
        this.setupEventListeners();
    }

    init() {
        this.createStyles();
        this.createGameOverScreen();
        this.createVictoryScreen();
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .game-end-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 2000;
                display: none;
                align-items: center;
                justify-content: center;
            }

            .game-end-screen.visible {
                display: flex;
            }

            .game-end-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(10, 10, 20, 0.9);
            }

            .game-end-panel {
                position: relative;
                background: linear-gradient(135deg, #2a2a4a, #1a1a2e);
                border: 3px solid rgba(212, 165, 116, 0.6);
                border-radius: 16px;
                padding: 40px 60px;
                text-align: center;
                max-width: 500px;
                animation: panelSlide 0.5s ease-out;
            }

            @keyframes panelSlide {
                from {
                    opacity: 0;
                    transform: translateY(-30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .game-end-title {
                font-family: 'Georgia', serif;
                font-size: 48px;
                margin-bottom: 10px;
                text-shadow: 0 0 30px currentColor;
            }

            .game-over-title {
                color: #c44444;
            }

            .victory-title {
                color: #ddaa44;
            }

            .game-end-subtitle {
                color: #aaa;
                font-size: 18px;
                font-family: 'Georgia', serif;
                font-style: italic;
                margin-bottom: 30px;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin-bottom: 30px;
            }

            .stat-item {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 8px;
                padding: 15px;
                text-align: center;
            }

            .stat-value {
                font-size: 32px;
                font-weight: bold;
                color: #d4a574;
                font-family: 'Georgia', serif;
            }

            .stat-label {
                font-size: 12px;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-top: 5px;
            }

            .game-end-buttons {
                display: flex;
                gap: 15px;
                justify-content: center;
            }

            .game-end-btn {
                padding: 15px 30px;
                font-size: 18px;
                font-family: 'Georgia', serif;
                font-weight: bold;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .game-end-btn:hover {
                transform: translateY(-2px);
            }

            .btn-primary {
                background: linear-gradient(135deg, #d4a574, #b8956a);
                color: #1a1a2e;
                box-shadow: 0 4px 20px rgba(212, 165, 116, 0.4);
            }

            .btn-primary:hover {
                box-shadow: 0 6px 25px rgba(212, 165, 116, 0.6);
            }

            .btn-secondary {
                background: rgba(100, 100, 120, 0.5);
                color: #f5f0e6;
                border: 1px solid rgba(212, 165, 116, 0.3);
            }

            .btn-secondary:hover {
                background: rgba(100, 100, 120, 0.7);
            }

            .victory-banner {
                color: #ddaa44;
                font-size: 24px;
                font-family: 'Georgia', serif;
                margin-bottom: 20px;
                text-shadow: 0 0 20px rgba(221, 170, 68, 0.5);
            }
        `;
        document.head.appendChild(style);
    }

    createGameOverScreen() {
        const screen = document.createElement('div');
        screen.id = 'game-over-screen';
        screen.className = 'game-end-screen';
        screen.innerHTML = `
            <div class="game-end-overlay"></div>
            <div class="game-end-panel">
                <h1 class="game-end-title game-over-title">YOU DIED</h1>
                <p class="game-end-subtitle">Your colors have faded into darkness...</p>

                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value" id="go-wave">1</div>
                        <div class="stat-label">Wave Reached</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="go-score">0</div>
                        <div class="stat-label">Final Score</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="go-level">1</div>
                        <div class="stat-label">Level</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="go-enemies">0</div>
                        <div class="stat-label">Enemies Defeated</div>
                    </div>
                </div>

                <div class="game-end-buttons">
                    <button class="game-end-btn btn-primary" onclick="location.reload()">Try Again</button>
                </div>
            </div>
        `;
        document.body.appendChild(screen);
        this.gameOverScreen = screen;
    }

    createVictoryScreen() {
        const screen = document.createElement('div');
        screen.id = 'victory-screen';
        screen.className = 'game-end-screen';
        screen.innerHTML = `
            <div class="game-end-overlay"></div>
            <div class="game-end-panel">
                <h1 class="game-end-title victory-title">VICTORY!</h1>
                <p class="game-end-subtitle">The chromatic balance has been restored.</p>

                <div class="victory-banner">🎨 All Waves Completed! 🎨</div>

                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value" id="vic-score">0</div>
                        <div class="stat-label">Final Score</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="vic-level">1</div>
                        <div class="stat-label">Final Level</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="vic-enemies">0</div>
                        <div class="stat-label">Enemies Defeated</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="vic-colors">0</div>
                        <div class="stat-label">Colors Extracted</div>
                    </div>
                </div>

                <div class="game-end-buttons">
                    <button class="game-end-btn btn-primary" onclick="location.reload()">Play Again</button>
                </div>
            </div>
        `;
        document.body.appendChild(screen);
        this.victoryScreen = screen;
    }

    setupEventListeners() {
        // Track enemies defeated
        window.addEventListener('enemy-died', () => {
            this.enemiesDefeated++;
        });

        // Track colors extracted
        window.addEventListener('color-extracted', () => {
            this.colorsExtracted++;
        });

        // Listen for wave completion to check victory
        window.addEventListener('wave-complete', (e) => {
            const { wave, score } = e.detail;
            this.finalWave = wave;
            this.finalScore = score;

            // Check for victory condition
            if (wave >= this.victoryWave) {
                setTimeout(() => this.showVictory(), 2500);
            }
        });

        // Listen for level up
        window.addEventListener('level-up', (e) => {
            this.finalLevel = e.detail.level;
        });

        // Override the default game over
        window.addEventListener('player-died', () => {
            this.showGameOver();
        });
    }

    showGameOver() {
        // Get current stats from game systems
        this.updateStatsFromGame();

        // Update game over screen
        document.getElementById('go-wave').textContent = this.finalWave;
        document.getElementById('go-score').textContent = this.finalScore;
        document.getElementById('go-level').textContent = this.finalLevel;
        document.getElementById('go-enemies').textContent = this.enemiesDefeated;

        // Hide old game over screen if exists
        const oldScreen = document.getElementById('game-over');
        if (oldScreen) {
            oldScreen.style.display = 'none';
        }

        // Show new game over screen
        this.gameOverScreen.classList.add('visible');

        // Release pointer lock
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    showVictory() {
        this.updateStatsFromGame();

        // Update victory screen
        document.getElementById('vic-score').textContent = this.finalScore;
        document.getElementById('vic-level').textContent = this.finalLevel;
        document.getElementById('vic-enemies').textContent = this.enemiesDefeated;
        document.getElementById('vic-colors').textContent = this.colorsExtracted;

        // Show victory screen
        this.victoryScreen.classList.add('visible');

        // Play victory sound
        window.dispatchEvent(new CustomEvent('play-victory-sound'));

        // Release pointer lock
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    updateStatsFromGame() {
        // Try to get wave/score from UI elements if not tracked
        const waveEl = document.getElementById('wave');
        const scoreEl = document.getElementById('score');

        if (waveEl && !this.finalWave) {
            this.finalWave = parseInt(waveEl.textContent) || 1;
        }
        if (scoreEl && !this.finalScore) {
            this.finalScore = parseInt(scoreEl.textContent) || 0;
        }
    }
}
