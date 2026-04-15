// ============================================================
// Constants.js — 全局常量与手感调优参数
// ============================================================

// 画布尺寸
export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 640;

// 房间宽度（每个房间的世界尺寸）
export const ROOM_WIDTH = 2048;
export const ROOM_HEIGHT = 640;

// ---- 物理 ----
export const GRAVITY = 980;

// ---- 玩家参数 ----
export const PLAYER = {
    // 移动
    MOVE_SPEED: 230,
    ACCELERATION: 1400,
    DECELERATION: 2000,

    // 跳跃
    JUMP_VELOCITY: -430,
    DOUBLE_JUMP_VELOCITY: -390,
    COYOTE_TIME: 120,        // ms（加长，更宽容）
    JUMP_BUFFER: 150,        // ms（加长，更宽容）
    JUMP_CUT_MULTIPLIER: 0.4,
    LAND_SQUASH_DURATION: 120, // 落地挤压时长
    LAND_SQUASH_X: 1.2,
    LAND_SQUASH_Y: 0.8,

    // 冲刺
    DASH_SPEED: 580,
    DASH_DURATION: 140,
    DASH_COOLDOWN: 380,
    DASH_AFTERIMAGE_INTERVAL: 25, // ms 残影间隔

    // 墙滑 / 墙跳
    WALL_SLIDE_SPEED: 72,
    WALL_JUMP_X: 290,
    WALL_JUMP_Y: -395,
    WALL_JUMP_LOCK: 140,

    // 战斗
    MAX_HP: 100,
    MELEE_DAMAGE: 22,
    MELEE_RANGE: 48,
    MELEE_DURATION: 160,
    MELEE_COOLDOWN: 320,
    MELEE_HITSTOP: 60,        // 近战命中停顿
    RANGED_DAMAGE: 14,
    RANGED_SPEED: 520,
    RANGED_COOLDOWN: 380,
    MAX_ENERGY: 100,
    RANGED_COST: 14,
    ENERGY_REGEN: 10,
    HIT_INVINCIBLE: 900,

    // 尺寸
    WIDTH: 28,
    HEIGHT: 44,
};

// ---- 敌人参数 ----
export const ENEMY = {
    MELEE: {
        HP: 40,
        SPEED: 80,
        CHARGE_SPEED: 190,
        DAMAGE: 14,
        DETECT_RANGE: 200,
        ATTACK_RANGE: 40,
        ATTACK_COOLDOWN: 1200,
        HIT_STUN: 350,       // 受击硬直
        WIDTH: 30,
        HEIGHT: 36,
    },
    RANGED: {
        HP: 30,
        SPEED: 40,
        DAMAGE: 10,
        BULLET_SPEED: 270,
        DETECT_RANGE: 350,
        SHOOT_COOLDOWN: 1800,
        HIT_STUN: 350,
        WIDTH: 28,
        HEIGHT: 34,
    },
    FLYING: {
        HP: 25,
        SPEED: 100,
        DAMAGE: 11,
        DETECT_RANGE: 300,
        DIVE_SPEED: 310,
        DIVE_COOLDOWN: 2200,
        HIT_STUN: 300,
        WIDTH: 26,
        HEIGHT: 26,
    },
};

// ---- Boss 参数 ----
export const BOSS = {
    MAX_HP: 550,
    WIDTH: 56,
    HEIGHT: 64,
    // 阶段血量阈值
    PHASE2_THRESHOLD: 0.6,
    PHASE3_THRESHOLD: 0.3,
    // 冲撞
    CHARGE_SPEED: 380,
    CHARGE_WINDUP: 1000,     // 加长前摇，更容易读招
    CHARGE_DAMAGE: 22,
    CHARGE_DURATION: 900,
    // 射击
    SHOOT_COUNT: 4,
    SHOOT_INTERVAL: 220,
    BULLET_SPEED: 280,
    SHOOT_DAMAGE: 11,
    SHOOT_WINDUP: 700,       // 加长前摇
    // 瞬移突进
    TELEPORT_WINDUP: 650,    // 加长前摇
    TELEPORT_DAMAGE: 25,
    TELEPORT_ATTACK_DURATION: 250,
    // 通用
    ATTACK_COOLDOWN_BASE: 2200,
    HIT_FLASH_DURATION: 100,
    HIT_STUN: 250,          // Boss受击硬直
};

