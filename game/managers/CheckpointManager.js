// ============================================================
// CheckpointManager.js — 检查点与复活管理
// ============================================================

import gameState from './GameState.js';

class CheckpointManager {
    constructor() {
        this.checkpoints = []; // 所有已注册的检查点
    }

    /**
     * 注册一个检查点
     * @param {string} sceneKey 场景 key
     * @param {number} x
     * @param {number} y
     */
    register(sceneKey, x, y) {
        this.checkpoints.push({ sceneKey, x, y, activated: false });
    }

    /**
     * 激活检查点并保存到 GameState
     */
    activate(sceneKey, x, y) {
        gameState.saveCheckpoint(sceneKey, x, y);
    }

    /**
     * 执行复活：重置玩家状态，返回应该恢复到的场景和位置
     * @returns {{ scene: string, x: number, y: number }}
     */
    respawn() {
        gameState.respawn();
        return gameState.getCheckpoint();
    }

    /**
     * 清除所有注册的检查点（重新开始时用）
     */
    clear() {
        this.checkpoints = [];
    }
}

const checkpointManager = new CheckpointManager();
export default checkpointManager;
