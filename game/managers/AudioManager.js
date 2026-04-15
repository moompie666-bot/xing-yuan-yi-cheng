// ============================================================
// AudioManager.js — 音效管理器（接口预留）
// ============================================================

class AudioManager {
    constructor() {
        this.sounds = {};
        this.volume = 1.0;
        this.muted = false;
    }

    /**
     * 注册音效（后续接入真实音频时使用）
     * @param {string} key   音效标识
     * @param {object} sound Phaser Sound 对象
     */
    register(key, sound) {
        this.sounds[key] = sound;
    }

    /**
     * 播放音效
     * @param {string} key 音效标识
     * @param {object} config 可选播放配置
     */
    play(key, config = {}) {
        if (this.muted) return;
        const sound = this.sounds[key];
        if (sound) {
            sound.play({ volume: this.volume, ...config });
        }
        // 未注册的 key 静默忽略（当前全部为空操作）
    }

    stop(key) {
        const sound = this.sounds[key];
        if (sound) sound.stop();
    }

    stopAll() {
        Object.values(this.sounds).forEach(s => s.stop());
    }

    setVolume(v) {
        this.volume = Phaser.Math.Clamp(v, 0, 1);
    }

    toggleMute() {
        this.muted = !this.muted;
    }
}

const audioManager = new AudioManager();
export default audioManager;
