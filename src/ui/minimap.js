// minimap.js - Top-down minimap for outdoor levels

export class Minimap {
    constructor(enemyManager) {
        this.enemyManager = enemyManager;
        this.playerPosition = { x: 0, z: 0 };
        this.playerRotation = 0;
        this.mapSize = 120;

        this.init();
    }

    init() {
        this.createUI();
        this.startUpdateLoop();
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'minimap';
        container.innerHTML = `
            <canvas id="minimap-canvas" width="120" height="120"></canvas>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #minimap {
                position: fixed;
                bottom: 80px;
                right: 10px;
                width: 120px;
                height: 120px;
                background: rgba(26, 26, 46, 0.85);
                border: 2px solid rgba(212, 165, 116, 0.5);
                border-radius: 8px;
                z-index: 100;
                overflow: hidden;
            }

            #minimap-canvas {
                width: 100%;
                height: 100%;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(container);

        this.canvas = document.getElementById('minimap-canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    setPlayerPosition(x, z, rotation = 0) {
        this.playerPosition.x = x;
        this.playerPosition.z = z;
        this.playerRotation = rotation;
    }

    worldToMap(worldX, worldZ) {
        const mapX = ((worldX + 20) / 40) * this.mapSize;
        const mapY = ((worldZ + 20) / 40) * this.mapSize;
        return { x: mapX, y: mapY };
    }

    startUpdateLoop() {
        const update = () => {
            this.render();
            requestAnimationFrame(update);
        };
        update();
    }

    render() {
        const ctx = this.ctx;
        const size = this.mapSize;

        // Clear
        ctx.fillStyle = 'rgba(26, 26, 46, 0.9)';
        ctx.fillRect(0, 0, size, size);

        // Grid background
        ctx.strokeStyle = 'rgba(100, 100, 120, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const pos = (i / 4) * size;
            ctx.beginPath();
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, size);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(size, pos);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(212, 165, 116, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, size - 4, size - 4);

        // Draw enemies
        if (this.enemyManager) {
            this.enemyManager.enemies.forEach(enemy => {
                if (enemy.isDead) return;
                const enemyPos = enemy.getPosition();
                const mapPos = this.worldToMap(enemyPos.x, enemyPos.z);

                ctx.fillStyle = '#cc3333';
                ctx.beginPath();
                ctx.arc(mapPos.x, mapPos.y, 2, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw player (triangle pointing in facing direction)
        const playerMapPos = this.worldToMap(this.playerPosition.x, this.playerPosition.z);

        ctx.save();
        ctx.translate(playerMapPos.x, playerMapPos.y);
        ctx.rotate(-this.playerRotation);

        ctx.fillStyle = '#44dd44';
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(-3, 3);
        ctx.lineTo(3, 3);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
}
