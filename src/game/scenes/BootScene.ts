import * as Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.load.image("arena-highlands", "assets/arena-highlands.png");
    this.load.image("arena-canyon", "assets/arena-canyon.png");
    this.load.image("catapult-left", "assets/catapult-left.png");
    this.load.image("catapult-right", "assets/catapult-right.png");
    this.load.image("catapult-left-body", "assets/catapult-left-body.png");
    this.load.image("catapult-left-arm", "assets/catapult-left-arm.png");
    this.load.image("catapult-left-wheel", "assets/catapult-left-wheel.png");
    this.load.image("catapult-right-body", "assets/catapult-right-body.png");
    this.load.image("catapult-right-arm", "assets/catapult-right-arm.png");
    this.load.image("catapult-right-wheel", "assets/catapult-right-wheel.png");
    this.load.image("stone", "assets/stone.png");
    this.load.image("impact-burst", "assets/impact-burst.png");
  }

  create(): void {
    this.scene.start("MenuScene");
  }
}
