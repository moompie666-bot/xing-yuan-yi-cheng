// ============================================================
// Room4Scene.js — 房间4：能力获取区
// ============================================================

import { GAME_WIDTH, GAME_HEIGHT, ROOM_WIDTH, COLORS, DEPTH } from '../utils/Constants.js';
import { BaseRoomScene } from './BaseRoomScene.js';
import { Effects } from '../utils/Effects.js';
import gameState from '../managers/GameState.js';
import checkpointManager from '../managers/CheckpointManager.js';

export class Room4Scene extends BaseRoomScene {
    constructor() {
        super({ key: 'Room4Scene' });
    }

    getRoomConfig() {
        return {
            worldWidth: ROOM_WIDTH,
            nextScene: 'Room5Scene',
            bgStarCount: 60,
            bgStarColorSet: [COLORS.STAR, COLORS.STAR_PURPLE, COLORS.STAR_DIM],
            bgGlowColor: 0x220044,
            bgGlowAlpha: 0.12,
            neonLines: [
                { x: 400,  y: GAME_HEIGHT - 300, length: 50, vertical: true,  color: COLORS.NEON_PURPLE },
                { x: 900,  y: GAME_HEIGHT - 250, length: 45, vertical: false, color: COLORS.NEON_CYAN },
                { x: 1500, y: GAME_HEIGHT - 200, length: 40, vertical: true,  color: COLORS.NEON_PINK },
            ],
            initialCheckpoint: { x: 60, y: GAME_HEIGHT - 80 },
        };
    }

    buildRoom() {
        // ---- 平台 ----
        this._addPlatform(0,    GAME_HEIGHT - 32,  800, 32);
        this._addPlatform(900,  GAME_HEIGHT - 32,  300, 32);
        this._addPlatform(1300, GAME_HEIGHT - 32,  748, 32);
        this._addPlatform(350,  GAME_HEIGHT - 150, 128, 16);
        this._addPlatform(600,  GAME_HEIGHT - 250,  96, 16);
        this._addPlatform(1050, GAME_HEIGHT - 200, 128, 16);
        this._addPlatform(1400, GAME_HEIGHT - 160, 128, 16);
        this._addPlatform(1600, GAME_HEIGHT - 250,  96, 16);
        this._addPlatform(1800, GAME_HEIGHT - 150, 128, 16);

        // ---- 相位墙 ----
        this.phaseWalls = this.physics.add.staticGroup();
        this._addPhaseWall(1200, GAME_HEIGHT - 32,  24, 200);
        this._addPhaseWall(1550, GAME_HEIGHT - 140, 24, 110);
    }

    onPlayerCreated() {
        // ---- 相位墙碰撞器 ----
        this.phaseWallCollider = this.physics.add.collider(this.player, this.phaseWalls);

        // ---- 能力道具 ----
        this.abilityPickedUp = gameState.hasAbility('phaseShift');
        if (!this.abilityPickedUp) {
            this.abilityItem = this.physics.add.staticSprite(650, GAME_HEIGHT - 300, 'ability_pickup');
            this.abilityItem.setDisplaySize(36, 36);
            this.abilityItem.setDepth(DEPTH.PLATFORMS);
            this.tweens.add({
                targets: this.abilityItem, y: this.abilityItem.y - 12,
                duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            this._abilityGlow = this.add.circle(650, GAME_HEIGHT - 300, 22, COLORS.ABILITY_PICKUP, 0.15);
            this._abilityGlow.setDepth(DEPTH.PLATFORMS - 1);
            this.tweens.add({
                targets: this._abilityGlow, scaleX: 1.5, scaleY: 1.5, alpha: 0.05,
                duration: 1200, yoyo: true, repeat: -1,
            });
            this.physics.add.overlap(this.player, this.abilityItem, () => this._pickupAbility());

            this._addHintText(500, GAME_HEIGHT - 340, '▲ 获取上方的能力核心', '#ffcc00');
        }

        this._addHintText(1200, GAME_HEIGHT - 260, '紫色墙壁需要相位冲刺穿透', '#8844ff');

        // ---- 检查点 ----
        this._addCheckpoint(100, GAME_HEIGHT - 52, 'Room4Scene', 100, GAME_HEIGHT - 80);
        const cp = gameState.getCheckpoint();
        if (cp.scene !== 'Room4Scene') {
            checkpointManager.activate('Room4Scene', 100, GAME_HEIGHT - 80);
        }
    }

    onUpdate(time, delta) {
        // 相位冲刺穿墙
        if (this.phaseWallCollider) {
            this.phaseWallCollider.active = !(this.player.isDashing && this.player.isPhaseShifting);
        }

        // 相位墙闪烁
        this.phaseWalls.children.each(w => {
            if (w.active) w.setAlpha(0.35 + Math.sin(this.time.now / 300) * 0.15);
        });

        // 能力光环跟踪
        if (this._abilityGlow && this.abilityItem && this.abilityItem.active) {
            this._abilityGlow.setPosition(this.abilityItem.x, this.abilityItem.y);
        }
    }

    _addPhaseWall(x, y, w, h) {
        const wall = this.add.tileSprite(x + w / 2, y + h / 2, w, h, 'phase_wall_tile');
        wall.setDepth(DEPTH.PLATFORMS);
        this.physics.add.existing(wall, true);
        this.phaseWalls.add(wall);
        return wall;
    }

    _pickupAbility() {
        if (this.abilityPickedUp) return;
        this.abilityPickedUp = true;
        gameState.unlockAbility('phaseShift');

        Effects.abilityFlash(this, this.abilityItem.x, this.abilityItem.y);
        this.abilityItem.destroy();
        if (this._abilityGlow) this._abilityGlow.destroy();

        const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, 70, 0x000000, 0.8);
        bg.setScrollFactor(0).setDepth(DEPTH.HUD);
        const border1 = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 35, GAME_WIDTH, 2, COLORS.ABILITY_PICKUP, 0.5);
        border1.setScrollFactor(0).setDepth(DEPTH.HUD);
        const border2 = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 35, GAME_WIDTH, 2, COLORS.ABILITY_PICKUP, 0.5);
        border2.setScrollFactor(0).setDepth(DEPTH.HUD);
        const txt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '✦ 新能力已获得：相位冲刺 ✦\n冲刺时可穿透紫色屏障', {
            fontFamily: 'Courier New', fontSize: '18px', color: '#ffcc00',
            align: 'center', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD);

        this.time.delayedCall(3000, () => {
            this.tweens.add({
                targets: [bg, txt, border1, border2], alpha: 0, duration: 500,
                onComplete: () => { bg.destroy(); txt.destroy(); border1.destroy(); border2.destroy(); },
            });
        });
        this.cameras.main.flash(500, 255, 204, 0);
    }

    // Room4 死亡后重启场景
    _handleDeath() {
        this.time.delayedCall(1500, () => {
            this.player.cleanup();
            this.scene.restart();
        });
    }
}
