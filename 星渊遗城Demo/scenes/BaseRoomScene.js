// ============================================================
// BaseRoomScene.js — 房间场景基类
// 提取所有 Room 场景共用的平台、墙壁、背景、出口、摄像机、死亡逻辑
// ============================================================

import { GAME_WIDTH, GAME_HEIGHT, ROOM_WIDTH, COLORS, DEPTH } from '../utils/Constants.js';
import { Player } from '../entities/Player.js';
import gameState from '../managers/GameState.js';
import checkpointManager from '../managers/CheckpointManager.js';

export class BaseRoomScene extends Phaser.Scene {

    // ----------------------------------------------------------------
    // 子类须重写：返回该房间的配置 (可选字段均有默认值)
    // {
    //   worldWidth: number,          // 世界宽度，默认 ROOM_WIDTH
    //   worldHeight: number,         // 世界高度，默认 GAME_HEIGHT
    //   nextScene: string,           // 出口目标场景名
    //   bgStarCount: number,         // 星空数量
    //   bgStarColorSet: number[],    // 星空颜色数组
    //   bgGlowColor: number,         // 背景氛围光颜色
    //   bgGlowAlpha: number,
    //   neonLines: Array,            // [{x,y,length,vertical,color}]
    //   cameraFollowX: number,       // 摄像机跟随灵敏度 X
    //   cameraFollowY: number,
    //   cameraDeadzoneX: number,
    //   cameraDeadzoneY: number,
    //   cameraFadeIn: number,        // 淡入时长
    //   initialCheckpoint: {x,y},   // 默认检查点位置
    // }
    getRoomConfig() { return {}; }

    // ----------------------------------------------------------------
    // 子类须重写：建造房间特有内容（在公共初始化之后调用）
    // ----------------------------------------------------------------
    buildRoom() {}

    // ----------------------------------------------------------------
    // 共用 create
    // ----------------------------------------------------------------
    create() {
        this._transitioning = false;

        const cfg = this._buildConfig();

        this.physics.world.setBounds(0, 0, cfg.worldWidth, cfg.worldHeight);

        // 背景
        this._createBackground(cfg);

        // 静态平台/墙壁组（子类通过 _addPlatform / _addWall 填充）
        this.platforms = this.physics.add.staticGroup();
        this.walls     = this.physics.add.staticGroup();

        // 给子类机会添加平台、墙壁、敌人、特殊元素等
        this.buildRoom();

        // 玩家
        const cp = gameState.getCheckpoint();
        const sceneName = this.scene.key;
        const startX = cp.scene === sceneName ? cp.x : cfg.initialCheckpoint.x;
        const startY = cp.scene === sceneName ? cp.y : cfg.initialCheckpoint.y;
        this.player = new Player(this, startX, startY);
        this.physics.add.collider(this.player, this.platforms);
        if (this.walls.getLength() > 0) {
            this.physics.add.collider(this.player, this.walls);
        }

        // 给子类机会在玩家创建后绑定碰撞（如敌人、相位墙等）
        this.onPlayerCreated();

        // 出口
        if (cfg.nextScene) {
            this._setupExit(cfg);
        }

        // 摄像机
        this.cameras.main.setBounds(0, 0, cfg.worldWidth, cfg.worldHeight);
        this.cameras.main.startFollow(this.player, true, cfg.cameraFollowX, cfg.cameraFollowY);
        this.cameras.main.setDeadzone(cfg.cameraDeadzoneX, cfg.cameraDeadzoneY);
        this.cameras.main.setBackgroundColor(COLORS.BG_DEEP);
        this.cameras.main.fadeIn(cfg.cameraFadeIn);

        // 死亡事件
        this.events.on('player-death', () => this._handleDeath());

        // 设置默认检查点
        if (cp.scene !== sceneName) {
            checkpointManager.activate(sceneName, cfg.initialCheckpoint.x, cfg.initialCheckpoint.y);
        }

        gameState.currentRoom = sceneName;
        gameState.bossActive = false;
    }

