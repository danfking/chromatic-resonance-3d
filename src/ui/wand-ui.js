// wand-ui.js - Spell Management UI with Tab menu
// Replaces slot-based UI with color toggle system

import { COLOR_EFFECTS, COLOR_COMBOS } from '../systems/wand.js';

// Color hex values for UI
const COLOR_HEX = {
    ivory: '#eeeedd',
    crimson: '#c44444',
    azure: '#4477aa',
    verdant: '#44aa66',
    golden: '#ddaa44',
    violet: '#8855aa'
};

// Color order for display
const COLOR_ORDER = ['ivory', 'crimson', 'azure', 'verdant', 'golden', 'violet'];

/**
 * SpellManagementUI - HUD + Tab Menu for color wand system
 */
export class WandUI {
    constructor(wand, colorInventory) {
        this.wand = wand;
        this.colorInventory = colorInventory;

        this.hudElement = null;
        this.menuElement = null;
        this.isMenuOpen = false;

        this.init();
    }

    init() {
        this.createStyles();
        this.createHUD();
        this.createMenu();
        this.setupEventListeners();
        this.update();
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* HUD - Bottom center, always visible */
            #wand-hud {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 100;
                font-family: 'Segoe UI', system-ui, sans-serif;
                pointer-events: none;
            }

