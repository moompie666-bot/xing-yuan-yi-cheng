// ============================================================
// HUDScene.js — HUD 叠加场景（UI美化版）
// ============================================================

import { GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, PLAYER as PC, BOSS as BC } from '../utils/Constants.js';
import gameState from '../managers/GameState.js';

export class HUDScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HUDScene' });
    }

    create() {
        // ---- 玩家血量条 ----
        // 外框
        this.hpBarBorder = this.add.rectangle(19, 19, 164, 20, 0x000000, 0)
            .setStrokeStyle(1, COLORS.HP_BAR_BORDER, 0.6)
            .setOrigin(0, 0).setDepth(DEPTH.HUD);
        this.hpBarBg = this.add.rectangle(20, 20, 162, 18, COLORS.HP_BAR_BG, 0.7)
            .setOrigin(0, 0).setDepth(DEPTH.HUD);
        this.hpBar = this.add.rectangle(21, 21, 160, 16, COLORS.HP_BAR, 1)
            .setOrigin(0, 0).setDepth(DEPTH.HUD);
        // 血量高光
        this.hpBarHighlight = this.add.rectangle(21, 21, 160, 4, 0xffffff, 0.15)
            .setOrigin(0, 0).setDepth(DEPTH.HUD);
        this.hpText = this.add.text(101, 22, '', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0).setDepth(DEPTH.HUD);
        // HP 图标
        this.add.text(20, 4, '♥ HP', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#55cc77',
            stroke: '#000000', strokeThickness: 1,
        }).setDepth(DEPTH.HUD);

        // ---- 能量条 ----
        this.energyBarBorder = this.add.rectangle(GAME_WIDTH - 183, 19, 164, 20, 0x000000, 0)
            .setStrokeStyle(1, COLORS.ENERGY_BAR_BORDER, 0.6)
            .setOrigin(0, 0).setDepth(DEPTH.HUD);
        this.energyBarBg = this.add.rectangle(GAME_WIDTH - 182, 20, 162, 18, COLORS.HP_BAR_BG, 0.7)
            .setOrigin(0, 0).setDepth(DEPTH.HUD);
        this.energyBar = this.add.rectangle(GAME_WIDTH - 181, 21, 160, 16, COLORS.ENERGY_BAR, 1)
            .setOrigin(0, 0).setDepth(DEPTH.HUD);
        this.energyBarHighlight = this.add.rectangle(GAME_WIDTH - 181, 21, 160, 4, 0xffffff, 0.12)
            .setOrigin(0, 0).setDepth(DEPTH.HUD);
        this.energyText = this.add.text(GAME_WIDTH - 101, 22, '', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0).setDepth(DEPTH.HUD);
        this.add.text(GAME_WIDTH - 182, 4, '⚡ ENERGY', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#5599cc',
            stroke: '#000000', strokeThickness: 1,
        }).setDepth(DEPTH.HUD);

        // ---- Boss 血条（默认隐藏） ----
        this.bossBarContainer = this.add.container(GAME_WIDTH / 2, 52);
        this.bossBarContainer.setDepth(DEPTH.HUD);
        this.bossBarContainer.setVisible(false);

        const bossBarW = 420;
        // Boss 血条外框
        const bossBorder = this.add.rectangle(0, 0, bossBarW + 4, 18, 0x000000, 0)
            .setStrokeStyle(1.5, COLORS.BOSS_HP_BORDER, 0.7);
        this.bossBarBg = this.add.rectangle(0, 0, bossBarW, 14, COLORS.HP_BAR_BG, 0.7);
        this.bossBarFill = this.add.rectangle(-bossBarW / 2, 0, bossBarW, 14, COLORS.BOSS_HP_BAR, 1)
            .setOrigin(0, 0.5);
        // Boss血条高光
        const bossHighlight = this.add.rectangle(-bossBarW / 2, -3, bossBarW, 3, 0xffffff, 0.1)
            .setOrigin(0, 0.5);
        this.bossNameText = this.add.text(0, -22, '「相位监察者」', {
            fontFamily: 'Courier New', fontSize: '14px', color: '#cc88ff',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);

        this.bossBarContainer.add([bossBorder, this.bossBarBg, this.bossBarFill, bossHighlight, this.bossNameText]);

        // ---- 死亡提示 ----
        this.deathOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0);
        this.deathOverlay.setDepth(DEPTH.HUD - 1).setVisible(false);
        this.deathText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, '— 系统崩溃 —', {
            fontFamily: 'Courier New', fontSize: '30px', color: '#ff3344',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(DEPTH.HUD).setVisible(false);
        this.respawnText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 15, '正在从检查点恢复...', {
            fontFamily: 'Courier New', fontSize: '14px', color: '#778899',
            stroke: '#000000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(DEPTH.HUD).setVisible(false);

        // ---- 房间名提示 ----
        this.roomNameText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 22, '', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#556677',
            stroke: '#000000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(DEPTH.HUD).setAlpha(0.6);

        // ---- 按键提示面板（左下角） ----
        this.keyHintText = this.add.text(10, GAME_HEIGHT - 16, '', {
            fontFamily: 'Courier New', fontSize: '9px', color: '#445566',
        }).setDepth(DEPTH.HUD).setAlpha(0.5);

        this.deathShowing = false;

        // 监听事件
        this._listenRoomEvents();
    }

    update(time, delta) {
        // 更新血量条
        const hpRatio = gameState.hp / gameState.maxHp;
        const hpWidth = 160 * Math.max(0, hpRatio);
        this.hpBar.setDisplaySize(hpWidth, 16);
        this.hpBarHighlight.setDisplaySize(hpWidth, 4);
        this.hpText.setText(`${Math.ceil(gameState.hp)}/${gameState.maxHp}`);

        // 血量颜色分级
        if (hpRatio < 0.25) {
            this.hpBar.setFillStyle(0xff2222);
            // 低血量闪烁
            this.hpBar.setAlpha(0.7 + Math.sin(time * 0.008) * 0.3);
        } else if (hpRatio < 0.5) {
            this.hpBar.setFillStyle(0xffaa33);
            this.hpBar.setAlpha(1);
        } else {
            this.hpBar.setFillStyle(COLORS.HP_BAR);
            this.hpBar.setAlpha(1);
        }

        // 更新能量条
        const enRatio = gameState.energy / gameState.maxEnergy;
        const enWidth = 160 * Math.max(0, enRatio);
        this.energyBar.setDisplaySize(enWidth, 16);
        this.energyBarHighlight.setDisplaySize(enWidth, 4);
        this.energyText.setText(`${Math.ceil(gameState.energy)}/${gameState.maxEnergy}`);

        // 低能量颜色
        if (enRatio < 0.2) {
            this.energyBar.setFillStyle(0x993333);
        } else {
            this.energyBar.setFillStyle(COLORS.ENERGY_BAR);
        }

        // Boss 血条
        if (gameState.bossActive) {
            this.bossBarContainer.setVisible(true);
            const bossRatio = gameState.bossHp / gameState.bossMaxHp;
            this.bossBarFill.setDisplaySize(420 * Math.max(0, bossRatio), 14);

            // Boss血条颜色随血量变化
            if (bossRatio < 0.3) {
                this.bossBarFill.setFillStyle(0xff2222);
            } else if (bossRatio < 0.6) {
                this.bossBarFill.setFillStyle(0xff6644);
            } else {
                this.bossBarFill.setFillStyle(COLORS.BOSS_HP_BAR);
            }
        } else {
            this.bossBarContainer.setVisible(false);
        }

        // 死亡 UI
        if (gameState.gameOver && !this.deathShowing) {
            this._showDeathUI();
        }

        // 房间名
        const roomNames = {
            'Room1Scene': '坠落港区 · 教学区',
            'Room2Scene': '坠落港区 · 平台区',
            'Room3Scene': '裂环城区 · 战斗区',
            'Room4Scene': '裂环城区 · 核心区',
            'Room5Scene': '裂环城区 · Boss 竞技场',
        };
        this.roomNameText.setText(roomNames[gameState.currentRoom] || '');

        // 按键提示
        const keyHints = gameState.bossActive ?
            'Z:跳 X:斩 C:射 Shift:冲刺' :
            'Z/↑/空格:跳 X:斩 C:射 Shift:冲刺';
        this.keyHintText.setText(keyHints);
    }

    _showDeathUI() {
        this.deathShowing = true;
        this.deathOverlay.setVisible(true).setAlpha(0);
        this.deathText.setVisible(true).setAlpha(0);
        this.respawnText.setVisible(true).setAlpha(0);

        this.tweens.add({ targets: this.deathOverlay, alpha: 0.65, duration: 400 });
        this.tweens.add({ targets: this.deathText, alpha: 1, y: this.deathText.y - 10, duration: 400, ease: 'Back' });
        this.tweens.add({ targets: this.respawnText, alpha: 1, duration: 300, delay: 400 });

        this.time.delayedCall(1400, () => {
            this.tweens.add({
                targets: [this.deathOverlay, this.deathText, this.respawnText],
                alpha: 0, duration: 300,
                onComplete: () => {
                    this.deathOverlay.setVisible(false);
                    this.deathText.setVisible(false).setY(GAME_HEIGHT / 2 - 30);
                    this.respawnText.setVisible(false);
                    this.deathShowing = false;
                },
            });
        });
    }

    _listenRoomEvents() {
        const scenes = ['Room1Scene', 'Room2Scene', 'Room3Scene', 'Room4Scene', 'Room5Scene'];
        scenes.forEach(key => {
            const sceneObj = this.scene.get(key);
            if (sceneObj) {
                sceneObj.events.on('player-death', () => {
                    if (!this.deathShowing) this._showDeathUI();
                });
            }
        });
    }
}
