// vehicle-component-ui.js - Vehicle component customization panel
// Opens with Tab while in DRIVING state, pauses game (same pattern as wand-ui.js)

import {
    RARITY_INFO, ELEMENT_NAMES, VEHICLE_SOCKET_LAYOUT, VEHICLE_SOCKET_KEYS,
    VEHICLE_COMPONENT_TYPES
} from '../systems/item-data.js';

const COMPONENT_TYPE_COLORS = {
    propulsion: '#44aacc',
    engine:     '#ccaa44',
    armor:      '#8888cc',
    weapon:     '#cc4444',
    utility:    '#44cc88',
};

const COMPONENT_TYPE_LABELS = {
    propulsion: 'Propulsion',
    engine:     'Engine',
    armor:      'Armor',
    weapon:     'Weapon',
    utility:    'Utility',
};

export class VehicleComponentUI {
    /**
     * @param {import('../systems/item-system.js').ItemSystem} itemSystem
     */
    constructor(itemSystem) {
        this.itemSystem = itemSystem;
        this.panelElement = null;
        this.isOpen = false;

        this.selectedInventoryItem = null;
        this.selectedSocket = null;

        // Filter state for inventory
        this.filterType = null; // null = show all

        this._createStyles();
        this._createPanel();
        this._setupEventListeners();
    }

    _createStyles() {
        const style = document.createElement('style');
        style.id = 'vehicle-component-ui-styles';
        style.textContent = `
            #vehicle-component-panel {
                position: fixed;
                inset: 0;
                background: rgba(10, 10, 20, 0.95);
                z-index: 500;
                display: none;
                font-family: 'Segoe UI', system-ui, sans-serif;
                color: #f5f0e6;
            }

            #vehicle-component-panel.visible {
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .vc-container {
                width: 100%;
                max-width: 800px;
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                max-height: 90vh;
                overflow-y: auto;
            }

            .vc-title {
                font-size: 22px;
                font-weight: bold;
                color: #d4a574;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 2px;
            }

            .vc-subtitle {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.5);
                text-align: center;
                margin-top: -10px;
            }

            .vc-body {
                display: flex;
                gap: 16px;
            }

            /* Socket Grid */
            .vc-sockets {
                min-width: 320px;
            }

            .vc-section-title {
                font-size: 13px;
                font-weight: bold;
                color: #d4a574;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 8px;
            }

            .vc-socket-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 6px;
            }

            .vc-socket-row-label {
                grid-column: 1 / -1;
                font-size: 10px;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-top: 6px;
                margin-bottom: 2px;
            }

            .vc-socket {
                aspect-ratio: 1;
                min-height: 60px;
                background: rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 2px;
                padding: 4px;
                position: relative;
            }

            .vc-socket:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(212, 165, 116, 0.4);
            }

            .vc-socket.selected {
                border-color: rgba(212, 165, 116, 0.8);
                background: rgba(212, 165, 116, 0.15);
            }

            .vc-socket.filled {
                border-width: 2px;
            }

            .vc-socket .socket-type-icon {
                font-size: 16px;
                opacity: 0.5;
            }

            .vc-socket .socket-label {
                font-size: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: #888;
                text-align: center;
                line-height: 1.1;
            }

            .vc-socket .socket-item-name {
                font-size: 9px;
                text-align: center;
                line-height: 1.1;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 100%;
                white-space: nowrap;
            }

            /* Inventory */
            .vc-inventory {
                flex: 1;
                min-width: 200px;
            }

            .vc-filter-bar {
                display: flex;
                gap: 4px;
                margin-bottom: 8px;
                flex-wrap: wrap;
            }

            .vc-filter-btn {
                padding: 4px 8px;
                font-size: 10px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                color: #aaa;
                cursor: pointer;
                transition: all 0.15s;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .vc-filter-btn:hover { border-color: rgba(212, 165, 116, 0.4); }
            .vc-filter-btn.active {
                background: rgba(212, 165, 116, 0.2);
                border-color: #d4a574;
                color: #d4a574;
            }

            .vc-inv-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 4px;
                max-height: 320px;
                overflow-y: auto;
            }

            .vc-inv-cell {
                aspect-ratio: 1;
                min-height: 44px;
                background: rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(255, 255, 255, 0.08);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.15s;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 1px;
                padding: 2px;
                position: relative;
            }

            .vc-inv-cell:hover {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(212, 165, 116, 0.3);
            }

            .vc-inv-cell.selected {
                border-color: rgba(212, 165, 116, 0.8);
                background: rgba(212, 165, 116, 0.15);
            }

            .vc-inv-cell .cell-type {
                font-size: 7px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .vc-inv-cell .cell-name {
                font-size: 8px;
                text-align: center;
                line-height: 1.1;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 100%;
                white-space: nowrap;
            }

            /* Tooltip */
            .vc-tooltip {
                padding: 12px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(212, 165, 116, 0.2);
                border-radius: 8px;
                min-height: 80px;
            }

            .vc-tooltip-name {
                font-size: 15px;
                font-weight: bold;
                margin-bottom: 3px;
            }

            .vc-tooltip-type {
                font-size: 11px;
                margin-bottom: 2px;
            }

            .vc-tooltip-element {
                font-size: 11px;
                color: #aaa;
                margin-bottom: 8px;
            }

            .vc-tooltip-stats {
                display: flex;
                flex-direction: column;
                gap: 2px;
                font-size: 11px;
            }

            .vc-tooltip-stats .stat-line {
                display: flex;
                justify-content: space-between;
            }

            .vc-tooltip-stats .stat-label { color: #aaa; }
            .vc-tooltip-stats .stat-value { color: #88cc88; }

            .vc-tooltip-empty {
                color: #555;
                font-style: italic;
                text-align: center;
                padding-top: 30px;
                font-size: 12px;
            }

            .vc-aggregate {
                padding: 8px 12px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(212, 165, 116, 0.15);
                border-radius: 6px;
                font-size: 11px;
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .vc-aggregate .agg-stat {
                color: #aaa;
            }
            .vc-aggregate .agg-val {
                color: #88cc88;
                font-weight: bold;
            }

            .vc-close-hint {
                font-size: 11px;
                color: rgba(255, 255, 255, 0.4);
                text-align: center;
            }
        `;
        document.head.appendChild(style);
    }