    // 子类可重写，处理玩家创建后的碰撞绑定
    onPlayerCreated() {}

    // ----------------------------------------------------------------
    // 公共 update
    // ----------------------------------------------------------------
    update(time, delta) {
        if (this.player && this.player.active) {
            this.player.update(time, delta);
        }
        this.onUpdate(time, delta);
    }

    // 子类可重写
    onUpdate(time, delta) {}

    // ----------------------------------------------------------------
    // 合并配置
    // ----------------------------------------------------------------
    _buildConfig() {
        const defaults = {
            worldWidth: ROOM_WIDTH,
            worldHeight: GAME_HEIGHT,
            nextScene: null,
            bgStarCount: 80,
            bgStarColorSet: [COLORS.STAR, COLORS.STAR_BLUE, COLORS.STAR_PURPLE, COLORS.STAR_DIM],
            bgGlowColor: 0x1122aa,
            bgGlowAlpha: 0.04,
            neonLines: [],
            cameraFollowX: 0.06,
            cameraFollowY: 0.06,
            cameraDeadzoneX: 40,
            cameraDeadzoneY: 20,
            cameraFadeIn: 400,
            initialCheckpoint: { x: 100, y: GAME_HEIGHT - 80 },
        };
        return Object.assign(defaults, this.getRoomConfig());
    }

    // ----------------------------------------------------------------
    // 平台 / 墙壁 / 尖刺 辅助方法
    // ----------------------------------------------------------------

    /** 添加平台（tileSprite + 美术tile纹理，自动加入 this.platforms）*/
    _addPlatform(x, y, w, h) {
        const plat = this.add.tileSprite(x + w / 2, y + h / 2, w, h, 'platform_tile');
        plat.setDepth(DEPTH.PLATFORMS);
        this.physics.add.existing(plat, true);
        this.platforms.add(plat);
        return plat;
    }

    /** 添加墙壁（tileSprite + 美术tile纹理，自动加入 this.walls）*/
    _addWall(x, y, w, h) {
        const wall = this.add.tileSprite(x + w / 2, y + h / 2, w, h, 'wall_tile');
        wall.setDepth(DEPTH.PLATFORMS);
        this.physics.add.existing(wall, true);
        this.walls.add(wall);
        return wall;
    }

    /** 添加尖刺行（每32px一个，返回静态组）*/
    _addSpikes(x, y, width, group) {
        const target = group || (this.spikes = this.spikes || this.physics.add.staticGroup());
        const count = Math.floor(width / 32);
        for (let i = 0; i < count; i++) {
            const spike = this.add.sprite(x + i * 32 + 16, y - 16, 'spike');
            spike.setDisplaySize(32, 32);
            this.physics.add.existing(spike, true);
            spike.body.setSize(24, 16);
            spike.body.setOffset(4, 16);
            spike.setDepth(DEPTH.PLATFORMS);
            target.add(spike);
        }
        return target;
    }

    /** 添加检查点精灵并绑定 overlap */
    _addCheckpoint(x, y, sceneKey, cpX, cpY) {
        const cpY2 = cpY !== undefined ? cpY : y - 8;
        const sprite = this.physics.add.staticSprite(x, y, 'checkpoint');
        sprite.setDisplaySize(28, 52);
        sprite.setDepth(DEPTH.PLATFORMS);

        const cp = gameState.getCheckpoint();
        let activated = cp.scene === sceneKey && cp.x === cpX;
        if (activated) sprite.setTint(COLORS.CHECKPOINT_ACTIVE);

        this.physics.add.overlap(this.player, sprite, () => {
            if (!activated) {
                activated = true;
                sprite.setTint(COLORS.CHECKPOINT_ACTIVE);
                checkpointManager.activate(sceneKey, cpX, cpY2);
                this._showHint('检查点已激活', 1500);
            }
        });
        return sprite;
    }

