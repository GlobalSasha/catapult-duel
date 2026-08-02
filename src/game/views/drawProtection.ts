import * as Phaser from "phaser";

import type { ProtectionState } from "../core/protection";

export const PROTECTION_VIEW_COLORS = {
  wood: { body: 0x40332b, detail: 0xc87538 },
  net: { body: 0x293238, detail: 0x91a39e },
  metal: { body: 0x363a3d, detail: 0xd07a38 },
} as const;

export function drawProtectionBody(
  graphics: Phaser.GameObjects.Graphics,
  protection: Pick<
    ProtectionState,
    "type" | "x" | "y" | "width" | "height"
  >,
): number {
  const centerX = protection.x + protection.width / 2;
  const bottomY = protection.y + protection.height;
  const colors = PROTECTION_VIEW_COLORS[protection.type];

  graphics.fillStyle(0x111416, 0.72);
  graphics.fillRoundedRect(
    protection.x - 5,
    protection.y + 7,
    protection.width + 10,
    protection.height,
    5,
  );
  graphics.lineStyle(4, 0x16191b, 0.98);

  if (protection.type === "wood") {
    const plankWidth = protection.width / 4;
    for (let index = 0; index < 4; index += 1) {
      const x = protection.x + index * plankWidth;
      graphics.fillStyle(
        index % 2 === 0 ? colors.body : 0x5b3e2d,
        1,
      );
      graphics.fillRoundedRect(
        x,
        protection.y + (index % 2) * 8,
        plankWidth - 3,
        protection.height - (index % 2) * 8,
        4,
      );
      graphics.strokeRoundedRect(
        x,
        protection.y + (index % 2) * 8,
        plankWidth - 3,
        protection.height - (index % 2) * 8,
        4,
      );
      graphics.fillStyle(
        index === 1 ? 0x2d6b72 : index === 2 ? 0x8d482c : 0x6b503b,
        0.68,
      );
      graphics.fillRect(
        x + 3,
        protection.y + 16 + (index % 2) * 9,
        plankWidth - 9,
        15,
      );
      graphics.fillStyle(0xb8a283, 0.8);
      graphics.fillCircle(x + plankWidth * 0.45, protection.y + 12, 3);
      graphics.fillCircle(x + plankWidth * 0.55, bottomY - 12, 3);
    }
    graphics.lineStyle(9, 0x1d2225, 1);
    graphics.lineBetween(
      protection.x - 4,
      bottomY - 12,
      protection.x + protection.width + 4,
      protection.y + 18,
    );
    graphics.lineStyle(4, colors.detail, 0.9);
    graphics.lineBetween(
      protection.x - 4,
      bottomY - 12,
      protection.x + protection.width + 4,
      protection.y + 18,
    );
  } else if (protection.type === "net") {
    graphics.lineStyle(9, 0x171b1d, 1);
    graphics.strokeRoundedRect(
      protection.x,
      protection.y,
      protection.width,
      protection.height,
      4,
    );
    graphics.lineStyle(4, colors.detail, 0.9);
    graphics.strokeRoundedRect(
      protection.x,
      protection.y,
      protection.width,
      protection.height,
      4,
    );
    graphics.lineStyle(2, 0x65736f, 0.74);
    for (let offset = -protection.height; offset < protection.width; offset += 13) {
      graphics.lineBetween(
        protection.x + Math.max(0, offset),
        protection.y,
        protection.x + Math.min(protection.width, offset + protection.height),
        bottomY,
      );
    }
    for (let offset = 0; offset < protection.width + protection.height; offset += 13) {
      graphics.lineBetween(
        protection.x + Math.max(0, offset - protection.height),
        bottomY,
        protection.x + Math.min(protection.width, offset),
        protection.y,
      );
    }
    graphics.lineStyle(7, 0x24292b, 1);
    graphics.lineBetween(
      protection.x + 3,
      bottomY - 5,
      protection.x + protection.width - 3,
      protection.y + 5,
    );
    graphics.lineStyle(3, colors.detail, 0.86);
    graphics.lineBetween(
      protection.x + 3,
      bottomY - 5,
      protection.x + protection.width - 3,
      protection.y + 5,
    );
  } else {
    graphics.fillStyle(colors.body, 1);
    graphics.fillRoundedRect(
      protection.x,
      protection.y,
      protection.width,
      protection.height,
      8,
    );
    graphics.lineStyle(4, 0x15191b, 1);
    graphics.strokeRoundedRect(
      protection.x,
      protection.y,
      protection.width,
      protection.height,
      8,
    );
    graphics.fillStyle(0x596168, 0.72);
    graphics.fillRect(
      protection.x + 6,
      protection.y + 8,
      protection.width * 0.42,
      protection.height - 16,
    );
    graphics.fillStyle(0x252a2e, 0.9);
    graphics.fillRect(
      centerX + 2,
      protection.y + 5,
      protection.width * 0.36,
      protection.height - 10,
    );
    graphics.lineStyle(4, colors.detail, 0.78);
    graphics.lineBetween(
      centerX,
      protection.y + 10,
      centerX,
      bottomY - 10,
    );
    [14, protection.width - 14].forEach((offset) => {
      graphics.fillStyle(0xc4b294, 0.9);
      graphics.fillCircle(
        protection.x + offset,
        protection.y + 14,
        3,
      );
      graphics.fillCircle(
        protection.x + offset,
        bottomY - 14,
        3,
      );
    });
    graphics.lineStyle(3, 0xe1a047, 0.82);
    for (let y = protection.y + 12; y < bottomY - 12; y += 18) {
      graphics.lineBetween(
        protection.x + 5,
        y + 10,
        protection.x + protection.width * 0.32,
        y,
      );
    }
    graphics.lineStyle(3, 0x171b1d, 0.95);
    graphics.strokeCircle(centerX, protection.y + 25, 10);
    graphics.lineBetween(
      centerX,
      protection.y + 25,
      centerX + 6,
      protection.y + 19,
    );
  }

  graphics.fillStyle(0x181c1e, 1);
  graphics.fillRect(protection.x - 7, bottomY - 5, 13, 11);
  graphics.fillRect(
    protection.x + protection.width - 6,
    bottomY - 5,
    13,
    11,
  );

  return colors.detail;
}