// ---- 颜色 ----
export const COLORS = {
    // 背景 & 环境
    BG_DEEP: 0x0a0a1a,
    BG_MID: 0x111128,
    STAR: 0xffffff,
    STAR_DIM: 0x6666aa,
    STAR_BLUE: 0x4488ff,
    STAR_PURPLE: 0xaa66ff,
    PLATFORM: 0x2a2a4a,
    PLATFORM_HIGHLIGHT: 0x3a3a6a,
    PLATFORM_EDGE: 0x4a4a7a,
    WALL: 0x222244,
    SPIKE: 0xff3355,
    CHECKPOINT: 0x44ffaa,
    CHECKPOINT_ACTIVE: 0x00ff88,
    DOOR: 0x5566ff,
    NEON_CYAN: 0x00ffdd,
    NEON_PINK: 0xff44aa,
    NEON_PURPLE: 0xaa44ff,
    RUST: 0x443322,

    // 玩家
    PLAYER_BODY: 0x44ccff,
    PLAYER_CORE: 0x88eeff,
    PLAYER_DASH: 0x22aaff,
    PLAYER_LAND: 0x3399cc,

    // 敌人
    ENEMY_MELEE: 0xff5544,
    ENEMY_RANGED: 0xff8833,
    ENEMY_FLYING: 0xff44cc,

    // Boss
    BOSS_BODY: 0xcc33ff,
    BOSS_CORE: 0xff55ff,
    BOSS_CHARGE: 0xff2222,
    BOSS_SHOOT: 0xffaa00,
    BOSS_TELEGRAPH: 0xff4466,

    // 弹丸
    BULLET_PLAYER: 0x44ccff,
    BULLET_ENEMY: 0xff6633,
    BULLET_BOSS: 0xff55ff,

    // UI
    HP_BAR: 0x22dd66,
    HP_BAR_BG: 0x333333,
    HP_BAR_BORDER: 0x55ff88,
    ENERGY_BAR: 0x3399ff,
    ENERGY_BAR_BORDER: 0x66bbff,
    BOSS_HP_BAR: 0xcc33ff,
    BOSS_HP_BORDER: 0xff66ff,
    UI_TEXT: 0xccddff,
    UI_ACCENT: 0x44ccff,

    // 特效
    HIT_FLASH: 0xffffff,
    PHASE_WALL: 0x8844ff,
    ABILITY_PICKUP: 0xffcc00,
    DASH_TRAIL: 0x22aaff,
    LAND_DUST: 0x888899,
};

// ---- 深度层级 ----
export const DEPTH = {
    BG_FAR: 0,
    BG_MID: 1,
    BG_NEAR: 2,
    BG_DECO: 3,
    PLATFORMS: 10,
    ENEMIES: 20,
    PLAYER: 30,
    PROJECTILES: 35,
    EFFECTS: 40,
    FG: 50,
    HUD: 100,
};

// ---- 美术资源路径 ----
export const ASSET_PATHS = {
    // 角色
    PLAYER:         '../assets/concept/characters/player.png',
    BOSS:           '../assets/concept/characters/boss1.png',
    ENEMY_MELEE:    '../assets/concept/characters/enemy melee.png',
    ENEMY_RANGED:   '../assets/concept/characters/enemy ranged.png',
    ENEMY_FLYING:   '../assets/concept/characters/enemy flying.png',
    // 环境
    PLATFORM:       '../assets/concept/environment/platform.png',
    WALL:           '../assets/concept/environment/wall.png',
    CHECKPOINT:     '../assets/concept/environment/checkpoint.png',
    SPIKE:          '../assets/concept/environment/spike.png',
    DOOR_TRIGGER:   '../assets/concept/environment/door_trigger.png',
    PHASE_WALL:     '../assets/concept/environment/phase_wall.png',
    ABILITY_PICKUP: '../assets/concept/environment/ability_pickup.png',
    // 弹道特效
    BULLET_PLAYER:  '../assets/concept/effects/bullet player.png',
    BULLET_ENEMY:   '../assets/concept/effects/bullet enemy.png',
    BULLET_BOSS:    '../assets/concept/effects/bullet boss.png',
};

// ---- 实体基础缩放（美术图均为1024x1024，scale = 目标像素/1024）----
// 使用 setScale 而非 setDisplaySize，避免 setScale(1,1) 重置时还原为原始大小
// 在各实体 constructor 中调用 setScale(ENTITY_SCALE.XXX)
// squash/stretch 动画用乘法偏移，恢复时调用 resetScale() 方法
export const ENTITY_SCALE = {
    PLAYER:         56  / 1024,   // 视觉56px正方形
    ENEMY_MELEE:    52  / 1024,
    ENEMY_RANGED:   48  / 1024,
    ENEMY_FLYING:   42  / 1024,
    BOSS:           80  / 1024,
    BULLET_PLAYER:  16  / 1024,
    BULLET_ENEMY:   14  / 1024,
    BULLET_BOSS:    20  / 1024,
    CHECKPOINT:     44  / 1024,
    ABILITY_PICKUP: 44  / 1024,
    SPIKE:          36  / 1024,
};

// 兼容旧代码（DISPLAY_SIZE 仍保留，但实体改用 ENTITY_SCALE）
export const DISPLAY_SIZE = {
    PLAYER:         { w: 56,  h: 56  },
    ENEMY_MELEE:    { w: 52,  h: 52  },
    ENEMY_RANGED:   { w: 48,  h: 48  },
    ENEMY_FLYING:   { w: 42,  h: 42  },
    BOSS:           { w: 80,  h: 80  },
    BULLET_PLAYER:  { w: 16,  h: 16  },
    BULLET_ENEMY:   { w: 14,  h: 14  },
    BULLET_BOSS:    { w: 20,  h: 20  },
    CHECKPOINT:     { w: 44,  h: 44  },
    ABILITY_PICKUP: { w: 44,  h: 44  },
    SPIKE:          { w: 36,  h: 36  },
};