    // ----------------------------------------------------------------
    // 出口设置
    // ----------------------------------------------------------------
    _setupExit(cfg) {
        const exitX = cfg.worldWidth - 16;
        this.exitZone = this.add.zone(exitX, GAME_HEIGHT / 2, 32, GAME_HEIGHT);
        this.physics.add.existing(this.exitZone, true);
        this.physics.add.overlap(this.player, this.exitZone, () => this._goToNextRoom(cfg.nextScene));

        const exitGlow = this.add.rectangle(cfg.worldWidth - 8, GAME_HEIGHT / 2, 6, 120, COLORS.DOOR, 0.3);
        exitGlow.setDepth(DEPTH.BG_NEAR);
        this.tweens.add({ targets: exitGlow, alpha: 0.1, duration: 1000, yoyo: true, repeat: -1 });
    }

    // ----------------------------------------------------------------
    // 背景生成
    // ----------------------------------------------------------------
    _createBackground(cfg) {
        const W = cfg.worldWidth;
        const H = cfg.worldHeight;

        // ---- AI 生成的背景图（最底层，全场景拉伸覆盖）----
        if (this.textures.exists('bg_main')) {
            // 用两张背景图横向拼接覆盖 ROOM_WIDTH（图片是1536x1024，缩放至640高）
            const bgScale = H / 1024;
            const bgW = 1536 * bgScale; // 约960px宽
            const tilesNeeded = Math.ceil(W / bgW) + 1;
            for (let i = 0; i < tilesNeeded; i++) {
                const bg = this.add.image(i * bgW + bgW / 2, H / 2, 'bg_main');
                bg.setScale(bgScale);
                bg.setDepth(DEPTH.BG_FAR - 2);
                bg.setScrollFactor(0.08); // 视差：缓慢移动
                bg.setAlpha(0.88);
            }
        }

        // ---- 星云光晕（叠加在背景图上，增强氛围）----
        const nebula1 = this.add.circle(W * 0.25, H * 0.35, H * 0.5, 0x0011aa, 0.04);
        nebula1.setDepth(DEPTH.BG_FAR - 1).setScrollFactor(0.01);
        const nebula2 = this.add.circle(W * 0.72, H * 0.4, H * 0.4, 0x220044, 0.05);
        nebula2.setDepth(DEPTH.BG_FAR - 1).setScrollFactor(0.015);

        // ---- 深层静态远星（极小、极暗，几乎不动）----
        for (let i = 0; i < 120; i++) {
            const sx = Math.random() * W;
            const sy = Math.random() * H;
            const size = Math.random() * 0.8;
            const s = this.add.circle(sx, sy, size, 0xffffff, 0.08 + Math.random() * 0.12);
            s.setDepth(DEPTH.BG_FAR - 1).setScrollFactor(0.01 + Math.random() * 0.01);
        }

        // ---- 中层闪烁星（主星空层）----
        const starColors = cfg.bgStarColorSet;
        for (let i = 0; i < cfg.bgStarCount; i++) {
            const sx    = Math.random() * W;
            const sy    = Math.random() * H * 0.85;
            const size  = 0.5 + Math.random() * 1.8;
            const color = starColors[Math.floor(Math.random() * starColors.length)];
            const alpha = 0.2 + Math.random() * 0.5;
            const star  = this.add.circle(sx, sy, size, color, alpha);
            star.setDepth(DEPTH.BG_FAR);
            star.setScrollFactor(0.03 + Math.random() * 0.06);
            // 闪烁
            this.tweens.add({
                targets: star,
                alpha: { from: alpha, to: alpha * 0.15 },
                duration: 1000 + Math.random() * 3000,
                yoyo: true, repeat: -1,
                delay: Math.random() * 2000,
                ease: 'Sine.easeInOut',
            });
        }

        // ---- 亮星（少量大一点的特亮星，带十字光芒）----
        for (let i = 0; i < 12; i++) {
            const sx = Math.random() * W;
            const sy = Math.random() * H * 0.7;
            const col = [0xffffff, 0xaaddff, 0xffeecc, 0xddaaff][Math.floor(Math.random() * 4)];
            // 圆形核心
            const core = this.add.circle(sx, sy, 1.5, col, 0.9);
            core.setDepth(DEPTH.BG_FAR + 1).setScrollFactor(0.05);
            // 水平光芒
            const h1 = this.add.rectangle(sx, sy, 8, 1, col, 0.35);
            h1.setDepth(DEPTH.BG_FAR + 1).setScrollFactor(0.05);
            // 垂直光芒
            const v1 = this.add.rectangle(sx, sy, 1, 8, col, 0.35);
            v1.setDepth(DEPTH.BG_FAR + 1).setScrollFactor(0.05);
            // 核心脉冲
            this.tweens.add({
                targets: core, alpha: 0.3, scaleX: 1.5, scaleY: 1.5,
                duration: 1500 + Math.random() * 2000,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                delay: Math.random() * 1500,
            });
        }

        // ---- 流星（周期性划过）----
        this._startMeteorShower(W, H);

        // ---- 氛围光（场景主色调）----
        const glow = this.add.circle(W * 0.5, H * 0.4, Math.min(W, H) * 0.45, cfg.bgGlowColor, cfg.bgGlowAlpha);
        glow.setDepth(DEPTH.BG_FAR).setScrollFactor(0.02);
        // 氛围光缓慢脉冲
        this.tweens.add({
            targets: glow,
            alpha: cfg.bgGlowAlpha * 0.4,
            duration: 4000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // ---- 废墟剪影（中景）----
        const ruinCount = Math.floor(W / 240);
        for (let i = 0; i < ruinCount; i++) {
            const bx = i * 240 + Math.random() * 80;
            const bh = 40 + Math.random() * 180;
            const bw = 20 + Math.random() * 70;
            const ruin = this.add.rectangle(bx, H - bh / 2 - 32, bw, bh, 0x080818, 0.75);
            ruin.setDepth(DEPTH.BG_MID).setScrollFactor(0.15 + Math.random() * 0.1);
            // 废墟顶部偶尔有一盏红色警示灯
            if (Math.random() > 0.6) {
                const lamp = this.add.circle(bx, H - bh - 32, 2, 0xff2200, 0.7);
                lamp.setDepth(DEPTH.BG_MID + 1).setScrollFactor(0.15);
                this.tweens.add({
                    targets: lamp, alpha: 0.1,
                    duration: 800 + Math.random() * 600, yoyo: true, repeat: -1,
                });
            }
        }

        // ---- 霓虹灯条 ----
        cfg.neonLines.forEach(nl => this._addNeonLine(nl.x, nl.y, nl.length, nl.vertical, nl.color));

        // ---- 破损管道装饰 ----
        const pipeCount = Math.floor(W / 500);
        for (let i = 0; i < pipeCount; i++) {
            const px   = 150 + i * 500 + Math.random() * 100;
            const pipe = this.add.rectangle(px, H - 48, 40 + Math.random() * 60, 4, COLORS.RUST, 0.35);
            pipe.setDepth(DEPTH.BG_DECO).setScrollFactor(0.38);
            const joint = this.add.circle(px + pipe.width / 2, H - 48, 3, 0x554433, 0.5);
            joint.setDepth(DEPTH.BG_DECO).setScrollFactor(0.38);
        }
    }

    /** 流星雨：周期性创建一颗流星从右上划向左下 */
    _startMeteorShower(W, H) {
        const spawnMeteor = () => {
            if (!this.scene || !this.scene.isActive()) return;
            const startX = Math.random() * W * 0.7 + W * 0.3;
            const startY = Math.random() * H * 0.3;
            const len    = 40 + Math.random() * 80;
            const angle  = 0.4 + Math.random() * 0.3; // 弧度，斜向左下
            const col    = [0xffffff, 0xaaddff, 0xffeecc][Math.floor(Math.random() * 3)];
            const alpha  = 0.5 + Math.random() * 0.4;
            const speed  = 600 + Math.random() * 400;

            // 流星头部
            const head = this.add.circle(startX, startY, 1.5, col, alpha);
            head.setDepth(DEPTH.BG_FAR + 2).setScrollFactor(0);
            // 尾迹
            const tail = this.add.rectangle(
                startX - Math.cos(angle) * len / 2,
                startY + Math.sin(angle) * len / 2,
                len, 1, col, alpha * 0.6
            );
            tail.setRotation(Math.PI + angle);
            tail.setDepth(DEPTH.BG_FAR + 2).setScrollFactor(0);

            const dist = 300 + Math.random() * 400;
            const dur  = (dist / speed) * 1000;
            this.tweens.add({
                targets: [head, tail],
                x: `+=${-Math.cos(angle) * dist}`,
                y: `+=${Math.sin(angle) * dist}`,
                alpha: 0,
                duration: dur,
                ease: 'Quad.easeIn',
                onComplete: () => { head.destroy(); tail.destroy(); },
            });

            // 下一颗流星随机间隔 3~12 秒
            if (this.time) {
                this.time.delayedCall(3000 + Math.random() * 9000, spawnMeteor);
            }
        };

        // 首次延迟 1~5 秒后开始
        this.time.delayedCall(1000 + Math.random() * 4000, spawnMeteor);
    }

    /** 霓虹灯条（带发光脉冲） */
    _addNeonLine(x, y, length, vertical, color) {
        const w = vertical ? 2 : length;
        const h = vertical ? length : 2;
        const neon = this.add.rectangle(x, y, w, h, color, 0.55);
        neon.setDepth(DEPTH.BG_NEAR).setScrollFactor(0.28);
        this.tweens.add({
            targets: neon, alpha: 0.12,
            duration: 1300 + Math.random() * 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        const glow = this.add.circle(x, y, 16, color, 0.06);
        glow.setDepth(DEPTH.BG_NEAR - 1).setScrollFactor(0.28);
        this.tweens.add({
            targets: glow, alpha: 0.02, scaleX: 1.6, scaleY: 1.6,
            duration: 2000, yoyo: true, repeat: -1,
        });
    }

    // ----------------------------------------------------------------
    // 提示文字
    // ----------------------------------------------------------------
    _showHint(text, duration = 2000) {
        const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, text, {
            fontFamily: 'Courier New', fontSize: '20px', color: '#44ccff',
            align: 'center', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(DEPTH.HUD).setScrollFactor(0);
        this.tweens.add({
            targets: hint, alpha: 0, y: hint.y - 30,
            delay: duration - 500, duration: 500,
            onComplete: () => hint.destroy(),
        });
    }

    _addHintText(x, y, text, color = '#8899cc', size = '14px') {
        return this.add.text(x, y, text, {
            fontFamily: 'Courier New', fontSize: size, color,
            stroke: '#000000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(DEPTH.BG_NEAR).setAlpha(0.7);
    }

    // ----------------------------------------------------------------
    // 场景切换
    // ----------------------------------------------------------------
    _goToNextRoom(nextScene) {
        if (this._transitioning) return;
        this._transitioning = true;
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.player.cleanup();
            this.scene.start(nextScene);
        });
    }

    // ----------------------------------------------------------------
    // 死亡处理（可被子类重写）
    // ----------------------------------------------------------------
    _handleDeath() {
        this.time.delayedCall(1500, () => {
            const cp = checkpointManager.respawn();
            const sceneName = this.scene.key;
            if (cp.scene === sceneName) {
                this.player.respawnAt(cp.x, cp.y);
            } else {
                this.player.cleanup();
                this.scene.start(cp.scene);
            }
        });
    }
}
