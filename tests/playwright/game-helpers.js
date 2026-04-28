// Game Helpers for Playwright MCP Testing
// Common interactions and state checks for Chromatic Resonance 3D

import { config, selectors, keyMappings } from './config.js';

/**
 * GameHelpers - Collection of helper functions for game testing
 * These are designed to be used with Playwright MCP browser tools
 */
export const GameHelpers = {
    /**
     * Launch the game and wait for canvas
     * @param {Page} page - Playwright page object
     */
    async launchGame(page) {
        // Disable pointer lock (prevents grabbing user's mouse during headless runs)
        await page.addInitScript(() => {
            Element.prototype.requestPointerLock = function() {};
            Document.prototype.exitPointerLock = function() {};
            Object.defineProperty(Document.prototype, 'pointerLockElement', { get: () => null });
        });

        await page.goto(config.baseUrl);
        await page.waitForSelector(selectors.canvas, { timeout: config.pageLoadTimeout });
        // Wait for game initialization
        await page.waitForTimeout(config.gameInitTimeout);
    },

    /**
     * Click canvas to enter game (acquire pointer lock)
     * @param {Page} page - Playwright page
     */
    async enterGame(page) {
        await page.click(selectors.canvas);
        await page.waitForTimeout(500);
    },

    /**
     * Open the spell management menu
     * @param {Page} page - Playwright page
     */
    async openSpellMenu(page) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);
    },

    /**
     * Close the spell management menu
     * @param {Page} page - Playwright page
     */
    async closeSpellMenu(page) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(300);
    },

    /**
     * Press Escape key
     * @param {Page} page - Playwright page
     */
    async pressEscape(page) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
    },

    /**
     * Move in a direction for specified duration
     * @param {Page} page - Playwright page
     * @param {string} direction - 'forward', 'backward', 'left', 'right'
     * @param {number} duration - Duration in ms
     */
    async move(page, direction, duration = 500) {
        const key = keyMappings[direction];
        await page.keyboard.down(key);
        await page.waitForTimeout(duration);
        await page.keyboard.up(key);
    },

    /**
     * Fire the wand (left click)
     * @param {Page} page - Playwright page
     */
    async fireWand(page) {
        await page.mouse.click(640, 360); // Center of default viewport
        await page.waitForTimeout(100);
    },

    /**
     * Fire wand multiple times rapidly
     * @param {Page} page - Playwright page
     * @param {number} count - Number of shots
     * @param {number} interval - Interval between shots in ms
     */
    async rapidFire(page, count, interval = 100) {
        for (let i = 0; i < count; i++) {
            await page.mouse.click(640, 360);
            await page.waitForTimeout(interval);
        }
    },

    /**
     * Get current game state by evaluating window.game
     * @param {Page} page - Playwright page
     * @returns {Object} Game state
     */
    async getGameState(page) {
        return await page.evaluate(() => {
            if (!window.game) return null;
            return {
                isPaused: window.game.isPaused,
                playerHealth: window.game.playerHealth?.current,
                wave: window.game.enemyManager?.getWave(),
                score: window.game.enemyManager?.getScore(),
                enemyCount: window.game.enemyManager?.getEnemyCount(),
                colorCharges: window.game.colorInventory?.getAll?.() || null
            };
        });
    },

    /**
     * Check if spell menu is visible
     * @param {Page} page - Playwright page
     * @returns {boolean}
     */
    async isSpellMenuVisible(page) {
        return await page.evaluate(() => {
            const menu = document.getElementById('spell-menu');
            return menu && menu.classList.contains('visible');
        });
    },

    /**
     * Check if game is paused
     * @param {Page} page - Playwright page
     * @returns {boolean}
     */
    async isGamePaused(page) {
        return await page.evaluate(() => {
            return window.game?.isPaused === true;
        });
    },

    /**
     * Get player position
     * @param {Page} page - Playwright page
     * @returns {Object} {x, y, z}
     */
    async getPlayerPosition(page) {
        return await page.evaluate(() => {
            const pos = window.game?.controller?.getPosition();
            if (!pos) return null;
            return { x: pos.x, y: pos.y, z: pos.z };
        });
    },

    /**
     * Check if pointer is locked
     * @param {Page} page - Playwright page
     * @returns {boolean}
     */
    async isPointerLocked(page) {
        return await page.evaluate(() => {
            return document.pointerLockElement !== null;
        });
    },

    /**
     * Wait for game to initialize
     * @param {Page} page - Playwright page
     */
    async waitForGameReady(page) {
        await page.waitForFunction(() => {
            return window.game &&
                   window.game.controller &&
                   window.game.colorInventory;
        }, { timeout: config.gameInitTimeout });
    },

    /**
     * Toggle a color in the spell menu
     * @param {Page} page - Playwright page
     * @param {string} color - Color name
     */
    async toggleColor(page, color) {
        await page.click(`.color-toggle[data-color="${color}"]`);
        await page.waitForTimeout(100);
    },

    /**
     * Set wand mode
     * @param {Page} page - Playwright page
     * @param {string} mode - 'single' or 'multi'
     */
    async setWandMode(page, mode) {
        await page.click(`.mode-btn[data-mode="${mode}"]`);
        await page.waitForTimeout(100);
    },

    /**
     * Get console errors from the page
     * @param {Page} page - Playwright page
     * @returns {string[]} Array of error messages
     */
    async getConsoleErrors(page) {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });
        return errors;
    },

    /**
     * Take a screenshot with timestamp
     * @param {Page} page - Playwright page
     * @param {string} name - Screenshot name
     */
    async screenshot(page, name) {
        const timestamp = Date.now();
        await page.screenshot({
            path: `tests/playwright/screenshots/${name}-${timestamp}.png`
        });
    }
};

/**
 * Test result tracking
 */
export class TestResults {
    constructor() {
        this.passed = [];
        this.failed = [];
        this.skipped = [];
    }

    pass(name, details = '') {
        this.passed.push({ name, details });
        console.log(`PASS: ${name}${details ? ` - ${details}` : ''}`);
    }

    fail(name, error) {
        this.failed.push({ name, error: error.message || error });
        console.error(`FAIL: ${name} - ${error.message || error}`);
    }

    skip(name, reason) {
        this.skipped.push({ name, reason });
        console.log(`SKIP: ${name} - ${reason}`);
    }

    summary() {
        console.log('\n--- Test Summary ---');
        console.log(`Passed: ${this.passed.length}`);
        console.log(`Failed: ${this.failed.length}`);
        console.log(`Skipped: ${this.skipped.length}`);

        if (this.failed.length > 0) {
            console.log('\nFailed tests:');
            this.failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
        }

        return {
            passed: this.passed.length,
            failed: this.failed.length,
            skipped: this.skipped.length,
            success: this.failed.length === 0
        };
    }
}
