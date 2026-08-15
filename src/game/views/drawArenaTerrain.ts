import * as Phaser from "phaser";

import {
  getTerrainHeightAt,
  type ArenaDefinition,
} from "../arena/arenaCatalog";
import { GAME_CONFIG } from "../core/gameConfig";

const getLighterColor = (color: number, amount: number): number =>
  Phaser.Display.Color.IntegerToColor(color).lighten(amount).color;

const getDarkerColor = (color: number, amount: number): number =>
  Phaser.Display.Color.IntegerToColor(color).darken(amount).color;

/** Draws a solid battlefield surface with deterministic material detail. */
export const drawArenaTerrain = (
  scene: Phaser.Scene,
  arena: ArenaDefinition,
  depth: number,
): void => {
  const firstPoint = arena.terrain[0];
  const lastPoint = arena.terrain.at(-1);

  if (!firstPoint || !lastPoint) {
    return;
  }

  const terrain = scene.add.graphics().setDepth(depth);
  terrain.fillStyle(arena.palette.groundColor, 0.98);
  terrain.lineStyle(6, arena.palette.surfaceColor, 0.9);
  terrain.beginPath();
  terrain.moveTo(firstPoint.x, firstPoint.y);
  arena.terrain.slice(1).forEach((point) => terrain.lineTo(point.x, point.y));
  terrain.lineTo(lastPoint.x, GAME_CONFIG.world.height);
  terrain.lineTo(firstPoint.x, GAME_CONFIG.world.height);
  terrain.closePath();
  terrain.fillPath();
  terrain.strokePath();

  const material = scene.add.graphics().setDepth(depth + 1);
  const highlight = getLighterColor(arena.palette.detailColor, 14);
  const shadow = getDarkerColor(arena.palette.groundColor, 18);
  const seam = getLighterColor(arena.palette.surfaceColor, 8);

  for (let index = 0; index < 52; index += 1) {
    const x = 70 + ((index * 197) % (GAME_CONFIG.world.width - 140));
    const surfaceY = getTerrainHeightAt(arena.terrain, x);
    const depthOffset = 26 + ((index * 43) % 150);
    const width = 38 + ((index * 29) % 92);
    const height = 7 + ((index * 11) % 16);

    material.fillStyle(index % 3 === 0 ? highlight : shadow, 0.16);
    material.fillRoundedRect(x - width / 2, surfaceY + depthOffset, width, height, 4);

    if (index % 2 === 0) {
      material.fillStyle(seam, 0.16);
      material.fillCircle(
        x + width * 0.24,
        surfaceY + depthOffset + height + 16,
        4 + (index % 4) * 2,
      );
    }
  }

  for (let x = 0; x < GAME_CONFIG.world.width; x += 150) {
    const surfaceY = getTerrainHeightAt(arena.terrain, x);
    material.lineStyle(3, seam, 0.26);
    material.lineBetween(x, surfaceY + 12, x + 92, surfaceY + 18);
    material.lineStyle(2, highlight, 0.17);
    material.lineBetween(x + 35, surfaceY + 56, x + 132, surfaceY + 65);
  }
};
