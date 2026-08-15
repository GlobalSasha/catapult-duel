import * as Phaser from "phaser";

import {
  calculateLogicalViewport,
  GAME_HEIGHT,
  GAME_WIDTH,
  RENDER_HEIGHT,
  RENDER_SCALE,
  RENDER_WIDTH,
} from "./gameDimensions";

export function getLogicalViewport(scene: Phaser.Scene) {
  return calculateLogicalViewport(
    scene.scale.gameSize.width,
    scene.scale.gameSize.height,
    RENDER_SCALE,
  );
}

export function configure2KCamera(scene: Phaser.Scene): void {
  const viewport = getLogicalViewport(scene);

  scene.cameras.main
    .setOrigin(0, 0)
    .setZoom(RENDER_SCALE)
    .setScroll(-viewport.overflowX, -viewport.overflowY);
  scene.cameras.main.disableCull = true;
}

export function set2KCameraBounds(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const horizontalInset = (RENDER_WIDTH - GAME_WIDTH) / 2;
  const verticalInset = (RENDER_HEIGHT - GAME_HEIGHT) / 2;

  scene.cameras.main.setBounds(
    x + horizontalInset,
    y + verticalInset,
    width,
    height,
  );
}

export function center2KCameraOn(
  scene: Phaser.Scene,
  x: number,
  y: number,
): void {
  const camera = scene.cameras.main;
  const viewportWidth = camera.width / camera.zoom;
  const viewportHeight = camera.height / camera.zoom;
  camera.setScroll(
    camera.clampX(x - viewportWidth / 2),
    camera.clampY(y - viewportHeight / 2),
  );
}

export function follow2KCameraOnStep(
  scene: Phaser.Scene,
  x: number,
  y: number,
  lerp = 0.12,
): void {
  const camera = scene.cameras.main;
  const targetX = camera.clampX(x - camera.width / camera.zoom / 2);
  const targetY = camera.clampY(y - camera.height / camera.zoom / 2);

  camera.setScroll(
    Phaser.Math.Linear(camera.scrollX, targetX, lerp),
    Phaser.Math.Linear(camera.scrollY, targetY, lerp),
  );
}

export function pan2KCameraOn(
  scene: Phaser.Scene,
  x: number,
  y: number,
  duration: number,
): void {
  const camera = scene.cameras.main;
  const viewportWidth = camera.width / camera.zoom;
  const viewportHeight = camera.height / camera.zoom;

  scene.tweens.add({
    targets: camera,
    scrollX: camera.clampX(x - viewportWidth / 2),
    scrollY: camera.clampY(y - viewportHeight / 2),
    duration,
    ease: "Sine.easeInOut",
  });
}

export function sharpenSceneText(scene: Phaser.Scene): void {
  const sharpen = (gameObject: Phaser.GameObjects.GameObject): void => {
    if (gameObject instanceof Phaser.GameObjects.Text) {
      gameObject.setResolution(RENDER_SCALE);
      return;
    }

    if (gameObject instanceof Phaser.GameObjects.Container) {
      gameObject.list.forEach(sharpen);
    }
  };

  scene.children.list.forEach(sharpen);
}
