// ============================================================
// GameState.js — 全局游戏状态（单例）
// ============================================================

import { PLAYER } from '../utils/Constants.js';

class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.hp = PLAYER.MAX_HP;
        this.maxHp = PLAYER.MAX_HP;
        this.energy = PLAYER.MAX_ENERGY;
        this.maxEnergy = PLAYER.MAX_ENERGY;

        // 已解锁能力
        this.abilities = {
            doubleJump: true,    // Demo 中默认可用
            wallJump: true,      // Demo 中默认可用
            phaseShift: false,   // 房间4 获取
        };

        // 检查点
        this.checkpoint = {
            scene: 'Room1Scene',
            x: 100,
            y: 500,
        };

        // Boss 战状态
        this.bossActive = false;
        this.bossHp = 0;
        this.bossMaxHp = 0;

        // 游戏流程
        this.currentRoom = 'Room1Scene';
        this.gameOver = false;
        this.victory = false;
    }

    // 保存检查点
    saveCheckpoint(sceneKey, x, y) {
        this.checkpoint.scene = sceneKey;
        this.checkpoint.x = x;
        this.checkpoint.y = y;
    }

    // 获取检查点
    getCheckpoint() {
        return { ...this.checkpoint };
    }

    // 解锁能力
    unlockAbility(name) {
        if (this.abilities.hasOwnProperty(name)) {
            this.abilities[name] = true;
        }
    }

    hasAbility(name) {
        return !!this.abilities[name];
    }

    // 扣血
    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
        return this.hp <= 0;
    }

    // 回血
    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    // 消耗能量
    useEnergy(amount) {
        if (this.energy >= amount) {
            this.energy -= amount;
            return true;
        }
        return false;
    }

    // 恢复能量
    regenEnergy(amount) {
        this.energy = Math.min(this.maxEnergy, this.energy + amount);
    }

    // 玩家死亡后重置为检查点状态
    respawn() {
        this.hp = this.maxHp;
        this.energy = this.maxEnergy;
        this.gameOver = false;
    }

    // Boss 相关
    startBoss(maxHp) {
        this.bossActive = true;
        this.bossHp = maxHp;
        this.bossMaxHp = maxHp;
    }

    updateBossHp(hp) {
        this.bossHp = Math.max(0, hp);
    }

    endBoss() {
        this.bossActive = false;
        this.bossHp = 0;
    }
}

// 单例导出
const gameState = new GameState();
export default gameState;
