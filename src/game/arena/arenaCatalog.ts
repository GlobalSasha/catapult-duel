export type ArenaId = "highlands" | "canyon";

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

export const DEFAULT_ARENA_ID: ArenaId = "highlands";

export const ARENAS: readonly ArenaDefinition[] = [
  {
    id: "highlands",
    textureKey: "arena-highlands",
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