    _createPanel() {
        const panel = document.createElement('div');
        panel.id = 'vehicle-component-panel';

        panel.innerHTML = `
            <div class="vc-container">
                <div class="vc-title">Vehicle Workshop</div>
                <div class="vc-subtitle">Click a component then click a matching socket to equip | Right-click socket to unequip</div>
                <div class="vc-body">
                    <div class="vc-sockets">
                        <div class="vc-section-title">Vehicle Sockets</div>
                        <div class="vc-socket-grid"></div>
                    </div>
                    <div class="vc-inventory">
                        <div class="vc-section-title">Components</div>
                        <div class="vc-filter-bar"></div>
                        <div class="vc-inv-grid"></div>
                    </div>
                </div>
                <div class="vc-tooltip">
                    <div class="vc-tooltip-empty">Select a component or socket to view details</div>
                </div>
                <div class="vc-aggregate"></div>
                <div class="vc-close-hint">Press Tab or Escape to close</div>
            </div>
        `;

        document.body.appendChild(panel);
        this.panelElement = panel;

        this._buildSocketGrid();
        this._buildFilterBar();
        this._buildInventoryGrid();
    }

    _buildSocketGrid() {
        const grid = this.panelElement.querySelector('.vc-socket-grid');
        grid.innerHTML = '';

        // Group by row
        const rows = {};
        for (const [socketId, info] of Object.entries(VEHICLE_SOCKET_LAYOUT)) {
            if (!rows[info.row]) rows[info.row] = [];
            rows[info.row].push({ socketId, ...info });
        }

        const rowLabels = ['Weapons', 'Wheels', 'Engine & Utility'];

        for (const rowIdx of Object.keys(rows).sort()) {
            const label = document.createElement('div');
            label.className = 'vc-socket-row-label';
            label.textContent = rowLabels[rowIdx] || `Row ${rowIdx}`;
            grid.appendChild(label);

            for (const socket of rows[rowIdx]) {
                const el = document.createElement('div');
                el.className = 'vc-socket';
                el.dataset.socket = socket.socketId;
                const typeColor = COMPONENT_TYPE_COLORS[socket.type] || '#888';
                el.innerHTML = `
                    <div class="socket-type-icon" style="color:${typeColor}">${this._typeIcon(socket.type)}</div>
                    <div class="socket-label">${socket.name}</div>
                `;

                el.addEventListener('click', () => this._onSocketClick(socket.socketId));
                el.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this._onSocketRightClick(socket.socketId);
                });

                grid.appendChild(el);
            }
        }
    }

    _buildFilterBar() {
        const bar = this.panelElement.querySelector('.vc-filter-bar');
        bar.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.className = 'vc-filter-btn active';
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', () => this._setFilter(null));
        bar.appendChild(allBtn);

        for (const [type, label] of Object.entries(COMPONENT_TYPE_LABELS)) {
            const btn = document.createElement('button');
            btn.className = 'vc-filter-btn';
            btn.textContent = label;
            btn.dataset.type = type;
            btn.style.borderColor = COMPONENT_TYPE_COLORS[type] + '66';
            btn.addEventListener('click', () => this._setFilter(type));
            bar.appendChild(btn);
        }
    }

    _buildInventoryGrid() {
        // Populated dynamically in refresh
    }

    _setupEventListeners() {
        window.addEventListener('vehicle-component-collected', () => {
            if (this.isOpen) this.refresh();
        });
        window.addEventListener('vehicle-equipment-changed', () => {
            if (this.isOpen) this.refresh();
        });
    }

    _typeIcon(type) {
        switch (type) {
            case 'weapon':     return '\u2694'; // crossed swords
            case 'propulsion': return '\u25CE'; // bullseye (wheel)
            case 'engine':     return '\u2699'; // gear
            case 'utility':    return '\u2726'; // 4-pointed star
            case 'armor':      return '\u25C6'; // diamond
            default:           return '\u25A0'; // square
        }
    }

    // =============================================
    // OPEN / CLOSE
    // =============================================

    toggle() {
        if (this.isOpen) this.close(); else this.open();
    }

    open() {
        this.isOpen = true;
        this.selectedInventoryItem = null;
        this.selectedSocket = null;
        this.panelElement.classList.add('visible');
        this.refresh();

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        window.dispatchEvent(new CustomEvent('game-paused'));
    }

    close() {
        this.isOpen = false;
        this.selectedInventoryItem = null;
        this.selectedSocket = null;
        this.panelElement.classList.remove('visible');
        window.dispatchEvent(new CustomEvent('game-resumed'));
    }

    // =============================================
    // INTERACTIONS
    // =============================================

    _onSocketClick(socketId) {
        const socketInfo = VEHICLE_SOCKET_LAYOUT[socketId];

        // If we have an inventory item selected and its component type matches the socket type
        if (this.selectedInventoryItem) {
            const item = this.selectedInventoryItem;
            if (item.componentType === socketInfo.type) {
                this.itemSystem.equipVehicleComponent(item, socketId);
                this.selectedInventoryItem = null;
                this.refresh();
                return;
            }
        }

        // Otherwise select this socket for tooltip
        this.selectedSocket = socketId;
        this.selectedInventoryItem = null;
        this.refresh();
        this._showTooltipForSocket(socketId);
    }

    _onSocketRightClick(socketId) {
        this.itemSystem.unequipVehicleComponent(socketId);
        this.selectedSocket = null;
        this.refresh();
    }

    _onInventoryClick(item) {
        this.selectedInventoryItem = item;
        this.selectedSocket = null;
        this.refresh();
        this._showTooltipForItem(item);
    }

    _setFilter(type) {
        this.filterType = type;
        // Update button states
        this.panelElement.querySelectorAll('.vc-filter-btn').forEach(btn => {
            const btnType = btn.dataset.type || null;
            btn.classList.toggle('active', btnType === type);
        });
        this.refresh();
    }

    // =============================================
    // TOOLTIP
    // =============================================

    _showTooltipForItem(item) {
        const tooltip = this.panelElement.querySelector('.vc-tooltip');
        if (!item) {
            tooltip.innerHTML = '<div class="vc-tooltip-empty">Select a component or socket to view details</div>';
            return;
        }

        const rarityInfo = RARITY_INFO[item.rarity];
        const elemName = ELEMENT_NAMES[item.element] || 'Unknown';
        const typeLabel = COMPONENT_TYPE_LABELS[item.componentType] || item.componentType;
        const typeColor = COMPONENT_TYPE_COLORS[item.componentType] || '#888';

        const statLines = [];
        if (item.stats) {
            for (const [key, value] of Object.entries(item.stats)) {
                if (value === 0 || value === undefined) continue;
                const label = this._statLabel(key);
                const prefix = key === 'mass' ? '' : '+';
                statLines.push(`<div class="stat-line"><span class="stat-label">${label}</span><span class="stat-value">${prefix}${typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}</span></div>`);
            }
        }

        tooltip.innerHTML = `
            <div class="vc-tooltip-name" style="color:${rarityInfo.color}">${item.name}</div>
            <div class="vc-tooltip-type" style="color:${typeColor}">${rarityInfo.name} ${typeLabel}</div>
            <div class="vc-tooltip-element">${elemName} Element | Level ${item.level}</div>
            ${statLines.length > 0 ? `<div class="vc-tooltip-stats">${statLines.join('')}</div>` : ''}
        `;
    }

    _showTooltipForSocket(socketId) {
        const item = this.itemSystem.getVehicleEquippedItem(socketId);
        if (item) {
            this._showTooltipForItem(item);
        } else {
            const socketInfo = VEHICLE_SOCKET_LAYOUT[socketId];
            const tooltip = this.panelElement.querySelector('.vc-tooltip');
            tooltip.innerHTML = `<div class="vc-tooltip-empty">${socketInfo.name} - Empty (${COMPONENT_TYPE_LABELS[socketInfo.type]})</div>`;
        }
    }

    _statLabel(key) {
        const labels = {
            mass: 'Mass',
            speedBonus: 'Speed',
            tractionBonus: 'Traction',
            damageBonus: 'Damage',
            armorBonus: 'Armor',
            fireRate: 'Fire Rate',
            healRate: 'Heal/s',
            boostForce: 'Boost',
            pickupRadius: 'Pickup Range',
        };
        return labels[key] || key;
    }

    // =============================================
    // REFRESH
    // =============================================

    refresh() {
        this._refreshSockets();
        this._refreshInventory();
        this._refreshAggregate();
    }

    _refreshSockets() {
        const equipped = this.itemSystem.getVehicleEquipped();

        this.panelElement.querySelectorAll('.vc-socket').forEach(el => {
            const socketId = el.dataset.socket;
            const item = equipped[socketId];

            el.classList.toggle('selected', this.selectedSocket === socketId);
            el.classList.toggle('filled', !!item);

            // Update inner content
            const socketInfo = VEHICLE_SOCKET_LAYOUT[socketId];
            const typeColor = COMPONENT_TYPE_COLORS[socketInfo.type] || '#888';

            if (item) {
                const rarityInfo = RARITY_INFO[item.rarity];
                el.innerHTML = `
                    <div class="socket-item-name" style="color:${rarityInfo.color}">${item.name}</div>
                    <div class="socket-label">${socketInfo.name}</div>
                `;
                el.style.borderColor = rarityInfo.color + '66';
            } else {
                el.innerHTML = `
                    <div class="socket-type-icon" style="color:${typeColor}">${this._typeIcon(socketInfo.type)}</div>
                    <div class="socket-label">${socketInfo.name}</div>
                `;
                el.style.borderColor = '';
            }
        });
    }

    _refreshInventory() {
        const grid = this.panelElement.querySelector('.vc-inv-grid');
        const inventory = this.itemSystem.getVehicleInventory();

        // Apply filter
        const filtered = this.filterType
            ? inventory.filter(item => item.componentType === this.filterType)
            : inventory;

        grid.innerHTML = '';

        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#555;font-size:11px;padding:20px;">No components found</div>';
            return;
        }

        for (const item of filtered) {
            const cell = document.createElement('div');
            cell.className = 'vc-inv-cell';
            cell.classList.toggle('selected', this.selectedInventoryItem === item);

            const rarityInfo = RARITY_INFO[item.rarity];
            const typeColor = COMPONENT_TYPE_COLORS[item.componentType] || '#888';
            const typeLabel = COMPONENT_TYPE_LABELS[item.componentType] || '?';

            cell.style.borderColor = rarityInfo.color + '55';
            cell.innerHTML = `
                <div class="cell-type" style="color:${typeColor}">${typeLabel}</div>
                <div class="cell-name" style="color:${rarityInfo.color}" title="${item.name}">${item.name}</div>
            `;

            cell.addEventListener('click', () => this._onInventoryClick(item));
            grid.appendChild(cell);
        }
    }

    _refreshAggregate() {
        const agg = this.itemSystem.getVehicleAggregateStats();
        const container = this.panelElement.querySelector('.vc-aggregate');

        const parts = [];
        if (agg.mass > 0)          parts.push(`<span class="agg-stat">Mass: <span class="agg-val">${agg.mass}</span></span>`);
        if (agg.speedBonus > 0)    parts.push(`<span class="agg-stat">Speed: <span class="agg-val">+${agg.speedBonus.toFixed(2)}</span></span>`);
        if (agg.tractionBonus > 0) parts.push(`<span class="agg-stat">Traction: <span class="agg-val">+${agg.tractionBonus.toFixed(2)}</span></span>`);
        if (agg.damageBonus > 0)   parts.push(`<span class="agg-stat">Damage: <span class="agg-val">+${agg.damageBonus}</span></span>`);
        if (agg.armorBonus > 0)    parts.push(`<span class="agg-stat">Armor: <span class="agg-val">+${agg.armorBonus}</span></span>`);
        if (agg.fireRate > 0)      parts.push(`<span class="agg-stat">Fire Rate: <span class="agg-val">+${agg.fireRate.toFixed(2)}</span></span>`);
        if (agg.healRate > 0)      parts.push(`<span class="agg-stat">Heal: <span class="agg-val">+${agg.healRate.toFixed(1)}/s</span></span>`);

        container.innerHTML = parts.length > 0
            ? parts.join('')
            : '<span class="agg-stat">No components equipped</span>';
    }

    dispose() {
        this.panelElement?.remove();
        const style = document.getElementById('vehicle-component-ui-styles');
        if (style) style.remove();
    }
}
