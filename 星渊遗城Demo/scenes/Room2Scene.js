// ============================================================
// Room2Scene.js — 房间2：平台跳跃区
// ============================================================

import { GAME_HEIGHT, ROOM_WIDTH, COLORS, DEPTH } from '../utils/Constants.js';
import { BaseRoomScene } from './BaseRoomScene.js';
import checkpointManager from '../managers/CheckpointManager.js';

export class Room2Scene extends BaseRoomScene {
    constructor() {
        super({ key: 'Room2Scene' });
    }

    getRoomConfig() {
        return {
            worldWidth: ROOM_WIDTH,
            nextScene: 'Room3Scene',
            bgStarCount: 80,
            bgStarColorSet: [COLORS.STAR, COLORS.STAR_BLUE, COLORS.STAR_DIM],
            bgGlowColor: 0x111133,
            bgGlowAlpha: 0.06,
            neonLines: [
                { x: 300,  y: GAME_HEIGHT - 250, length: 45, vertical: true,  color: COLORS.NEON_PINK },
                { x: 700,  y: GAME_HEIGHT - 350, length: 55, vertical: false, color: COLORS.NEON_CYAN },
                { x: 1200, y: GAME_HEIGHT - 300, length: 40, vertical: true,  color: COLORS.NEON_PURPLE },
            ],
            initialCheckpoint: { x: 60, y: GAME_HEIGHT - 80 },
        };
    }

    buildRoom() {
        // ---- 地面（有断裂）----
        this._addPlatform(0,    GAME_HEIGHT - 32, 400, 32);
        this._addPlatform(500,  GAME_HEIGHT - 32, 300, 32);
        this._addPlatform(1100, GAME_HEIGHT - 32, 300, 32);
        this._addPlatform(1600, GAME_HEIGHT - 32, 448, 32);

        // 悬浮平台
        this._addPlatform(350,  GAME_HEIGHT - 130,  96, 16);
        this._addPlatform(520,  GAME_HEIGHT - 230,  96, 16);
        this._addPlatform(700,  GAME_HEIGHT - 300,  80, 16);
        this._addPlatform(880,  GAME_HEIGHT - 200,  96, 16);
        this._addPlatform(1050, GAME_HEIGHT - 280,  80, 16);
        this._addPlatform(1250, GAME_HEIGHT - 350,  80, 16);
        this._addPlatform(1400, GAME_HEIGHT - 250,  96, 16);
        this._addPlatform(1550, GAME_HEIGHT - 160,  96, 16);

        // 墙壁（供墙跳）
        this._addWall(460,  GAME_HEIGHT - 180, 24, 220);
        this._addWall(840,  GAME_HEIGHT - 250, 24, 280);
        this._addWall(1150, GAME_HEIGHT - 200, 24, 200);

        // ---- 尖刺陷阱 ----
        this.spikes = this.physics.add.staticGroup();
        this._addSpikes(400,  GAME_HEIGHT - 32, 100, this.spikes);
        this._addSpikes(800,  GAME_HEIGHT - 32, 300, this.spikes);
        this._addSpikes(1400, GAME_HEIGHT - 32, 200, this.spikes);

        // ---- 教学提示 ----
        this._addHintText(200, GAME_HEIGHT - 80,  '注意断裂！用二段跳越过');
        this._addHintText(500, GAME_HEIGHT - 280, '靠近墙壁 + 方向键 = 墙滑');
        this._addHintText(860, GAME_HEIGHT - 320, '墙滑时按跳跃 = 墙跳');
    }

    onPlayerCreated() {
        // ---- 尖刺伤害（含碰撞冷却）----
        this._spikeHitTimer = 0;
        this.physics.add.overlap(this.player, this.spikes, () => {
            if (this._spikeHitTimer <= 0) {
                this.player.takeDamage(25, 0);
                this._spikeHitTimer = 500;
            }
        });

        // ---- 检查点 ----
        this._addCheckpoint(1150, GAME_HEIGHT - 52, 'Room2Scene', 1150, GAME_HEIGHT - 80);
    }

    onUpdate(time, delta) {
        if (this._spikeHitTimer > 0) this._spikeHitTimer -= delta;
    }
}
