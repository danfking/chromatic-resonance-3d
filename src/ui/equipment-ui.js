// equipment-ui.js - Equipment panel, inventory grid, tooltips, HUD dots
// Opens with I key, pauses game (same pattern as wand-ui.js Tab menu)

import {
    RARITY, RARITY_INFO, EQUIPMENT_SLOTS, SLOT_KEYS,
    ELEMENT_NAMES, ELEMENT_COLORS
} from '../systems/item-data.js';

export class EquipmentUI {
    constructor(itemSystem) {
        this.itemSystem = itemSystem;

        this.panelElement = null;
        this.hudElement = null;
        this.isOpen = false;

        // Selection state
        this.selectedInventoryItem = null;
        this.selectedSlot = null;

        this.init();
    }

    init() {
        this.createStyles();
        this.createHUD();
        this.createPanel();
        this.setupEventListeners();
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Equipment HUD - bottom left dots */
            #equipment-hud {
                position: fixed;
                bottom: 20px;
                left: 10px;
                display: flex;
                gap: 4px;
                z-index: 100;
                pointer-events: none;
            }

            .equip-hud-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                border: 1px solid rgba(255, 255, 255, 0.3);
                background: rgba(60, 60, 80, 0.6);
                transition: all 0.3s;
            }

            .equip-hud-dot.filled {
                box-shadow: 0 0 4px currentColor;
                border-color: rgba(255, 255, 255, 0.5);
            }

            /* Equipment Panel - full screen overlay */
            #equipment-panel {
                position: fixed;
                inset: 0;
                background: rgba(10, 10, 20, 0.95);
                z-index: 500;
                display: none;
                font-family: 'Segoe UI', system-ui, sans-serif;
                color: #f5f0e6;
            }

            #equipment-panel.visible {
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .equip-container {
                width: 100%;
                max-width: 700px;
                padding: 30px;
                display: flex;
                flex-direction: column;
                gap: 20px;
                max-height: 90vh;
                overflow-y: auto;
            }

            .equip-title {
                font-size: 24px;
                font-weight: bold;
                color: #d4a574;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 2px;
            }

            .equip-subtitle {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.5);
                text-align: center;
                margin-top: -14px;
            }

            /* Equipment + Inventory layout */
            .equip-body {
                display: flex;
                gap: 20px;
            }

            /* Equipment slots column */
            .equip-slots {
                display: flex;
                flex-direction: column;
                gap: 8px;
                min-width: 200px;
            }

            .equip-slot {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 14px;
                background: rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s;
                min-height: 48px;
            }

            .equip-slot:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(212, 165, 116, 0.4);
            }

            .equip-slot.selected {
                border-color: rgba(212, 165, 116, 0.8);
                background: rgba(212, 165, 116, 0.15);
            }

            .equip-slot .slot-label {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #888;
                min-width: 70px;
            }

            .equip-slot .slot-item-name {
                font-size: 13px;
                flex: 1;
            }

            .equip-slot .slot-empty {
                font-size: 12px;
                color: #555;
                font-style: italic;
            }

            /* Inventory grid */
            .equip-inventory {
                flex: 1;
            }

            .inventory-title {
                font-size: 14px;
                font-weight: bold;
                color: #d4a574;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .inventory-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 6px;
            }

            .inventory-cell {
                aspect-ratio: 1;
                background: rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(255, 255, 255, 0.08);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.15s;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                min-height: 48px;
            }

            .inventory-cell:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(212, 165, 116, 0.3);
            }

            .inventory-cell.selected {
                border-color: rgba(212, 165, 116, 0.8);
                background: rgba(212, 165, 116, 0.15);
            }

            .inventory-cell.has-item {
                border-width: 2px;
            }

            .inv-item-inner {
                width: 70%;
                height: 70%;
                border-radius: 4px;
                position: relative;
            }

            .inv-item-element {
                font-size: 8px;
                position: absolute;
                bottom: -2px;
                right: -2px;
                background: rgba(0,0,0,0.6);
                padding: 1px 3px;
                border-radius: 2px;
                color: #aaa;
            }

            /* Tooltip */
            .equip-tooltip {
                padding: 16px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(212, 165, 116, 0.2);
                border-radius: 8px;
                min-height: 120px;
            }

            .tooltip-name {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 4px;
            }

            .tooltip-rarity {
                font-size: 12px;
                margin-bottom: 2px;
            }

            .tooltip-element {
                font-size: 12px;
                color: #aaa;
                margin-bottom: 10px;
            }

            .tooltip-stats {
                display: flex;
                flex-direction: column;
                gap: 3px;
                font-size: 12px;
            }

            .tooltip-stats .stat-line {
                display: flex;
                justify-content: space-between;
            }

            .stat-label { color: #aaa; }
            .stat-value { color: #88cc88; }
            .stat-value.negative { color: #cc8888; }

            .tooltip-mods {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid rgba(255,255,255,0.1);
                font-size: 11px;
                color: #aaa;
            }

            .tooltip-formation {
                margin-top: 6px;
                font-size: 11px;
                color: #88aacc;
            }

            .tooltip-symbiote {
                margin-top: 6px;
                font-size: 11px;
                color: #ffaa44;
            }

            .tooltip-empty {
                color: #555;
                font-style: italic;
                text-align: center;
                padding-top: 40px;
            }

            .equip-hint {
                font-size: 11px;
                color: rgba(255,255,255,0.4);
                text-align: center;
            }
        `;
        document.head.appendChild(style);
    }

    createHUD() {
        const hud = document.createElement('div');
        hud.id = 'equipment-hud';

        for (const slot of SLOT_KEYS) {
            const dot = document.createElement('div');
            dot.className = 'equip-hud-dot';
            dot.dataset.slot = slot;
            dot.title = EQUIPMENT_SLOTS[slot].name;
            hud.appendChild(dot);
        }

        document.body.appendChild(hud);
        this.hudElement = hud;
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'equipment-panel';

        panel.innerHTML = `
            <div class="equip-container">
                <div class="equip-title">Living Arsenal</div>
                <div class="equip-subtitle">Press I to close | Left-click to select | Right-click to unequip</div>
                <div class="equip-body">
                    <div class="equip-slots">
                        ${SLOT_KEYS.map(slot => `
                            <div class="equip-slot" data-slot="${slot}">
                                <span class="slot-label">${EQUIPMENT_SLOTS[slot].name}</span>
                                <span class="slot-item-name slot-empty">Empty</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="equip-inventory">
                        <div class="inventory-title">Inventory</div>
                        <div class="inventory-grid">
                            ${Array(20).fill(0).map((_, i) => `
                                <div class="inventory-cell" data-index="${i}"></div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="equip-tooltip">
                    <div class="tooltip-empty">Select an item or slot to view details</div>
                </div>
                <div class="equip-hint">Click inventory item then click a matching slot to equip</div>
            </div>
        `;

        document.body.appendChild(panel);
        this.panelElement = panel;

        // Bind slot clicks
        panel.querySelectorAll('.equip-slot').forEach(el => {
            el.addEventListener('click', () => this.onSlotClick(el.dataset.slot));
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.onSlotRightClick(el.dataset.slot);
            });
        });

        // Bind inventory clicks
        panel.querySelectorAll('.inventory-cell').forEach(el => {
            el.addEventListener('click', () => this.onInventoryClick(parseInt(el.dataset.index)));
        });
    }

    setupEventListeners() {
        // Listen for equipment changes to refresh UI
        window.addEventListener('equipment-changed', () => this.refresh());
        window.addEventListener('item-collected', () => this.refresh());
    }

    // =============================================
    // PANEL OPEN / CLOSE
    // =============================================

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.selectedInventoryItem = null;
        this.selectedSlot = null;
        this.panelElement.classList.add('visible');
        this.refresh();

        // Release pointer lock
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        // Pause game
        window.dispatchEvent(new CustomEvent('game-paused'));
    }

    close() {
        this.isOpen = false;
        this.selectedInventoryItem = null;
        this.selectedSlot = null;
        this.panelElement.classList.remove('visible');

        // Resume game
        window.dispatchEvent(new CustomEvent('game-resumed'));
    }

    // =============================================
    // INTERACTIONS
    // =============================================

    onSlotClick(slot) {
        // If we have an inventory item selected and it matches this slot, equip it
        if (this.selectedInventoryItem && this.selectedInventoryItem.slot === slot) {
            this.itemSystem.equip(this.selectedInventoryItem, slot);
            this.selectedInventoryItem = null;
            this.refresh();
            return;
        }

        // Otherwise select this slot to show tooltip
        this.selectedSlot = slot;
        this.selectedInventoryItem = null;
        this.refresh();
        this.showTooltipForSlot(slot);
    }

    onSlotRightClick(slot) {
        // Unequip item from slot
        this.itemSystem.unequip(slot);
        this.selectedSlot = null;
        this.refresh();
    }

    onInventoryClick(index) {
        const inventory = this.itemSystem.getInventory();
        if (index >= inventory.length) return;

        const item = inventory[index];
        this.selectedInventoryItem = item;
        this.selectedSlot = null;
        this.refresh();
        this.showTooltipForItem(item);
    }

    // =============================================
    // TOOLTIP
    // =============================================

    showTooltipForItem(item) {
        const tooltip = this.panelElement.querySelector('.equip-tooltip');
        if (!item) {
            tooltip.innerHTML = '<div class="tooltip-empty">Select an item or slot to view details</div>';
            return;
        }

        const rarityInfo = RARITY_INFO[item.rarity];
        const elemName = ELEMENT_NAMES[item.element] || 'Unknown';
        const slotName = EQUIPMENT_SLOTS[item.slot]?.name || item.slot;

        let statsHtml = '';
        if (item.stats) {
            const statLines = [];
            if (item.stats.damage > 0) statLines.push({ label: 'Damage', value: `+${item.stats.damage}` });
            if (item.stats.health > 0) statLines.push({ label: 'Health', value: `+${item.stats.health}` });
            if (item.stats.speed > 0) statLines.push({ label: 'Speed', value: `+${item.stats.speed}` });
            if (item.stats.colorEfficiency > 0) statLines.push({ label: 'Color Efficiency', value: `+${(item.stats.colorEfficiency * 100).toFixed(1)}%` });
            if (item.stats.regenRate > 0) statLines.push({ label: 'Regen', value: `+${item.stats.regenRate}/s` });
            if (item.stats.armorBonus > 0) statLines.push({ label: 'Armor', value: `+${item.stats.armorBonus}` });

            if (statLines.length > 0) {
                statsHtml = `<div class="tooltip-stats">
                    ${statLines.map(s => `<div class="stat-line"><span class="stat-label">${s.label}</span><span class="stat-value">${s.value}</span></div>`).join('')}
                </div>`;
            }
        }

        let modsHtml = '';
        if (item.matrixMods && item.matrixMods.length > 0) {
            const modLines = item.matrixMods.map(m => {
                const aName = ELEMENT_NAMES[m.typeA] || '?';
                const bName = ELEMENT_NAMES[m.typeB] || '?';
                const sign = m.delta >= 0 ? '+' : '';
                return `${aName}→${bName}: ${sign}${m.delta.toFixed(2)}`;
            });
            modsHtml = `<div class="tooltip-mods">Matrix: ${modLines.join(', ')}</div>`;
        }

        let formationHtml = '';
        if (item.formation) {
            formationHtml = `<div class="tooltip-formation">Formation: ${item.formation.type} (${item.formation.particleCount} particles, ${(item.formation.stability * 100).toFixed(0)}% stability)</div>`;
        }

        let symbioteHtml = '';
        if (item.symbiote) {
            const symElements = item.symbiote.elements.map(e => ELEMENT_NAMES[e] || '?').join('+');
            symbioteHtml = `<div class="tooltip-symbiote">Symbiote Companion: ${symElements} (${item.symbiote.particleCount} particles)</div>`;
        }

        tooltip.innerHTML = `
            <div class="tooltip-name" style="color:${rarityInfo.color}">${item.name}</div>
            <div class="tooltip-rarity" style="color:${rarityInfo.color}">${rarityInfo.name} ${slotName}</div>
            <div class="tooltip-element">${elemName} Element | Level ${item.level}</div>
            ${statsHtml}
            ${modsHtml}
            ${formationHtml}
            ${symbioteHtml}
        `;
    }

    showTooltipForSlot(slot) {
        const item = this.itemSystem.getEquippedItem(slot);
        if (item) {
            this.showTooltipForItem(item);
        } else {
            const tooltip = this.panelElement.querySelector('.equip-tooltip');
            tooltip.innerHTML = `<div class="tooltip-empty">${EQUIPMENT_SLOTS[slot].name} - Empty</div>`;
        }
    }

    // =============================================
    // REFRESH
    // =============================================

    refresh() {
        this.refreshSlots();
        this.refreshInventory();
        this.refreshHUD();
    }

    refreshSlots() {
        if (!this.panelElement) return;

        for (const slot of SLOT_KEYS) {
            const el = this.panelElement.querySelector(`.equip-slot[data-slot="${slot}"]`);
            if (!el) continue;

            const item = this.itemSystem.getEquippedItem(slot);
            const nameEl = el.querySelector('.slot-item-name');

            el.classList.toggle('selected', this.selectedSlot === slot);

            if (item) {
                const rarityInfo = RARITY_INFO[item.rarity];
                nameEl.textContent = item.name;
                nameEl.style.color = rarityInfo.color;
                nameEl.classList.remove('slot-empty');
                el.style.borderColor = rarityInfo.color + '66'; // Semi-transparent rarity color border
            } else {
                nameEl.textContent = 'Empty';
                nameEl.style.color = '';
                nameEl.classList.add('slot-empty');
                el.style.borderColor = '';
            }
        }
    }

    refreshInventory() {
        if (!this.panelElement) return;

        const inventory = this.itemSystem.getInventory();
        const cells = this.panelElement.querySelectorAll('.inventory-cell');

        cells.forEach((cell, i) => {
            cell.innerHTML = '';
            cell.classList.remove('has-item', 'selected');
            cell.style.borderColor = '';

            if (i < inventory.length) {
                const item = inventory[i];
                const rarityInfo = RARITY_INFO[item.rarity];
                const elemColor = ELEMENT_COLORS[item.element] || 0xffffff;
                const elemColorHex = '#' + elemColor.toString(16).padStart(6, '0');
                const elemName = ELEMENT_NAMES[item.element] || '?';

                cell.classList.add('has-item');
                cell.style.borderColor = rarityInfo.color + '88';

                const isSelected = this.selectedInventoryItem === item;
                cell.classList.toggle('selected', isSelected);

                cell.innerHTML = `
                    <div class="inv-item-inner" style="background:${elemColorHex}44; border: 1px solid ${rarityInfo.color}">
                        <span class="inv-item-element">${elemName.charAt(0)}</span>
                    </div>
                `;
            }
        });
    }

    refreshHUD() {
        if (!this.hudElement) return;

        const dots = this.hudElement.querySelectorAll('.equip-hud-dot');
        SLOT_KEYS.forEach((slot, i) => {
            const dot = dots[i];
            if (!dot) return;

            const item = this.itemSystem.getEquippedItem(slot);
            if (item) {
                const rarityInfo = RARITY_INFO[item.rarity];
                dot.classList.add('filled');
                dot.style.background = rarityInfo.color;
                dot.style.color = rarityInfo.color;
            } else {
                dot.classList.remove('filled');
                dot.style.background = '';
                dot.style.color = '';
            }
        });
    }

    // =============================================
    // UPDATE (called each frame for HUD)
    // =============================================

    update() {
        // Only refresh HUD during gameplay (panel handles its own updates)
        // Lightweight - no per-frame DOM updates needed unless equipment changes
    }
}
