export type ArenaId =
  | "highlands"
  | "canyon"
  | "glacier"
  | "volcano"
  | "neon"
  | "temple"
  | "desert"
  | "forest"
  | "clockwork"
  | "moon"
  | "toxic"
  | "storm";

export interface TerrainPoint {
  x: number;
  y: number;
}

export type ArenaObstacleKind = "fortress" | "rock";

export interface ArenaCollisionPart {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface ArenaObstacle {
  id: string;
  kind: ArenaObstacleKind;
  x: number;
  y: number;
  width: number;
  height: number;
  collisionParts: readonly ArenaCollisionPart[];
}

export interface ArenaPalette {
  groundColor: number;
  surfaceColor: number;
  detailColor: number;
  obstacleColor: number;
  obstacleStrokeColor: number;
}

export interface ArenaDefinition {
  id: ArenaId;
  textureKey: string;
  displayName: string;
  description: string;
  timeLabel: string;
  accentColor: number;
  accentTextColor: string;
  terrain: readonly TerrainPoint[];
  obstacles: readonly ArenaObstacle[];
  spawnX: {
    left: number;
    right: number;
  };
  palette: ArenaPalette;
}


function createFortressObstacle(
  id: string,
  x: number,
  surfaceY: number,
  width = 120,
  height = 180,
): ArenaObstacle {
  return {
    id,
    kind: "fortress",
    x,
    y: surfaceY - height,
    width,
    height,
    collisionParts: [
      { offsetX: 0, offsetY: 0, width, height },
      { offsetX: 0, offsetY: -18, width: width / 4, height: 24 },
      { offsetX: width / 2, offsetY: -18, width: width / 4, height: 24 },
    ],
  };
}

function createRockObstacle(
  id: string,
  x: number,
  surfaceY: number,
  width = 150,
  height = 150,
): ArenaObstacle {
  return {
    id,
    kind: "rock",
    x,
    y: surfaceY - height,
    width,
    height,
    collisionParts: [
      { offsetX: width * 0.12, offsetY: height * 0.18, width: width * 0.24, height: height * 0.82 },
      { offsetX: width * 0.36, offsetY: 0, width: width * 0.32, height },
      { offsetX: width * 0.68, offsetY: height * 0.14, width: width * 0.2, height: height * 0.86 },
    ],
  };
}

export const DEFAULT_ARENA_ID: ArenaId = "highlands";

export const ARENAS: readonly ArenaDefinition[] = [
  {
    id: "highlands",
    textureKey: "arena-highlands",
    displayName: "СУМЕРЕЧНЫЕ ВЫСОТЫ",
    description: "Крепости над холодной горной долиной",
    timeLabel: "СУМЕРКИ",
    accentColor: 0x83d7ff,
    accentTextColor: "#b9e9ff",
    terrain: [
      { x: 0, y: 760 },
      { x: 240, y: 730 },
      { x: 280, y: 710 },
      { x: 1050, y: 710 },
      { x: 1300, y: 650 },
      { x: 1600, y: 600 },
      { x: 1900, y: 690 },
      { x: 2200, y: 620 },
      { x: 2500, y: 740 },
      { x: 2700, y: 760 },
      { x: 2900, y: 720 },
      { x: 3200, y: 610 },
      { x: 3500, y: 670 },
      { x: 3900, y: 590 },
      { x: 4200, y: 550 },
      { x: 4350, y: 550 },
      { x: 5120, y: 550 },
      { x: 5160, y: 600 },
      { x: 5400, y: 650 },
    ],
    obstacles: [
      {
        id: "highlands-left-watch",
        kind: "fortress",
        x: 1560,
        y: 420,
        width: 120,
        height: 180,
        collisionParts: [
          { offsetX: 0, offsetY: 0, width: 120, height: 180 },
          { offsetX: 0, offsetY: -18, width: 30, height: 24 },
          { offsetX: 60, offsetY: -18, width: 30, height: 24 },
        ],
      },
      {
        id: "highlands-center-ridge",
        kind: "rock",
        x: 2580,
        y: 620,
        width: 240,
        height: 130,
        collisionParts: [
          { offsetX: 24, offsetY: 24, width: 54, height: 106 },
          { offsetX: 78, offsetY: 0, width: 84, height: 130 },
          { offsetX: 162, offsetY: 20, width: 54, height: 110 },
        ],
      },
      {
        id: "highlands-right-watch",
        kind: "fortress",
        x: 3680,
        y: 430,
        width: 120,
        height: 180,
        collisionParts: [
          { offsetX: 0, offsetY: 0, width: 120, height: 180 },
          { offsetX: 0, offsetY: -18, width: 30, height: 24 },
          { offsetX: 60, offsetY: -18, width: 30, height: 24 },
        ],
      },
    ],
    spawnX: {
      left: 600,
      right: 4800,
    },
    palette: {
      groundColor: 0x172033,
      surfaceColor: 0x8bd8f7,
      detailColor: 0x44597a,
      obstacleColor: 0x2b3852,
      obstacleStrokeColor: 0x94dff8,
    },
  },
  {
    id: "canyon",
    textureKey: "arena-canyon",
    displayName: "БАГРОВЫЙ КАНЬОН",
    description: "Арки и скалы в раскалённом закате",
    timeLabel: "ЗАКАТ",
    accentColor: 0xffa45c,
    accentTextColor: "#ffc38f",
    terrain: [
      { x: 0, y: 650 },
      { x: 240, y: 600 },
      { x: 280, y: 560 },
      { x: 1050, y: 560 },
      { x: 1300, y: 650 },
      { x: 1600, y: 720 },
      { x: 1900, y: 600 },
      { x: 2200, y: 690 },
      { x: 2500, y: 560 },
      { x: 2700, y: 520 },
      { x: 2900, y: 560 },
      { x: 3200, y: 700 },
      { x: 3500, y: 620 },
      { x: 3900, y: 740 },
      { x: 4200, y: 720 },
      { x: 4350, y: 720 },
      { x: 5120, y: 720 },
      { x: 5160, y: 750 },
      { x: 5400, y: 780 },
    ],
    obstacles: [
      {
        id: "canyon-left-spire",
        kind: "rock",
        x: 1480,
        y: 480,
        width: 110,
        height: 210,
        collisionParts: [
          { offsetX: 18, offsetY: 24, width: 24, height: 186 },
          { offsetX: 42, offsetY: 0, width: 32, height: 210 },
          { offsetX: 74, offsetY: 20, width: 18, height: 190 },
        ],
      },
      {
        id: "canyon-center-gate-left",
        kind: "fortress",
        x: 2520,
        y: 365,
        width: 105,
        height: 170,
        collisionParts: [
          { offsetX: 0, offsetY: 0, width: 105, height: 170 },
          { offsetX: 0, offsetY: -18, width: 26.25, height: 24 },
          { offsetX: 52.5, offsetY: -18, width: 26.25, height: 24 },
        ],
      },
      {
        id: "canyon-center-gate-right",
        kind: "fortress",
        x: 2775,
        y: 365,
        width: 105,
        height: 170,
        collisionParts: [
          { offsetX: 0, offsetY: 0, width: 105, height: 170 },
          { offsetX: 0, offsetY: -18, width: 26.25, height: 24 },
          { offsetX: 52.5, offsetY: -18, width: 26.25, height: 24 },
        ],
      },
      {
        id: "canyon-right-spire",
        kind: "rock",
        x: 3810,
        y: 510,
        width: 110,
        height: 210,
        collisionParts: [
          { offsetX: 18, offsetY: 24, width: 24, height: 186 },
          { offsetX: 42, offsetY: 0, width: 32, height: 210 },
          { offsetX: 74, offsetY: 20, width: 18, height: 190 },
        ],
      },
    ],
    spawnX: {
      left: 600,
      right: 4800,
    },
    palette: {
      groundColor: 0x2e1d22,
      surfaceColor: 0xffa45c,
      detailColor: 0x754331,
      obstacleColor: 0x57342f,
      obstacleStrokeColor: 0xffbd78,
    },
  },
  {
    id: "glacier",
    textureKey: "arena-glacier",
    displayName: "ЛЕДЯНАЯ ЦИТАДЕЛЬ",
    description: "Высотные ледники и глубокая трещина",
    timeLabel: "ПОЛЯРНАЯ НОЧЬ",
    accentColor: 0x67e8ff,
    accentTextColor: "#bff6ff",
    terrain: [
      { x: 0, y: 700 },
      { x: 240, y: 680 },
      { x: 280, y: 640 },
      { x: 1050, y: 640 },
      { x: 1300, y: 590 },
      { x: 1600, y: 530 },
      { x: 1900, y: 600 },
      { x: 2200, y: 680 },
      { x: 2500, y: 730 },
      { x: 2700, y: 740 },
      { x: 2900, y: 700 },
      { x: 3200, y: 610 },
      { x: 3500, y: 540 },
      { x: 3900, y: 590 },
      { x: 4200, y: 520 },
      { x: 4350, y: 520 },
      { x: 5120, y: 520 },
      { x: 5160, y: 560 },
      { x: 5400, y: 600 },
    ],
    obstacles: [
      createRockObstacle("glacier-left-needle", 1530, 545, 125, 205),
      createRockObstacle("glacier-crevasse-spine", 2660, 735, 190, 120),
      createFortressObstacle("glacier-right-bastion", 3630, 555, 130, 190),
    ],
    spawnX: { left: 600, right: 4800 },
    palette: {
      groundColor: 0x102438,
      surfaceColor: 0x7eeaff,
      detailColor: 0x315d78,
      obstacleColor: 0x24465f,
      obstacleStrokeColor: 0xb7f6ff,
    },
  },
  {
    id: "volcano",
    textureKey: "arena-volcano",
    displayName: "ПЕПЕЛЬНАЯ КАЛЬДЕРА",
    description: "Вулканические террасы вокруг кратера",
    timeLabel: "ПЕПЕЛЬНЫЙ ДЕНЬ",
    accentColor: 0xff6738,
    accentTextColor: "#ffb08f",
    terrain: [
      { x: 0, y: 620 },
      { x: 240, y: 580 },
      { x: 280, y: 560 },
      { x: 1050, y: 560 },
      { x: 1300, y: 620 },
      { x: 1600, y: 690 },
      { x: 1900, y: 610 },
      { x: 2200, y: 520 },
      { x: 2500, y: 470 },
      { x: 2700, y: 450 },
      { x: 2900, y: 490 },
      { x: 3200, y: 570 },
      { x: 3500, y: 650 },
      { x: 3900, y: 590 },
      { x: 4200, y: 660 },
      { x: 4350, y: 690 },
      { x: 5120, y: 690 },
      { x: 5160, y: 720 },
      { x: 5400, y: 760 },
    ],
    obstacles: [
      createFortressObstacle("volcano-left-refinery", 1420, 655, 135, 185),
      createRockObstacle("volcano-crater-plug", 2640, 465, 220, 155),
      createRockObstacle("volcano-right-stack", 3750, 620, 125, 210),
    ],
    spawnX: { left: 600, right: 4800 },
    palette: {
      groundColor: 0x241515,
      surfaceColor: 0xff633d,
      detailColor: 0x71362c,
      obstacleColor: 0x432522,
      obstacleStrokeColor: 0xff8b62,
    },
  },
  {
    id: "neon",
    textureKey: "arena-neon",
    displayName: "НЕОНОВЫЕ РУИНЫ",
    description: "Мокрые крыши и обрушенные эстакады",
    timeLabel: "ДОЖДЛИВАЯ НОЧЬ",
    accentColor: 0xff4fd8,
    accentTextColor: "#ffb7ef",
    terrain: [
      { x: 0, y: 720 },
      { x: 240, y: 690 },
      { x: 280, y: 650 },
      { x: 1050, y: 650 },
      { x: 1300, y: 580 },
      { x: 1600, y: 580 },
      { x: 1900, y: 690 },
      { x: 2200, y: 640 },
      { x: 2500, y: 560 },
      { x: 2700, y: 560 },
      { x: 2900, y: 610 },
      { x: 3200, y: 710 },
      { x: 3500, y: 660 },
      { x: 3900, y: 570 },
      { x: 4200, y: 570 },
      { x: 4350, y: 590 },
      { x: 5120, y: 590 },
      { x: 5160, y: 640 },
      { x: 5400, y: 700 },
    ],
    obstacles: [
      createFortressObstacle("neon-left-tower", 1510, 590, 105, 220),
      createFortressObstacle("neon-center-pier", 2580, 575, 150, 150),
      createFortressObstacle("neon-right-tower", 3740, 605, 105, 220),
    ],
    spawnX: { left: 600, right: 4800 },
    palette: {
      groundColor: 0x11182b,
      surfaceColor: 0x37e4ff,
      detailColor: 0x58366f,
      obstacleColor: 0x24243c,
      obstacleStrokeColor: 0xff61df,
    },
  },
  {
    id: "temple",
    textureKey: "arena-temple",
    displayName: "ЗАТОНУВШИЙ ХРАМ",
    description: "Острова, протоки и древние дамбы",
    timeLabel: "ЛУННЫЙ ВОСХОД",
    accentColor: 0x65e0c3,
    accentTextColor: "#baf8e9",
    terrain: [
      { x: 0, y: 750 },
      { x: 240, y: 720 },
      { x: 280, y: 700 },
      { x: 1050, y: 700 },
      { x: 1300, y: 650 },
      { x: 1600, y: 720 },
      { x: 1900, y: 750 },
      { x: 2200, y: 680 },
      { x: 2500, y: 610 },
      { x: 2700, y: 600 },
      { x: 2900, y: 650 },
      { x: 3200, y: 750 },
      { x: 3500, y: 720 },
      { x: 3900, y: 640 },
      { x: 4200, y: 690 },
      { x: 4350, y: 700 },
      { x: 5120, y: 700 },
      { x: 5160, y: 730 },
      { x: 5400, y: 760 },
    ],
    obstacles: [
      createRockObstacle("temple-left-idol", 1490, 700, 135, 185),
      createFortressObstacle("temple-center-shrine", 2610, 615, 145, 175),
      createRockObstacle("temple-right-idol", 3800, 665, 135, 185),
    ],
    spawnX: { left: 600, right: 4800 },
    palette: {
      groundColor: 0x102c31,
      surfaceColor: 0x65e0c3,
      detailColor: 0x315f5b,
      obstacleColor: 0x294b48,
      obstacleStrokeColor: 0x9bf2dc,
    },
  },
  {
    id: "desert",
    textureKey: "arena-desert",
    displayName: "КЛАДБИЩЕ ПУСТЫНИ",
    description: "Дюны, обломки кораблей и сухая низина",
    timeLabel: "ПОЛДЕНЬ",
    accentColor: 0xffc062,
    accentTextColor: "#ffe0aa",
    terrain: [
      { x: 0, y: 690 },
      { x: 240, y: 640 },
      { x: 280, y: 610 },
      { x: 1050, y: 610 },
      { x: 1300, y: 550 },
      { x: 1600, y: 620 },
      { x: 1900, y: 700 },
      { x: 2200, y: 750 },
      { x: 2500, y: 770 },
      { x: 2700, y: 780 },
      { x: 2900, y: 750 },
      { x: 3200, y: 680 },
      { x: 3500, y: 600 },
      { x: 3900, y: 550 },
      { x: 4200, y: 610 },
      { x: 4350, y: 650 },
      { x: 5120, y: 650 },
      { x: 5160, y: 690 },
      { x: 5400, y: 730 },
    ],
    obstacles: [
      createRockObstacle("desert-left-wreck", 1510, 595, 210, 125),
      createRockObstacle("desert-basin-bones", 2660, 775, 180, 105),
      createFortressObstacle("desert-salvage-tower", 3810, 570, 115, 160),
    ],
    spawnX: { left: 600, right: 4800 },
    palette: {
      groundColor: 0x382416,
      surfaceColor: 0xffbd62,
      detailColor: 0x8a5a2c,
      obstacleColor: 0x62422d,
      obstacleStrokeColor: 0xffd18c,
    },
  },
  {
    id: "forest",
    textureKey: "arena-forest",
    displayName: "ЧЁРНЫЙ ЛЕС",
    description: "Корни-арки и крепость в мёртвых деревьях",
    timeLabel: "ПРЕДРАССВЕТ",
    accentColor: 0xa7bdc8,
    accentTextColor: "#d5e2e8",
    terrain: [
      { x: 0, y: 730 },
      { x: 240, y: 690 },
      { x: 280, y: 660 },
      { x: 1050, y: 660 },
      { x: 1300, y: 620 },
      { x: 1600, y: 560 },
      { x: 1900, y: 640 },
      { x: 2200, y: 710 },
      { x: 2500, y: 670 },
      { x: 2700, y: 620 },
      { x: 2900, y: 650 },
      { x: 3200, y: 720 },
      { x: 3500, y: 650 },
      { x: 3900, y: 570 },
      { x: 4200, y: 540 },
      { x: 4350, y: 550 },
      { x: 5120, y: 550 },
      { x: 5160, y: 590 },
      { x: 5400, y: 650 },
    ],
    obstacles: [
      createRockObstacle("forest-left-root", 1490, 590, 190, 150),
      createFortressObstacle("forest-ruined-keep", 2600, 640, 130, 190),
      createRockObstacle("forest-right-root", 3790, 595, 190, 150),
    ],
    spawnX: { left: 600, right: 4800 },
    palette: {
      groundColor: 0x151b1d,
      surfaceColor: 0x9aacb3,
      detailColor: 0x3e4b4f,
      obstacleColor: 0x2c3334,
      obstacleStrokeColor: 0xbccbd0,
    },
  },
  {
    id: "clockwork",
    textureKey: "arena-clockwork",
    displayName: "ЗАВОДНОЙ МЕГАПОЛИС",
    description: "Мосты, фабричные ярусы и рельсовые траншеи",
    timeLabel: "ЗОЛОТОЙ РАССВЕТ",
    accentColor: 0xf5b84b,
    accentTextColor: "#ffe0a0",
    terrain: [
      { x: 0, y: 650 },
      { x: 240, y: 610 },
      { x: 280, y: 580 },
      { x: 1050, y: 580 },
      { x: 1300, y: 640 },
      { x: 1600, y: 700 },
      { x: 1900, y: 620 },
      { x: 2200, y: 540 },
      { x: 2500, y: 540 },
      { x: 2700, y: 600 },
      { x: 2900, y: 700 },
      { x: 3200, y: 740 },
      { x: 3500, y: 650 },
      { x: 3900, y: 580 },
      { x: 4200, y: 650 },
      { x: 4350, y: 700 },
      { x: 5120, y: 700 },
      { x: 5160, y: 730 },
      { x: 5400, y: 760 },
    ],
    obstacles: [
      createFortressObstacle("clockwork-left-gearhouse", 1500, 675, 150, 175),
      createFortressObstacle("clockwork-center-bridge", 2520, 555, 210, 130),
      createRockObstacle("clockwork-right-flywheel", 3800, 610, 170, 170),
    ],
    spawnX: { left: 600, right: 4800 },
    palette: {
      groundColor: 0x2a2019,
      surfaceColor: 0xe2a945,
      detailColor: 0x72542d,
      obstacleColor: 0x53402b,
      obstacleStrokeColor: 0xf4ca75,
    },
  },
  {
    id: "moon",
    textureKey: "arena-moon",
    displayName: "ЛУННЫЙ КАРЬЕР",
    description: "Кратерная чаша и заброшенные буровые",
    timeLabel: "КОСМИЧЕСКАЯ НОЧЬ",
    accentColor: 0xc6dbff,
    accentTextColor: "#e2ecff",
    terrain: [
      { x: 0, y: 680 },
      { x: 240, y: 650 },
      { x: 280, y: 620 },
      { x: 1050, y: 620 },
      { x: 1300, y: 590 },
      { x: 1600, y: 650 },
      { x: 1900, y: 710 },
      { x: 2200, y: 750 },
      { x: 2500, y: 780 },
      { x: 2700, y: 790 },
      { x: 2900, y: 775 },
      { x: 3200, y: 730 },
      { x: 3500, y: 660 },
      { x: 3900, y: 600 },
      { x: 4200, y: 590 },
      { x: 4350, y: 610 },
      { x: 5120, y: 610 },
      { x: 5160, y: 640 },
      { x: 5400, y: 690 },
    ],
    obstacles: [
      createFortressObstacle("moon-left-rig", 1480, 625, 110, 215),
      createRockObstacle("moon-crater-boulder", 2660, 785, 180, 130),
      createFortressObstacle("moon-right-dome", 3790, 625, 155, 145),
    ],
    spawnX: { left: 600, right: 4800 },
    palette: {
      groundColor: 0x202632,
      surfaceColor: 0xbecfec,
      detailColor: 0x59677d,
      obstacleColor: 0x3d4655,
      obstacleStrokeColor: 0xe3edff,
    },
  },
  {
    id: "toxic",
    textureKey: "arena-toxic",
    displayName: "ТОКСИЧНЫЕ ТОПИ",
    description: "Радиоактивные протоки и заводы на сваях",
    timeLabel: "ЗЕЛЁНЫЕ СУМЕРКИ",
    accentColor: 0xa9ef46,
    accentTextColor: "#d9ff9d",
    terrain: [
      { x: 0, y: 760 },
      { x: 240, y: 730 },
      { x: 280, y: 700 },
      { x: 1050, y: 700 },
      { x: 1300, y: 650 },
      { x: 1600, y: 730 },
      { x: 1900, y: 760 },
      { x: 2200, y: 690 },
      { x: 2500, y: 740 },
      { x: 2700, y: 700 },
      { x: 2900, y: 650 },
      { x: 3200, y: 740 },
      { x: 3500, y: 770 },
      { x: 3900, y: 680 },
      { x: 4200, y: 640 },
      { x: 4350, y: 620 },
      { x: 5120, y: 620 },
      { x: 5160, y: 670 },
      { x: 5400, y: 730 },
    ],
    obstacles: [
      createFortressObstacle("toxic-left-vat", 1490, 690, 130, 180),
      createRockObstacle("toxic-center-island", 2660, 720, 220, 110),
      createFortressObstacle("toxic-right-vat", 3780, 710, 130, 180),
    ],
    spawnX: { left: 600, right: 4800 },
    palette: {
      groundColor: 0x18231a,
      surfaceColor: 0xa0dc3e,
      detailColor: 0x4b6b2f,
      obstacleColor: 0x33402a,
      obstacleStrokeColor: 0xc8f876,
    },
  },
  {
    id: "storm",
    textureKey: "arena-storm",
    displayName: "ГРОЗОВОЙ БЕРЕГ",
    description: "Две морские скалы над глубокой расселиной",
    timeLabel: "ГРОЗОВАЯ НОЧЬ",
    accentColor: 0x71caff,
    accentTextColor: "#bce8ff",
    terrain: [
      { x: 0, y: 600 },
      { x: 240, y: 560 },
      { x: 280, y: 530 },
      { x: 1050, y: 530 },
      { x: 1300, y: 590 },
      { x: 1600, y: 670 },
      { x: 1900, y: 740 },
      { x: 2200, y: 790 },
      { x: 2500, y: 820 },
      { x: 2700, y: 830 },
      { x: 2900, y: 815 },
      { x: 3200, y: 770 },
      { x: 3500, y: 680 },
      { x: 3900, y: 590 },
      { x: 4200, y: 540 },
      { x: 4350, y: 540 },
      { x: 5120, y: 540 },
      { x: 5160, y: 580 },
      { x: 5400, y: 620 },
    ],
    obstacles: [
      createFortressObstacle("storm-left-watch", 1480, 625, 120, 200),
      createRockObstacle("storm-ravine-wreck", 2660, 825, 190, 120),
      createFortressObstacle("storm-right-lighthouse", 3770, 625, 115, 225),
    ],
    spawnX: { left: 600, right: 4800 },
    palette: {
      groundColor: 0x111d2a,
      surfaceColor: 0x70c5ee,
      detailColor: 0x365873,
      obstacleColor: 0x26394b,
      obstacleStrokeColor: 0xa5ddf8,
    },
  },
] as const;

export function isArenaId(value: unknown): value is ArenaId {
  return ARENAS.some((arena) => arena.id === value);
}

export function getArenaDefinition(id: ArenaId): ArenaDefinition {
  return ARENAS.find((arena) => arena.id === id) ?? ARENAS[0];
}

export function getTerrainHeightAt(
  terrain: readonly TerrainPoint[],
  x: number,
): number {
  const firstPoint = terrain[0];
  const lastPoint = terrain.at(-1);

  if (!firstPoint || !lastPoint) {
    throw new Error("Arena terrain must contain at least one point.");
  }

  if (x <= firstPoint.x) {
    return firstPoint.y;
  }

  if (x >= lastPoint.x) {
    return lastPoint.y;
  }

  for (let index = 1; index < terrain.length; index += 1) {
    const rightPoint = terrain[index];
    const leftPoint = terrain[index - 1];

    if (!leftPoint || !rightPoint || x > rightPoint.x) {
      continue;
    }

    const segmentWidth = rightPoint.x - leftPoint.x;
    const progress =
      segmentWidth === 0 ? 0 : (x - leftPoint.x) / segmentWidth;

    return leftPoint.y + (rightPoint.y - leftPoint.y) * progress;
  }

  return lastPoint.y;
}
