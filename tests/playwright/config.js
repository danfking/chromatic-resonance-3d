// Playwright MCP Test Configuration
// Run with Claude Code using Playwright MCP tools

export const config = {
    // Dev server URL
    baseUrl: 'http://localhost:8082',

    // Timeouts (in ms)
    pageLoadTimeout: 10000,
    gameInitTimeout: 5000,
    actionTimeout: 2000,

    // Browser viewport
    viewport: {
        width: 1280,
        height: 720
    },

    // Game state check intervals
    pollInterval: 100,

    // Test categories
    categories: {
        basicControls: 'Basic movement and camera controls',
        wandSystem: 'Color wand firing and effects',
        menuInteraction: 'Tab menu and pause states',
        combatFlow: 'Enemy waves and damage',
        edgeCases: 'Resource depletion and rapid input'
    }
};

// Expected game element selectors
export const selectors = {
    canvas: 'canvas',
    controlsHint: '#controls-hint',
    fpsCounter: '#fps',
    waveDisplay: '#wave',
    scoreDisplay: '#score',
    spellMenu: '#spell-menu',
    wandHud: '#wand-hud',
    healthBar: '#health-bar'
};

// Key mappings for game input
export const keyMappings = {
    forward: 'KeyW',
    backward: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    menu: 'Tab',
    pause: 'Escape'
};

// Color charge thresholds for testing
export const colorThresholds = {
    ivory: { min: 0, max: 100, regenRate: 5 },
    crimson: { min: 0, max: 100, regenRate: 0 },
    azure: { min: 0, max: 100, regenRate: 0 },
    verdant: { min: 0, max: 100, regenRate: 0 },
    golden: { min: 0, max: 100, regenRate: 0 },
    violet: { min: 0, max: 100, regenRate: 0 }
};
