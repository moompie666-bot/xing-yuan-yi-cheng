// ============================================================
// Room1Scene.js — 房间1：出生教学区
// ============================================================

import { GAME_HEIGHT, ROOM_WIDTH, COLORS, DEPTH } from '../utils/Constants.js';
import { BaseRoomScene } from './BaseRoomScene.js';
import gameState from '../managers/GameState.js';
import checkpointManager from '../managers/CheckpointManager.js';

export class Room1Scene extends BaseRoomScene {
    constructor() {
        super({ key: 'Room1Scene' });
    }

    getRoomConfig() {
        return {
            worldWidth: ROOM_WIDTH,
            nextScene: 'Room2Scene',
            bgStarCount: 100,
            bgStarColorSet: [COLORS.STAR, COLORS.STAR_BLUE, COLORS.STAR_PURPLE, COLORS.STAR_DIM],
            bgGlowColor: 0x1122aa,
            bgGlowAlpha: 0.04,
            neonLines: [
                { x: 200,  y: GAME_HEIGHT - 200, length: 60,  vertical: true,  color: COLORS.NEON_CYAN },
                { x: 600,  y: GAME_HEIGHT - 280, length: 40,  vertical: false, color: COLORS.NEON_PINK },
                { x: 1100, y: GAME_HEIGHT - 240, length: 50,  vertical: true,  color: COLORS.NEON_PURPLE },
                { x: 1500, y: GAME_HEIGHT - 180, length: 35,  vertical: false, color: COLORS.NEON_CYAN },
            ],
            initialCheckpoint: { x: 100, y: GAME_HEIGHT - 80 },
        };
    }

    buildRoom() {
        // ---- 平台 ----
        this._addPlatform(0,    GAME_HEIGHT - 32,  ROOM_WIDTH, 32);
        this._addPlatform(300,  GAME_HEIGHT - 100, 128, 16);
        this._addPlatform(500,  GAME_HEIGHT - 170, 128, 16);
        this._addPlatform(750,  GAME_HEIGHT - 130,  96, 16);
        this._addPlatform(1000, GAME_HEIGHT - 200, 128, 16);
        this._addPlatform(1300, GAME_HEIGHT - 160, 128, 16);
        this._addPlatform(1550, GAME_HEIGHT - 100, 160, 16);

        // ---- 教学提示 ----
        this._addHintText(120,  GAME_HEIGHT - 70,  '← → 移动');
        this._addHintText(350,  GAME_HEIGHT - 140, 'Z / ↑ / 空格  跳跃');
        this._addHintText(550,  GAME_HEIGHT - 220, '空中再按跳跃 = 二段跳');
        this._addHintText(800,  GAME_HEIGHT - 180, 'X  近战攻击');
        this._addHintText(1050, GAME_HEIGHT - 250, 'C  远程攻击（消耗能量）');
        this._addHintText(1350, GAME_HEIGHT - 210, 'Shift  冲刺');
        this._addHintText(1600, GAME_HEIGHT - 150, '→  前往下一区域');
    }

    onPlayerCreated() {
        // ---- 检查点 ----
        this._addCheckpoint(900, GAME_HEIGHT - 52, 'Room1Scene', 900, GAME_HEIGHT - 80);

        // 确保第一次进入时激活默认检查点
        const cp = gameState.getCheckpoint();
        if (cp.scene !== 'Room1Scene') {
            checkpointManager.activate('Room1Scene', 100, GAME_HEIGHT - 80);
        }
    }
}
