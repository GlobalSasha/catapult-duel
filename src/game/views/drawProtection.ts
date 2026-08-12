import * as Phaser from "phaser";

import type { ProtectionState } from "../core/protection";

export const CASTLE_TOWER_TEXTURE_KEY = "castle-tower";

export const PROTECTION_VIEW_COLORS = {
  castle: { body: 0x625c54, detail: 0xd2a76b },
} as const;

export function createCastleTowerSprite(
  scene: Phaser.Scene,
  protection: Pick<ProtectionState, "x" | "y" | "width" | "height">,
  depth: number,
): Phaser.GameObjects.Image {
  return scene.add
    .image(protection.x, protection.y, CASTLE_TOWER_TEXTURE_KEY)
    .setOrigin(0)
    .setDisplaySize(protection.width, protection.height)
    .setDepth(depth);
}