            .wand-hud-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
            }

            .wand-hud-colors {
                display: flex;
                gap: 4px;
                padding: 8px 12px;
                background: rgba(26, 26, 46, 0.85);
                border: 1px solid rgba(212, 165, 116, 0.3);
                border-radius: 8px;
            }

            .hud-color-orb {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: 2px solid rgba(255, 255, 255, 0.3);
                transition: all 0.2s;
                position: relative;
            }

            .hud-color-orb.enabled {
                box-shadow: 0 0 8px currentColor, 0 0 4px currentColor inset;
                border-color: rgba(255, 255, 255, 0.6);
            }

            .hud-color-orb.disabled {
                opacity: 0.3;
                filter: grayscale(0.8);
            }

            .hud-color-orb.locked::after {
                content: '';
                position: absolute;
                inset: -4px;
                border: 2px solid rgba(255, 255, 255, 0.4);
                border-radius: 50%;
            }

            .wand-hud-mode {
                font-size: 11px;
                color: #d4a574;
                text-transform: uppercase;
                letter-spacing: 1px;
                padding: 4px 10px;
                background: rgba(26, 26, 46, 0.85);
                border-radius: 4px;
            }

            .wand-hud-hint {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.4);
                text-align: center;
            }

            /* Tab Menu - Full screen overlay */
            #spell-menu {
                position: fixed;
                inset: 0;
                background: rgba(10, 10, 20, 0.95);
                z-index: 500;
                display: none;
                font-family: 'Segoe UI', system-ui, sans-serif;
                color: #f5f0e6;
            }

            #spell-menu.visible {
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .menu-container {
                width: 100%;
                max-width: 500px;
                padding: 30px;
            }

            .menu-title {
                font-size: 24px;
                font-weight: bold;
                color: #d4a574;
                text-align: center;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }

            .menu-subtitle {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.5);
                text-align: center;
                margin-bottom: 24px;
            }

            .menu-section {
                margin-bottom: 24px;
                padding: 16px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(212, 165, 116, 0.2);
                border-radius: 8px;
            }

            .menu-section-title {
                font-size: 14px;
                font-weight: bold;
                color: #d4a574;
                margin-bottom: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            /* Color toggles */
            .color-toggle-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .color-toggle {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 14px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s;
            }

            .color-toggle:hover:not(.locked) {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(212, 165, 116, 0.4);
            }

            .color-toggle.enabled {
                border-color: rgba(212, 165, 116, 0.6);
                background: rgba(212, 165, 116, 0.1);
            }

            .color-toggle.locked {
                cursor: default;
                opacity: 0.8;
            }

            .color-toggle.locked .toggle-checkbox {
                opacity: 0.5;
            }

            .toggle-checkbox {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                transition: all 0.15s;
            }

            .color-toggle.enabled .toggle-checkbox {
                background: #d4a574;
                border-color: #d4a574;
                color: #1a1a2e;
            }

            .toggle-orb {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                box-shadow: 0 0 8px currentColor;
            }

            .toggle-info {
                flex: 1;
            }

            .toggle-name {
                font-size: 14px;
                font-weight: bold;
            }

            .toggle-effect {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
            }

            .toggle-charge {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.6);
                min-width: 60px;
                text-align: right;
            }

            /* Mode buttons */
            .mode-buttons {
                display: flex;
                gap: 12px;
            }

            .mode-btn {
                flex: 1;
                padding: 12px;
                background: rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                color: #f5f0e6;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.15s;
                text-transform: uppercase;
            }

            .mode-btn:hover {
                background: rgba(255, 255, 255, 0.05);
            }

            .mode-btn.active {
                background: rgba(212, 165, 116, 0.2);
                border-color: #d4a574;
                color: #d4a574;
            }

            .mode-btn-desc {
                font-size: 10px;
                font-weight: normal;
                color: rgba(255, 255, 255, 0.5);
                margin-top: 4px;
                text-transform: none;
            }

            /* Combos */
            .combo-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .combo-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 4px;
            }

            .combo-item.inactive {
                opacity: 0.4;
            }

            .combo-colors {
                display: flex;
                gap: 4px;
            }

            .combo-color-dot {
                width: 14px;
                height: 14px;
                border-radius: 50%;
            }

            .combo-name {
                font-size: 13px;
                font-weight: bold;
                color: #d4a574;
            }

            .combo-desc {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
            }

            .combo-bonus {
                font-size: 11px;
                color: #44aa66;
                margin-left: auto;
            }

            .no-combos {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.4);
                text-align: center;
                padding: 12px;
            }

            /* Close hint */
            .menu-close-hint {
                text-align: center;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.4);
                margin-top: 20px;
            }
        `;
        document.head.appendChild(style);
    }

    createHUD() {
        this.hudElement = document.createElement('div');
        this.hudElement.id = 'wand-hud';
        this.hudElement.innerHTML = `
            <div class="wand-hud-container">
                <div class="wand-hud-colors">
                    ${COLOR_ORDER.map(color => `
                        <div class="hud-color-orb ${color === 'ivory' ? 'locked' : ''}"
                             data-color="${color}"
                             style="background: ${COLOR_HEX[color]}; color: ${COLOR_HEX[color]}">
                        </div>
                    `).join('')}
                </div>
                <div class="wand-hud-mode">Single</div>
                <div class="wand-hud-hint">Tab: Menu | LMB: Fire</div>
            </div>
        `;
        document.body.appendChild(this.hudElement);
    }

    createMenu() {
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'spell-menu';
        this.menuElement.innerHTML = `
            <div class="menu-container">
                <div class="menu-title">Spell Management</div>
                <div class="menu-subtitle">Toggle colors to add effects to your wand</div>

                <div class="menu-section">
                    <div class="menu-section-title">Active Colors</div>
                    <div class="color-toggle-list">
                        ${COLOR_ORDER.map(color => this.createColorToggle(color)).join('')}
                    </div>
                </div>

                <div class="menu-section">
                    <div class="menu-section-title">Wand Mode</div>
                    <div class="mode-buttons">
                        <button class="mode-btn" data-mode="single">
                            Single
                            <div class="mode-btn-desc">Cycles through enabled colors</div>
                        </button>
                        <button class="mode-btn" data-mode="multi">
                            Multi
                            <div class="mode-btn-desc">Fires all colors blended</div>
                        </button>
                    </div>
                </div>

                <div class="menu-section">
                    <div class="menu-section-title">Active Combos</div>
                    <div class="combo-list"></div>
                </div>

                <div class="menu-close-hint">Press Tab to close</div>
            </div>
        `;
        document.body.appendChild(this.menuElement);

        // Setup menu interactions
        this.setupMenuInteractions();
    }

    createColorToggle(color) {
        const effect = COLOR_EFFECTS[color];
        const isIvory = color === 'ivory';

        return `
            <div class="color-toggle ${isIvory ? 'locked enabled' : ''}" data-color="${color}">
                <div class="toggle-checkbox">${isIvory ? 'x' : ''}</div>
                <div class="toggle-orb" style="background: ${COLOR_HEX[color]}; color: ${COLOR_HEX[color]}"></div>
                <div class="toggle-info">
                    <div class="toggle-name">${effect?.name || color} ${isIvory ? '(locked)' : ''}</div>
                    <div class="toggle-effect">${effect?.description || ''}</div>
                </div>
                <div class="toggle-charge" data-color="${color}">0/100</div>
            </div>
        `;
    }

    setupMenuInteractions() {
        // Color toggles
        this.menuElement.querySelectorAll('.color-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const color = toggle.dataset.color;
                if (color === 'ivory') return; // Cannot toggle ivory

                const isNowEnabled = this.wand.toggleColor(color);
                this.updateMenuState();
                this.updateHUD();
            });
        });

        // Mode buttons
        this.menuElement.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.wand.setMode(mode);
                this.updateMenuState();
                this.updateHUD();
            });
        });
    }

    setupEventListeners() {
        // Tab key to toggle menu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.toggleMenu();
            }
        });
    }

    toggleMenu() {
        this.isMenuOpen = !this.isMenuOpen;

        if (this.isMenuOpen) {
            this.openMenu();
        } else {
            this.closeMenu();
        }
    }

    openMenu() {
        this.isMenuOpen = true;
        this.menuElement.classList.add('visible');
        this.updateMenuState();

        // Release pointer lock so user can interact with menu
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        // Dispatch pause event
        window.dispatchEvent(new CustomEvent('game-paused'));
    }

    closeMenu() {
        this.isMenuOpen = false;
        this.menuElement.classList.remove('visible');

        // Dispatch resume event
        window.dispatchEvent(new CustomEvent('game-resumed'));
    }

    updateMenuState() {
        // Update color toggle states
        this.menuElement.querySelectorAll('.color-toggle').forEach(toggle => {
            const color = toggle.dataset.color;
            const isEnabled = this.wand.isColorEnabled(color);
            const checkbox = toggle.querySelector('.toggle-checkbox');

            toggle.classList.toggle('enabled', isEnabled);
            checkbox.textContent = isEnabled ? 'x' : '';

            // Update charge display
            const chargeEl = toggle.querySelector('.toggle-charge');
            if (chargeEl && this.colorInventory) {
                const charge = this.colorInventory.charges[color];
                if (charge) {
                    chargeEl.textContent = `${Math.floor(charge.current)}/${charge.max}`;
                }
            }
        });

        // Update mode buttons
        const currentMode = this.wand.mode;
        this.menuElement.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === currentMode);
        });

        // Update combo list
        this.updateComboList();
    }

    updateComboList() {
        const comboList = this.menuElement.querySelector('.combo-list');
        const enabledColors = this.wand.getEnabledColors().filter(c => c !== 'ivory');

        if (enabledColors.length < 2) {
            comboList.innerHTML = '<div class="no-combos">Enable 2+ colors to see available combos</div>';
            return;
        }

        // Find all combos that could be active
        const allCombos = Object.entries(COLOR_COMBOS).map(([key, combo]) => {
            const [color1, color2] = key.split('+');
            const isActive = enabledColors.includes(color1) && enabledColors.includes(color2);
            return { key, ...combo, colors: [color1, color2], isActive };
        });

        // Sort: active combos first
        allCombos.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));

        // Only show relevant combos (at least one color enabled)
        const relevantCombos = allCombos.filter(combo =>
            enabledColors.includes(combo.colors[0]) || enabledColors.includes(combo.colors[1])
        );

        if (relevantCombos.length === 0) {
            comboList.innerHTML = '<div class="no-combos">No combos available with current colors</div>';
            return;
        }

        comboList.innerHTML = relevantCombos.map(combo => `
            <div class="combo-item ${combo.isActive ? '' : 'inactive'}">
                <div class="combo-colors">
                    <div class="combo-color-dot" style="background: ${COLOR_HEX[combo.colors[0]]}"></div>
                    <div class="combo-color-dot" style="background: ${COLOR_HEX[combo.colors[1]]}"></div>
                </div>
                <div>
                    <div class="combo-name">${combo.name}</div>
                    <div class="combo-desc">${combo.description}</div>
                </div>
                <div class="combo-bonus">+${Math.round((combo.bonusDamage - 1) * 100)}%</div>
            </div>
        `).join('');
    }

    updateHUD() {
        if (!this.hudElement) return;

        // Update color orbs
        this.hudElement.querySelectorAll('.hud-color-orb').forEach(orb => {
            const color = orb.dataset.color;
            const isEnabled = this.wand.isColorEnabled(color);
            orb.classList.toggle('enabled', isEnabled);
            orb.classList.toggle('disabled', !isEnabled);
        });

        // Update mode display
        const modeEl = this.hudElement.querySelector('.wand-hud-mode');
        if (modeEl) {
            modeEl.textContent = this.wand.mode === 'multi' ? 'Multi' : 'Single';
        }
    }

    update() {
        this.updateHUD();

        // Update menu charge displays if open
        if (this.isMenuOpen) {
            this.menuElement.querySelectorAll('.toggle-charge').forEach(el => {
                const color = el.dataset.color;
                if (color && this.colorInventory) {
                    const charge = this.colorInventory.charges[color];
                    if (charge) {
                        el.textContent = `${Math.floor(charge.current)}/${charge.max}`;
                    }
                }
            });
        }
    }

    setVisible(visible) {
        if (this.hudElement) {
            this.hudElement.style.display = visible ? 'block' : 'none';
        }
    }

    destroy() {
        this.hudElement?.remove();
        this.menuElement?.remove();
    }
}
