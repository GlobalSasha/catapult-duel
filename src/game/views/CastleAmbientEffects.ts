import * as Phaser from "phaser";

import type { ArenaId } from "../arena/arenaCatalog";
import { GAME_WIDTH } from "../gameDimensions";

interface CastleAnchor {
  x: number;
  y: number;
  dragonScale: number;
  orbitRadius: number;
}

const CASTLE_ANCHORS: readonly CastleAnchor[] = [
  { x: 190, y: 280, dragonScale: 1.08, orbitRadius: 86 },
  { x: 1000, y: 375, dragonScale: 0.82, orbitRadius: 62 },
  { x: 1405, y: 280, dragonScale: 1.14, orbitRadius: 92 },
];

export function createCastleAmbientEffects(
  scene: Phaser.Scene,
  arenaId: ArenaId,
  segmentCount: number,
): void {
  if (arenaId !== "highlands") {
    return;
  }

  let castleIndex = 0;
  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    const mirrored = segmentIndex % 2 === 1;

    CASTLE_ANCHORS.forEach((anchor) => {
      const localX = mirrored ? GAME_WIDTH - anchor.x : anchor.x;
      const worldX = segmentIndex * GAME_WIDTH + localX;
      const direction = mirrored ? -1 : 1;

      createDragonOrbit(
        scene,
        worldX,
        anchor.y - 58,
        anchor.dragonScale,
        anchor.orbitRadius,
        direction,
        castleIndex,
      );
      scheduleSkeletonFalls(
        scene,
        worldX,
        anchor.y,
        direction,
        castleIndex,
      );
      castleIndex += 1;
    });
  }
}

function createDragonOrbit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
  radius: number,
  direction: 1 | -1,
  index: number,
): void {
  const orbit = new Phaser.GameObjects.Container(scene, x, y)
    .setScrollFactor(0.18, 0)
    .setDepth(-76);
  const dragon = new Phaser.GameObjects.Container(
    scene,
    radius,
    0,
  ).setScale(scale * direction, scale);

  const rearWing = new Phaser.GameObjects.Graphics(scene);
  rearWing.fillStyle(0x111522, 0.82);
  rearWing.fillTriangle(-4, -1, -28, -27, 8, -8);
  rearWing.lineStyle(2, 0x6b4638, 0.54);
  rearWing.lineBetween(-4, -2, -26, -24);

  const body = new Phaser.GameObjects.Graphics(scene);
  body.fillStyle(0x11141c, 0.96);
  body.fillEllipse(0, 0, 34, 10);
  body.fillCircle(16, -3, 6);
  body.fillTriangle(20, -4, 29, -7, 21, 0);
  body.fillTriangle(16, -8, 18, -16, 21, -8);
  body.fillTriangle(10, -7, 12, -14, 15, -7);
  body.fillTriangle(-15, 1, -38, -9, -25, 5);
  body.lineStyle(3, 0x11141c, 0.96);
  body.lineBetween(-8, 3, -18, 12);
  body.lineBetween(4, 3, 14, 11);
  body.fillStyle(0xffa54f, 0.94);
  body.fillCircle(18, -5, 1.7);

  const frontWing = new Phaser.GameObjects.Graphics(scene);
  frontWing.fillStyle(0x1d2230, 0.94);
  frontWing.fillTriangle(1, 0, 15, -30, 21, -5);
  frontWing.lineStyle(2, 0x8c5a40, 0.6);
  frontWing.lineBetween(2, -1, 14, -27);

  const flame = new Phaser.GameObjects.Graphics(scene);
  flame.fillStyle(0xff7b38, 0.92);
  flame.fillTriangle(26, -6, 44, -11, 35, -2);
  flame.fillStyle(0xffd166, 0.94);
  flame.fillTriangle(27, -6, 38, -8, 33, -4);

  dragon.add([rearWing, body, frontWing, flame]);
  dragon.setAngle(90 * direction);
  orbit.add(dragon);
  scene.add.existing(orbit);

  const flapDuration = 280 + (index % 4) * 34;
  scene.tweens.add({
    targets: [rearWing, frontWing],
    scaleY: 0.28,
    duration: flapDuration,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  scene.tweens.add({
    targets: flame,
    alpha: 0.18,
    scaleX: 0.45,
    duration: 190 + (index % 3) * 35,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  scene.tweens.add({
    targets: orbit,
    angle: direction * 360,
    duration: 8_800 + (index % 5) * 760,
    repeat: -1,
    ease: "Linear",
  });
  scene.tweens.add({
    targets: dragon,
    y: 8,
    duration: 720 + (index % 3) * 90,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

function scheduleSkeletonFalls(
  scene: Phaser.Scene,
  x: number,
  y: number,
  direction: 1 | -1,
  index: number,
): void {
  const drop = () => createFallingSkeleton(scene, x, y, direction, index);
  const delay = 15_000 + (index % 7) * 1_450;

  scene.time.delayedCall(2_200 + (index % 6) * 1_050, drop);
  scene.time.addEvent({ delay, loop: true, callback: drop });
}

function createFallingSkeleton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  direction: 1 | -1,
  index: number,
): void {
  const skeleton = new Phaser.GameObjects.Container(scene, x, y + 4)
    .setScrollFactor(0.18, 0)
    .setDepth(-74)
    .setScale(0.92);
  const bones = new Phaser.GameObjects.Graphics(scene);

  bones.lineStyle(3, 0xd7d1bd, 0.9);
  bones.strokeCircle(0, -13, 6);
  bones.lineBetween(0, -7, 0, 12);
  bones.lineBetween(-7, -2, 7, -2);
  bones.lineBetween(-6, 3, 6, 3);
  bones.lineBetween(-7, -1, -13, 8);
  bones.lineBetween(7, -1, 13, 6);
  bones.lineBetween(0, 12, -8, 25);
  bones.lineBetween(0, 12, 9, 24);
  bones.fillStyle(0x11141c, 0.95);
  bones.fillCircle(-2, -14, 1.3);
  bones.fillCircle(2, -14, 1.3);
  skeleton.add(bones);
  scene.add.existing(skeleton);

  scene.tweens.add({
    targets: skeleton,
    x: x + direction * (26 + (index % 3) * 8),
    y: y + 165 + (index % 4) * 18,
    angle: direction * (130 + (index % 3) * 55),
    alpha: 0,
    duration: 2_400 + (index % 4) * 180,
    ease: "Quad.easeIn",
    onComplete: () => skeleton.destroy(),
  });
}
