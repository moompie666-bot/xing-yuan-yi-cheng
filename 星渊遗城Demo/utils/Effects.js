// ============================================================
// Effects.js — 银河科幻风特效系统（打击感 · 动作质感 · 视觉表现）
// ============================================================
// 设计原则：
//   - 所有特效控制在 5~8 个对象以内，避免帧率下降
//   - 颜色体系：蓝 0x44ccff / 紫 0xaa44ff / 青 0x00ffdd / 白 0xffffff
//   - 打击感通过"帧冻结+镜头震+闪光+火花"四层实现
//   - Hitstop 用 tweens.timeScale 实现真实帧冻结，duration 极短
// ============================================================

import { COLORS, DEPTH } from './Constants.js';

// ---- 全局 hitstop 锁，防止多次叠加 ----
let _hitstopActive = false;

export const Effects = {

    // ================================================================
    // 核心打击感：Hitstop（真实帧冻结）
    // 通过极低 timeScale 实现帧冻结，安全且可控
    // ================================================================

    /**
     * 轻击 hitstop：30ms，轻微冻结感
     */
    hitstopLight(scene) {
        Effects._doHitstop(scene, 30, 0.05);
    },

    /**
     * 重击 hitstop：55ms，明显打击停顿
     */
    hitstopHeavy(scene) {
        Effects._doHitstop(scene, 55, 0.03);
    },

    /**
     * Boss 命中 hitstop：80ms，强烈冲击感
     */
    hitstopBoss(scene) {
        Effects._doHitstop(scene, 80, 0.02);
    },

    /** 兼容旧调用 */
    hitstop(scene, duration = 50) {
        Effects._doHitstop(scene, Math.min(duration, 60), 0.04);
    },

    _doHitstop(scene, duration, scale) {
        if (!scene || !scene.tweens || _hitstopActive) return;
        _hitstopActive = true;
        // 冻结 tweens 时间轴（不影响物理，不影响 time.delayedCall）
        scene.tweens.timeScale = scale;
        // 用原生 setTimeout 恢复（不依赖 scene.time）
        setTimeout(() => {
            if (scene && scene.tweens) scene.tweens.timeScale = 1;
            _hitstopActive = false;
        }, duration);
    },

    // ================================================================
    // 摄像机震动（分级）
    // ================================================================
    screenShake(camera, duration = 100, intensity = 0.006) {
        if (!camera) return;
        camera.shake(duration, intensity);
    },
    shakeLight(camera)  { Effects.screenShake(camera, 80,  0.004); },
    shakeHeavy(camera)  { Effects.screenShake(camera, 140, 0.010); },
    shakeBoss(camera)   { Effects.screenShake(camera, 200, 0.015); },

    // ================================================================
    // 受击闪光
    // ================================================================
    flashWhite(sprite, duration = 80) {
        if (!sprite || !sprite.active || !sprite.scene) return;
        const sceneRef = sprite.scene;
        sprite.setTintFill(0xffffff);
        sceneRef.time.delayedCall(duration, () => {
            if (sprite && sprite.active && sprite.scene) sprite.clearTint();
        });
    },

    flashRed(sprite, duration = 100) {
        if (!sprite || !sprite.active || !sprite.scene) return;
        const sceneRef = sprite.scene;
        sprite.setTintFill(0xff2222);
        sceneRef.time.delayedCall(duration, () => {
            if (sprite && sprite.active && sprite.scene) sprite.clearTint();
        });
    },

    /** 蓝色相位闪光（Boss 受击） */
    flashBlue(sprite, duration = 120) {
        if (!sprite || !sprite.active || !sprite.scene) return;
        const sceneRef = sprite.scene;
        sprite.setTintFill(0x44aaff);
        sceneRef.time.delayedCall(duration, () => {
            if (sprite && sprite.active && sprite.scene) sprite.clearTint();
        });
    },

    // ================================================================
    // 命中火花（分级：轻/重/Boss）
    // ================================================================

    /** 普通近战命中火花 */
    hitSpark(scene, x, y, color = 0xffffff, dirX = 0) {
        if (!scene || !scene.add) return;
        // 中心闪光
        const flash = scene.add.circle(x, y, 7, 0xffffff, 1.0);
        flash.setDepth(DEPTH.EFFECTS + 2);
        scene.tweens.add({
            targets: flash, scaleX: 2.5, scaleY: 2.5, alpha: 0,
            duration: 90, onComplete: () => flash.destroy(),
        });
        // 定向火花条（4根）
        for (let i = 0; i < 4; i++) {
            const baseAngle = dirX >= 0 ? 0 : Math.PI;
            const angle = baseAngle + (Math.random() - 0.5) * 1.4;
            const len = 10 + Math.random() * 14;
            const spark = scene.add.rectangle(x, y, len, 2, color, 0.9);
            spark.setRotation(angle);
            spark.setDepth(DEPTH.EFFECTS + 2);
            scene.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * 28,
                y: y + Math.sin(angle) * 28,
                alpha: 0, scaleX: 0.2, scaleY: 0.2,
                duration: 120 + Math.random() * 60,
                ease: 'Power2',
                onComplete: () => spark.destroy(),
            });
        }
        // 能量微粒（3个）
        for (let i = 0; i < 3; i++) {
            const angle = (dirX >= 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.6;
            const p = scene.add.circle(x, y, 2, COLORS.PLAYER_CORE, 0.8);
            p.setDepth(DEPTH.EFFECTS + 1);
            scene.tweens.add({
                targets: p,
                x: x + Math.cos(angle) * (16 + Math.random() * 20),
                y: y + Math.sin(angle) * (16 + Math.random() * 20),
                alpha: 0, duration: 160 + Math.random() * 80,
                onComplete: () => p.destroy(),
            });
        }
    },

    /** 重击命中：更大冲击波 + 更多火花 */
    hitSparkHeavy(scene, x, y, dirX = 0) {
        if (!scene || !scene.add) return;
        // 大冲击波圆环
        const ring = scene.add.circle(x, y, 4, 0xffffff, 0);
        ring.setDepth(DEPTH.EFFECTS + 2);
        ring.setStrokeStyle(3, COLORS.PLAYER_CORE, 0.9);
        scene.tweens.add({
            targets: ring, scaleX: 5, scaleY: 3.5, alpha: 0,
            duration: 180, ease: 'Power2',
            onComplete: () => ring.destroy(),
        });
        // 中心亮点
        const core = scene.add.circle(x, y, 10, 0xffffff, 1.0);
        core.setDepth(DEPTH.EFFECTS + 3);
        scene.tweens.add({
            targets: core, scaleX: 0.1, scaleY: 0.1, alpha: 0,
            duration: 120, ease: 'Power3',
            onComplete: () => core.destroy(),
        });
        // 扩散火花条（6根）
        for (let i = 0; i < 6; i++) {
            const baseAngle = dirX >= 0 ? 0 : Math.PI;
            const angle = baseAngle + (Math.random() - 0.5) * 1.8;
            const len = 14 + Math.random() * 18;
            const spark = scene.add.rectangle(x, y, len, 2.5, COLORS.PLAYER_CORE, 1.0);
            spark.setRotation(angle);
            spark.setDepth(DEPTH.EFFECTS + 2);
            scene.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * 40,
                y: y + Math.sin(angle) * 40,
                alpha: 0, scaleX: 0.1,
                duration: 150 + Math.random() * 80,
                ease: 'Power2',
                onComplete: () => spark.destroy(),
            });
        }
        // 能量溅射（4个）
        for (let i = 0; i < 4; i++) {
            const angle = (dirX >= 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 2.0;
            const p = scene.add.circle(x, y, 3, COLORS.NEON_CYAN, 0.9);
            p.setDepth(DEPTH.EFFECTS + 1);
            scene.tweens.add({
                targets: p,
                x: x + Math.cos(angle) * (24 + Math.random() * 24),
                y: y + Math.sin(angle) * (24 + Math.random() * 24),
                alpha: 0, scaleX: 0, scaleY: 0,
                duration: 200 + Math.random() * 100,
                onComplete: () => p.destroy(),
            });
        }
    },

    /** Boss 受击：紫色冲击特效 */
    hitSparkBoss(scene, x, y, dirX = 0) {
        if (!scene || !scene.add) return;
        // 大型紫色爆发环
        const ring1 = scene.add.circle(x, y, 6, 0xcc44ff, 0);
        ring1.setDepth(DEPTH.EFFECTS + 2);
        ring1.setStrokeStyle(3, 0xcc44ff, 1.0);
        scene.tweens.add({
            targets: ring1, scaleX: 7, scaleY: 5, alpha: 0,
            duration: 250, ease: 'Power2',
            onComplete: () => ring1.destroy(),
        });
        // 内层白核
        const core = scene.add.circle(x, y, 14, 0xffffff, 1.0);
        core.setDepth(DEPTH.EFFECTS + 3);
        scene.tweens.add({
            targets: core, scaleX: 0.05, scaleY: 0.05, alpha: 0,
            duration: 150, ease: 'Power3',
            onComplete: () => core.destroy(),
        });
        // 能量碎片（8根）
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i / 8) + Math.random() * 0.3;
            const len = 16 + Math.random() * 16;
            const spark = scene.add.rectangle(x, y, len, 2, 0xcc44ff, 1.0);
            spark.setRotation(angle);
            spark.setDepth(DEPTH.EFFECTS + 2);
            scene.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * 50,
                y: y + Math.sin(angle) * 50,
                alpha: 0, scaleX: 0.1,
                duration: 200 + Math.random() * 100,
                ease: 'Power2',
                onComplete: () => spark.destroy(),
            });
        }
    },

    // ================================================================
    // 近战攻击特效（三阶段：前摇 → 爆发 → 收招）
    // ================================================================

    /** 挥斩弧光（爆发阶段，带能量拖尾） */
    meleeSlash(scene, x, y, dirX, range) {
        if (!scene || !scene.add) return;
        const sign = dirX >= 0 ? 1 : -1;

        // 主斩击弧（半透明青色长条）
        const slash = scene.add.rectangle(
            x + sign * range * 0.4, y,
            range * 0.9, 18, COLORS.NEON_CYAN, 0.55
        );
        slash.setDepth(DEPTH.EFFECTS + 1);
        slash.setRotation(sign * -0.2);
        scene.tweens.add({
            targets: slash,
            scaleX: 1.4, scaleY: 0.2, alpha: 0,
            x: slash.x + sign * 20,
            rotation: sign * 0.25,
            duration: 130, ease: 'Power2',
            onComplete: () => slash.destroy(),
        });

        // 能量残影条（拖尾感）
        const trail = scene.add.rectangle(
            x + sign * range * 0.25, y,
            range * 0.6, 8, COLORS.PLAYER_CORE, 0.35
        );
        trail.setDepth(DEPTH.EFFECTS);
        trail.setRotation(sign * -0.1);
        scene.tweens.add({
            targets: trail, alpha: 0, scaleX: 0.4,
            duration: 180, ease: 'Sine.easeOut',
            onComplete: () => trail.destroy(),
        });

        // 尖端光点（爆发感）
        const tip = scene.add.circle(
            x + sign * range * 0.85, y,
            5, 0xffffff, 1.0
        );
        tip.setDepth(DEPTH.EFFECTS + 2);
        scene.tweens.add({
            targets: tip, scaleX: 3, scaleY: 3, alpha: 0,
            x: tip.x + sign * 15,
            duration: 100, ease: 'Power3',
            onComplete: () => tip.destroy(),
        });
    },

    /** 近战前摇蓄力（可选：在攻击前调用） */
    meleeWindup(scene, x, y, dirX) {
        if (!scene || !scene.add) return;
        const sign = dirX >= 0 ? 1 : -1;
        // 聚能小粒子
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 15;
            const p = scene.add.circle(
                x + Math.cos(angle) * dist,
                y + Math.sin(angle) * dist,
                1.5 + Math.random(), COLORS.NEON_CYAN, 0.7
            );
            p.setDepth(DEPTH.EFFECTS);
            scene.tweens.add({
                targets: p,
                x: x + sign * 8, y: y,
                alpha: 0, scaleX: 0, scaleY: 0,
                duration: 100,
                onComplete: () => p.destroy(),
            });
        }
    },

    // ================================================================
    // 冲刺特效（相位失真 + 残影 + 速度线）
    // ================================================================

    /** 冲刺起始爆发（瞬间感） */
    dashBurst(scene, x, y, dirX) {
        if (!scene || !scene.add) return;
        const sign = dirX >= 0 ? 1 : -1;

        // 相位扭曲圆（椭圆形，水平拉伸）
        const distort = scene.add.ellipse(x, y, 60, 24, COLORS.PLAYER_DASH, 0.5);
        distort.setDepth(DEPTH.EFFECTS);
        scene.tweens.add({
            targets: distort, scaleX: 2.5, scaleY: 0.3, alpha: 0,
            x: x - sign * 20,
            duration: 160, ease: 'Power2',
            onComplete: () => distort.destroy(),
        });

        // 起始光环
        const ring = scene.add.circle(x, y, 10, COLORS.PLAYER_DASH, 0.7);
        ring.setDepth(DEPTH.EFFECTS + 1);
        scene.tweens.add({
            targets: ring, scaleX: 2.8, scaleY: 1.8, alpha: 0,
            duration: 180, ease: 'Power3',
            onComplete: () => ring.destroy(),
        });

        // 向后喷射粒子（4个）
        for (let i = 0; i < 4; i++) {
            const py = y + (Math.random() - 0.5) * 20;
            const px = x - sign * (5 + Math.random() * 10);
            const p = scene.add.rectangle(px, py, 3 + Math.random() * 4, 2, COLORS.NEON_CYAN, 0.7);
            p.setDepth(DEPTH.EFFECTS);
            scene.tweens.add({
                targets: p,
                x: px - sign * (30 + Math.random() * 30),
                y: py + (Math.random() - 0.5) * 10,
                alpha: 0, scaleX: 0.2,
                duration: 180 + Math.random() * 80,
                ease: 'Power2',
                onComplete: () => p.destroy(),
            });
        }
    },

    /** 冲刺残影（相位失真风格） */
    createAfterimage(scene, x, y, texture, tint = 0x22aaff, alpha = 0.45) {
        if (!scene || !scene.add) return;
        const img = scene.add.image(x, y, texture);
        img.setTint(tint);
        img.setAlpha(alpha);
        img.setDepth(DEPTH.PLAYER - 2);
        img.setScale(scene._playerBaseScale || 0.055); // 跟随玩家缩放
        scene.tweens.add({
            targets: img, alpha: 0, scaleX: img.scaleX * 0.7, scaleY: img.scaleY * 0.7,
            duration: 180, ease: 'Sine.easeIn',
            onComplete: () => img.destroy(),
        });
    },

    /** 冲刺速度线（保持简洁） */
    createSpeedLines(scene, x, y, dirX, count = 2) {
        if (!scene || !scene.add) return;
        for (let i = 0; i < count; i++) {
            const ly = y + (Math.random() - 0.5) * 24;
            const lx = x - dirX * (6 + Math.random() * 14);
            const line = scene.add.rectangle(lx, ly, 8 + Math.random() * 18, 1.5, COLORS.NEON_CYAN, 0.5);
            line.setDepth(DEPTH.EFFECTS - 1);
            scene.tweens.add({
                targets: line, x: lx - dirX * 32, alpha: 0, scaleX: 0.2,
                duration: 110 + Math.random() * 70,
                onComplete: () => line.destroy(),
            });
        }
    },

    // ================================================================
    // 落地特效（冲击感）
    // ================================================================

    /** 落地冲击（intensity 0~2，越大越强） */
    landingDust(scene, x, y, intensity = 1) {
        if (!scene || !scene.add || intensity < 0.1) return;

        // 水平冲击波（核心视觉）
        const shockW = 20 + intensity * 30;
        const shock = scene.add.ellipse(x, y, shockW, 6, COLORS.NEON_CYAN, 0.5);
        shock.setDepth(DEPTH.EFFECTS);
        scene.tweens.add({
            targets: shock, scaleX: 2.5, scaleY: 0.2, alpha: 0,
            duration: 200, ease: 'Power2',
            onComplete: () => shock.destroy(),
        });

        // 侧向粉尘微粒
        const count = Math.floor(3 + intensity * 3);
        for (let i = 0; i < count; i++) {
            const side = i < count / 2 ? -1 : 1;
            const px = x + side * (6 + Math.random() * 16);
            const p = scene.add.circle(px, y, 1.5 + Math.random() * 1.5, COLORS.LAND_DUST, 0.55);
            p.setDepth(DEPTH.EFFECTS);
            scene.tweens.add({
                targets: p,
                x: px + side * (12 + Math.random() * 14),
                y: y - (2 + Math.random() * 8),
                alpha: 0,
                duration: 200 + Math.random() * 120,
                ease: 'Power1',
                onComplete: () => p.destroy(),
            });
        }

        // 重落地：地面震纹
        if (intensity > 1.2) {
            const crack = scene.add.rectangle(x, y, 40 * intensity, 2, COLORS.PLATFORM_EDGE, 0.6);
            crack.setDepth(DEPTH.EFFECTS);
            scene.tweens.add({
                targets: crack, scaleX: 1.8, alpha: 0, duration: 280,
                ease: 'Power2',
                onComplete: () => crack.destroy(),
            });
        }
    },

    // ================================================================
    // 通用粒子爆发
    // ================================================================
    spawnParticles(scene, x, y, color = 0xffffff, count = 6, speed = 140) {
        if (!scene || !scene.add) return;
        const actualCount = Math.min(count, 10); // 限制最大数量
        for (let i = 0; i < actualCount; i++) {
            const angle = (Math.PI * 2 * i) / actualCount + Math.random() * 0.6;
            const spd = speed * (0.4 + Math.random() * 0.6);
            const size = 2 + Math.random() * 2.5;
            const p = scene.add.rectangle(x, y, size, size, color);
            p.setDepth(DEPTH.EFFECTS);
            scene.tweens.add({
                targets: p,
                x: x + Math.cos(angle) * spd * 0.45,
                y: y + Math.sin(angle) * spd * 0.45,
                alpha: 0, scaleX: 0, scaleY: 0,
                duration: 240 + Math.random() * 160,
                ease: 'Power1',
                onComplete: () => p.destroy(),
            });
        }
    },

    // ================================================================
    // 击杀爆炸
    // ================================================================
    deathExplosion(scene, x, y, color = 0xff5544, count = 8) {
        if (!scene || !scene.add) return;
        // 外扩爆炸环
        const ring = scene.add.circle(x, y, 6, color, 0.7);
        ring.setDepth(DEPTH.EFFECTS + 1);
        scene.tweens.add({
            targets: ring, scaleX: 6, scaleY: 6, alpha: 0, duration: 320, ease: 'Power2',
            onComplete: () => ring.destroy(),
        });
        // 白色核心闪光
        const flash = scene.add.circle(x, y, 10, 0xffffff, 1.0);
        flash.setDepth(DEPTH.EFFECTS + 2);
        scene.tweens.add({
            targets: flash, scaleX: 0.1, scaleY: 0.1, alpha: 0,
            duration: 130, ease: 'Power3',
            onComplete: () => flash.destroy(),
        });
        // 碎片粒子
        Effects.spawnParticles(scene, x, y, color, Math.min(count, 8), 180);
    },

    // ================================================================
    // 墙跳粒子
    // ================================================================
    wallJumpBurst(scene, x, y, wallDir) {
        if (!scene || !scene.add) return;
        for (let i = 0; i < 5; i++) {
            const py = y + (Math.random() - 0.5) * 24;
            const p = scene.add.rectangle(x, py, 4, 2, COLORS.NEON_CYAN, 0.7);
            p.setDepth(DEPTH.EFFECTS);
            scene.tweens.add({
                targets: p,
                x: x - wallDir * (16 + Math.random() * 18),
                y: py - (4 + Math.random() * 12),
                alpha: 0, scaleX: 0.2,
                duration: 180 + Math.random() * 80,
                ease: 'Power2',
                onComplete: () => p.destroy(),
            });
        }
    },

    // ================================================================
    // Boss 专属特效
    // ================================================================

    /** 阶段切换：全屏紫色冲击波 */
    phaseShiftFlash(scene, camera) {
        if (!camera) return;
        camera.flash(300, 160, 40, 255, false);
        Effects.shakeBoss(camera);
        // 全屏闪光叠加
        if (scene && scene.add) {
            const overlay = scene.add.rectangle(
                scene.cameras.main.scrollX + 512, scene.cameras.main.scrollY + 320,
                1200, 800, 0x8833ff, 0.25
            );
            overlay.setDepth(DEPTH.EFFECTS + 5).setScrollFactor(0);
            scene.tweens.add({
                targets: overlay, alpha: 0, duration: 400,
                onComplete: () => overlay.destroy(),
            });
        }
    },

    /** Boss 危险区域提示（升级版：脉冲边框+填充+倒计时感） */
    createDangerZone(scene, x, y, width, height, duration = 800, color = 0xff2222) {
        if (!scene || !scene.add) return null;

        // 填充区域（低透明度）
        const fill = scene.add.rectangle(x, y, width, height, color, 0.08);
        fill.setDepth(DEPTH.EFFECTS - 1);

        // 边框（高亮）
        const border = scene.add.rectangle(x, y, width, height);
        border.setStrokeStyle(2, color, 0.8);
        border.setFillStyle();
        border.setDepth(DEPTH.EFFECTS);

        // 边框脉冲（加快频率，增加紧迫感）
        scene.tweens.add({
            targets: border,
            strokeAlpha: 0.2,
            duration: Math.min(duration * 0.25, 200),
            yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // 填充渐强（越来越危险的感觉）
        scene.tweens.add({
            targets: fill,
            alpha: 0.22,
            duration: duration * 0.8,
            ease: 'Power2',
        });

        // 到时间销毁
        scene.time.delayedCall(duration, () => {
            scene.tweens.add({
                targets: [fill, border], alpha: 0, duration: 100,
                onComplete: () => { fill.destroy(); border.destroy(); },
            });
        });

        return fill;
    },

    /** Boss 冲锋前摇指示线（方向感） */
    createChargeIndicator(scene, fromX, fromY, dirX, length = 400, duration = 900) {
        if (!scene || !scene.add) return;
        const sign = dirX > 0 ? 1 : -1;
        const line = scene.add.rectangle(
            fromX + sign * length / 2, fromY,
            length, 5, 0xff3322, 0.15
        );
        line.setDepth(DEPTH.EFFECTS);
        // 头部箭头感
        const tip = scene.add.triangle(
            fromX + sign * length, fromY, 0, 0,
            -sign * 14, -7, -sign * 14, 7,
            0xff3322, 0.5
        );
        tip.setDepth(DEPTH.EFFECTS);
        // 随时间变亮
        scene.tweens.add({
            targets: [line, tip], alpha: 0.6,
            duration: duration * 0.8, ease: 'Power2',
        });
        scene.time.delayedCall(duration, () => {
            if (line.active) line.destroy();
            if (tip.active) tip.destroy();
        });
    },

    /** Boss 瞬移目标位置警告（十字+圆） */
    createTeleportWarning(scene, x, y, duration = 600) {
        if (!scene || !scene.add) return;
        // 圆环
        const ring = scene.add.circle(x, y, 20, 0xff44ff, 0);
        ring.setStrokeStyle(2, 0xff44ff, 0.8);
        ring.setDepth(DEPTH.EFFECTS);
        // 十字
        const hLine = scene.add.rectangle(x, y, 28, 2, 0xff44ff, 0.7);
        hLine.setDepth(DEPTH.EFFECTS);
        const vLine = scene.add.rectangle(x, y, 2, 28, 0xff44ff, 0.7);
        vLine.setDepth(DEPTH.EFFECTS);

        // 脉冲放大
        scene.tweens.add({
            targets: ring, scaleX: 1.8, scaleY: 1.8, alpha: 0.0,
            duration: duration, ease: 'Power2',
        });
        scene.tweens.add({
            targets: [hLine, vLine], alpha: 0.2,
            duration: 150, yoyo: true, repeat: -1, ease: 'Sine',
        });

        scene.time.delayedCall(duration, () => {
            scene.tweens.killTweensOf(ring);
            scene.tweens.killTweensOf(hLine);
            scene.tweens.killTweensOf(vLine);
            ring.destroy(); hLine.destroy(); vLine.destroy();
        });
    },

    /** Boss 射击蓄力（环形能量收缩） */
    createShootWindup(scene, x, y, duration = 600) {
        if (!scene || !scene.add) return;
        const ring = scene.add.circle(x, y, 30, 0xffaa00, 0.0);
        ring.setStrokeStyle(2, 0xffaa00, 0.5);
        ring.setDepth(DEPTH.EFFECTS);
        scene.tweens.add({
            targets: ring, scaleX: 0.3, scaleY: 0.3, alpha: { from: 0.0, to: 0.8 },
            duration: duration * 0.85, ease: 'Power2',
            onComplete: () => ring.destroy(),
        });
    },

    // ================================================================
    // 能力获取
    // ================================================================
    abilityFlash(scene, x, y) {
        if (!scene || !scene.add) return;
        const flash = scene.add.circle(x, y, 12, 0xffcc00, 0.9);
        flash.setDepth(DEPTH.EFFECTS + 2);
        scene.tweens.add({
            targets: flash, scaleX: 10, scaleY: 10, alpha: 0, duration: 550, ease: 'Power2',
            onComplete: () => flash.destroy(),
        });
        Effects.spawnParticles(scene, x, y, 0xffcc00, 10, 220);
    },

    // ================================================================
    // 玩家受击特效（方向性击退感）
    // ================================================================
    playerHitEffect(scene, x, y, dirX) {
        if (!scene || !scene.add) return;
        // 受击方向性红色冲击
        const sign = dirX > 0 ? 1 : -1;
        for (let i = 0; i < 3; i++) {
            const angle = (sign > 0 ? Math.PI : 0) + (Math.random() - 0.5) * 1.2;
            const line = scene.add.rectangle(x, y + (Math.random() - 0.5) * 20, 12 + Math.random() * 10, 2, 0xff4444, 0.8);
            line.setRotation(angle);
            line.setDepth(DEPTH.EFFECTS + 1);
            scene.tweens.add({
                targets: line,
                x: x + Math.cos(angle) * 24,
                y: y + Math.sin(angle) * 24,
                alpha: 0, scaleX: 0.2,
                duration: 130,
                onComplete: () => line.destroy(),
            });
        }
    },

    // ================================================================
    // 玩家死亡特效
    // ================================================================
    playerDeathEffect(scene, x, y) {
        if (!scene || !scene.add) return;
        // 多圈扩散环
        [1, 2, 3].forEach((i) => {
            const ring = scene.add.circle(x, y, 4, COLORS.PLAYER_BODY, 0.0);
            ring.setStrokeStyle(2, COLORS.PLAYER_BODY, 0.8);
            ring.setDepth(DEPTH.EFFECTS + i);
            scene.tweens.add({
                targets: ring, scaleX: 8 + i * 3, scaleY: 8 + i * 3, alpha: 0,
                duration: 400 + i * 100,
                delay: i * 80,
                ease: 'Power2',
                onComplete: () => ring.destroy(),
            });
        });
        Effects.spawnParticles(scene, x, y, COLORS.PLAYER_BODY, 10, 200);
        Effects.spawnParticles(scene, x, y, COLORS.NEON_CYAN, 6, 280);
    },
};
