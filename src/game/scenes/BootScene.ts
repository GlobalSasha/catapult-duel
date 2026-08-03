import * as Phaser from "phaser";

import { configure2KCamera, sharpenSceneText } from "../rendering";

export class BootScene extends Phaser.Scene {
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private logo!: Phaser.GameObjects.Text;

  constructor() {
    super("BootScene");
  }

  preload(): void {
    configure2KCamera(this);
    this.drawLoadingScreen();
    this.load.on("progress", (progress: number) => {
      this.progressFill.setScale(progress, 1);
      this.progressText.setText(`ЗАГРУЗКА МИРА · ${Math.round(progress * 100)}%`);
    });
    this.load.image("arena-highlands", "assets/arena-highlands.webp");
    this.load.image("arena-canyon", "assets/arena-canyon.webp");
    this.load.image("arena-glacier", "assets/arena-glacier.webp");
    this.load.image("arena-volcano", "assets/arena-volcano.webp");
    this.load.image("arena-neon", "assets/arena-neon.webp");
    this.load.image("arena-temple", "assets/arena-temple.webp");
    this.load.image("arena-desert", "assets/arena-desert.webp");
    this.load.image("arena-forest", "assets/arena-forest.webp");
    this.load.image("arena-clockwork", "assets/arena-clockwork.webp");
    this.load.image("arena-moon", "assets/arena-moon.webp");
    this.load.image("arena-toxic", "assets/arena-toxic.webp");
    this.load.image("arena-storm", "assets/arena-storm.webp");
    this.load.image("catapult-left", "assets/catapult-left.png");
    this.load.image("catapult-right", "assets/catapult-right.png");
    this.load.image("catapult-left-body", "assets/catapult-left-body.png");
    this.load.image("catapult-left-arm", "assets/catapult-left-arm.png");
    this.load.image("catapult-left-wheel", "assets/catapult-left-wheel.png");
    this.load.image("catapult-right-body", "assets/catapult-right-body.png");
    this.load.image("catapult-right-arm", "assets/catapult-right-arm.png");
    this.load.image("catapult-right-wheel", "assets/catapult-right-wheel.png");
    this.load.image("stone", "assets/stone.png");
    this.load.image(
      "projectile-stone-3d",
      "assets/projectile-stone-3d.png",
    );
    this.load.image(
      "projectile-fire-3d",
      "assets/projectile-fire-3d.png",
    );
    this.load.image(
      "projectile-ice-3d",
      "assets/projectile-ice-3d.png",
    );
    this.load.image(
      "projectile-diamond-3d",
      "assets/projectile-diamond-3d.png",
    );
    this.load.image(
      "projectile-bomb-3d",
      "assets/projectile-bomb-3d.png",
    );
    this.load.image("impact-burst", "assets/impact-burst.png");
  }

  create(): void {
    sharpenSceneText(this);
    this.progressFill.setScale(1, 1);
    this.progressText.setText("АРЕНЫ ГОТОВЫ · 100%");
    this.logo.setScale(0.92).setAlpha(0);
    this.tweens.add({
      targets: this.logo,
      alpha: 1,
      scale: 1,
      duration: 560,
      ease: "Back.easeOut",
    });
    this.cameras.main.fadeIn(260, 4, 8, 14);
    this.time.delayedCall(1250, () => {
      this.cameras.main.fadeOut(260, 4, 8, 14);
      this.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => this.scene.start("HomeScene"),
      );
    });
  }

  private drawLoadingScreen(): void {
    const background = this.add.graphics();
    background.fillGradientStyle(0x050a12, 0x111d2d, 0x1f1712, 0x050a12, 1);
    background.fillRect(0, 0, 1600, 900);

    for (let index = 0; index < 30; index += 1) {
      const x = 30 + ((index * 191) % 1540);
      const y = 120 + ((index * 83) % 650);
      const spark = this.add.circle(x, y, 1 + (index % 3), 0xffd166, 0.12 + (index % 4) * 0.04);
      this.tweens.add({
        targets: spark,
        y: y - 34,
        alpha: 0.02,
        duration: 1400 + (index % 6) * 260,
        delay: index * 60,
        yoyo: true,
        repeat: -1,
      });
    }

    this.add
      .text(800, 275, "ПУСТОШИ ПРИЗЫВАЮТ", {
        color: "#ffd166",
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        letterSpacing: 6,
      })
      .setOrigin(0.5);
    this.logo = this.add
      .text(800, 350, "CATAPULT\nDUEL", {
        color: "#f7f4ec",
        fontFamily: "Arial, sans-serif",
        fontSize: "68px",
        fontStyle: "bold",
        align: "center",
        lineSpacing: -12,
        letterSpacing: 8,
        stroke: "#0b1220",
        strokeThickness: 9,
      })
      .setOrigin(0.5);
    this.add
      .text(800, 506, "MAD MAX × FALLOUT · ТАКТИЧЕСКАЯ АРТИЛЛЕРИЯ", {
        color: "#9fb2ce",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    this.add
      .rectangle(800, 620, 560, 20, 0x08111e, 1)
      .setStrokeStyle(2, 0x617b9e, 0.7);
    this.progressFill = this.add
      .rectangle(524, 620, 552, 12, 0x7ee2a8, 1)
      .setOrigin(0, 0.5)
      .setScale(0, 1);
    this.progressText = this.add
      .text(800, 662, "ЗАГРУЗКА МИРА · 0%", {
        color: "#d8e4f2",
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 1.4,
      })
      .setOrigin(0.5);
    this.add
      .text(800, 812, "2K HIGH DETAIL · 12 АРЕН", {
        color: "#6f819d",
        fontFamily: "Arial, sans-serif",
        fontSize: "9px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5);
  }
}
