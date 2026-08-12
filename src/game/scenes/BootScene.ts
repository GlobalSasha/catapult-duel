import * as Phaser from "phaser";

import { configure2KCamera, sharpenSceneText } from "../rendering";
import { RETRO_UI } from "../ui/retroTheme";

const DISPLAY_FONT = RETRO_UI.font.display;
const UI_FONT = RETRO_UI.font.ui;

export class BootScene extends Phaser.Scene {
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private logo!: Phaser.GameObjects.Text;
  private backdropWash!: Phaser.GameObjects.Graphics;
  private transitionStarted = false;
  private canSkip = false;

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
    this.load.image("catapult-left", "assets/catapult-left.webp");
    this.load.image("catapult-right", "assets/catapult-right.webp");
    this.load.image("catapult-left-body", "assets/catapult-left-body.webp");
    this.load.image("catapult-left-arm", "assets/catapult-left-arm.webp");
    this.load.image("catapult-left-wheel", "assets/catapult-left-wheel.webp");
    this.load.image("catapult-right-body", "assets/catapult-right-body.webp");
    this.load.image("catapult-right-arm", "assets/catapult-right-arm.webp");
    this.load.image("catapult-right-wheel", "assets/catapult-right-wheel.webp");
    this.load.image("castle-tower", "assets/castle-tower.webp");
    this.load.image(
      "map-highlands-watchtower",
      "assets/map-elements/highlands-watchtower.webp",
    );
    this.load.image(
      "map-highlands-ruined-gate",
      "assets/map-elements/highlands-ruined-gate.webp",
    );
    this.load.image(
      "map-moon-crashed-lander",
      "assets/map-elements/moon-crashed-lander.webp",
    );
    this.load.image(
      "map-moon-drill-rig",
      "assets/map-elements/moon-drill-rig.webp",
    );
    this.load.image(
      "map-volcano-lava-pump",
      "assets/map-elements/volcano-lava-pump.webp",
    );
    this.load.image(
      "map-volcano-collapsed-foundry",
      "assets/map-elements/volcano-collapsed-foundry.webp",
    );
    const arenaElementTextures = [
      ["map-canyon-broken-arch", "canyon-broken-arch"],
      ["map-canyon-obelisk", "canyon-obelisk"],
      ["map-glacier-ice-bastion", "glacier-ice-bastion"],
      ["map-glacier-frozen-drill", "glacier-frozen-drill"],
      ["map-neon-crashed-skimmer", "neon-crashed-skimmer"],
      ["map-neon-relay-tower", "neon-relay-tower"],
      ["map-temple-flooded-shrine", "temple-flooded-shrine"],
      ["map-temple-broken-aqueduct", "temple-broken-aqueduct"],
      ["map-desert-crashed-airship", "desert-crashed-airship"],
      ["map-desert-cargo-module", "desert-cargo-module"],
      ["map-forest-root-watchtower", "forest-root-watchtower"],
      ["map-forest-ruined-chapel", "forest-ruined-chapel"],
      ["map-clockwork-boiler-tower", "clockwork-boiler-tower"],
      ["map-clockwork-mechanical-crane", "clockwork-mechanical-crane"],
      ["map-toxic-damaged-reactor", "toxic-damaged-reactor"],
      ["map-toxic-pipe-station", "toxic-pipe-station"],
      ["map-storm-ruined-lighthouse", "storm-ruined-lighthouse"],
      ["map-storm-wrecked-ship", "storm-wrecked-ship"],
    ] as const;

    arenaElementTextures.forEach(([key, fileName]) => {
      this.load.image(key, `assets/map-elements/${fileName}.webp`);
    });
    this.load.image("stone", "assets/stone.webp");
    this.load.image(
      "projectile-stone-3d",
      "assets/projectile-stone-3d.webp",
    );
    this.load.image(
      "projectile-fire-3d",
      "assets/projectile-fire-3d.webp",
    );
    this.load.image(
      "projectile-ice-3d",
      "assets/projectile-ice-3d.webp",
    );
    this.load.image(
      "projectile-diamond-3d",
      "assets/projectile-diamond-3d.webp",
    );
    this.load.image(
      "projectile-bomb-3d",
      "assets/projectile-bomb-3d.webp",
    );
    this.load.image("impact-burst", "assets/impact-burst.webp");
  }

  create(): void {
    this.transitionStarted = false;
    this.canSkip = false;
    const campaignBackdrop = this.add
      .image(800, 450, "arena-highlands")
      .setDisplaySize(1680, 945)
      .setTint(0xd58a59)
      .setDepth(-10);
    this.backdropWash.setAlpha(0.9).setDepth(-9);
    this.tweens.add({
      targets: campaignBackdrop,
      scaleX: campaignBackdrop.scaleX * 0.97,
      scaleY: campaignBackdrop.scaleY * 0.97,
      duration: 2400,
      ease: "Sine.easeOut",
    });
    sharpenSceneText(this);
    this.progressFill.setScale(1, 1);
    this.progressText.setText("АРЕНЫ ГОТОВЫ · 100%");
    this.logo.setScale(0.92).setAlpha(1);
    this.tweens.add({
      targets: this.logo,
      alpha: 1,
      scale: 1,
      duration: 420,
      ease: "Linear",
    });
    this.cameras.main.fadeIn(260, 4, 8, 14);
    this.time.delayedCall(480, () => {
      this.canSkip = true;
    });
    this.time.delayedCall(2200, () => this.startHome());
    this.input.keyboard?.on("keydown", this.handleSkip, this);
    this.input.on("pointerdown", this.handlePointerSkip, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleSkip, this);
      this.input.off("pointerdown", this.handlePointerSkip, this);
    });
  }

  private drawLoadingScreen(): void {
    this.backdropWash = this.add.graphics();
    this.backdropWash.fillGradientStyle(
      RETRO_UI.colors.orangeDark,
      RETRO_UI.colors.orange,
      RETRO_UI.colors.ink,
      RETRO_UI.colors.ink,
      1,
    );
    this.backdropWash.fillRect(0, 0, 1600, 900);

    for (let index = 0; index < 30; index += 1) {
      const x = 30 + ((index * 191) % 1540);
      const y = 120 + ((index * 83) % 650);
      const spark = this.add.rectangle(
        x,
        y,
        3 + (index % 3) * 2,
        3 + (index % 2) * 2,
        index % 2 === 0 ? RETRO_UI.colors.cream : RETRO_UI.colors.cyan,
        0.12 + (index % 4) * 0.04,
      );
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
      .text(800, 264, "ХРОНИКИ ВЕЛИКОЙ ОСАДЫ", {
        color: RETRO_UI.text.cyan,
        fontFamily: UI_FONT,
        fontSize: "13px",
        fontStyle: "bold",
        letterSpacing: 6,
      })
      .setOrigin(0.5);
    this.logo = this.add
      .text(800, 348, "CATAPULT\nDUEL", {
        color: RETRO_UI.text.orange,
        fontFamily: DISPLAY_FONT,
        fontSize: "68px",
        fontStyle: "bold",
        align: "center",
        lineSpacing: -12,
        letterSpacing: 8,
        stroke: RETRO_UI.text.ink,
        strokeThickness: 9,
      })
      .setOrigin(0.5);
    this.add
      .text(800, 506, "СТРАТЕГИЯ · ВЕТЕР · КАМЕНЬ · СТАЛЬ", {
        color: RETRO_UI.text.primary,
        fontFamily: UI_FONT,
        fontSize: "12px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    this.add
      .rectangle(800, 620, 560, 24, RETRO_UI.colors.ink, 1)
      .setStrokeStyle(3, RETRO_UI.colors.border, 1);
    this.progressFill = this.add
      .rectangle(524, 620, 552, 12, RETRO_UI.colors.orange, 1)
      .setOrigin(0, 0.5)
      .setScale(0, 1);
    this.progressText = this.add
      .text(800, 662, "ЗАГРУЗКА МИРА · 0%", {
        color: RETRO_UI.text.primary,
        fontFamily: UI_FONT,
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 1.4,
      })
      .setOrigin(0.5);
    this.add
      .text(800, 812, "12 АРЕН · ENTER ИЛИ КЛИК, ЧТОБЫ ПРОДОЛЖИТЬ", {
        color: RETRO_UI.text.secondary,
        fontFamily: UI_FONT,
        fontSize: "9px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5);
  }

  private handleSkip(event: KeyboardEvent): void {
    if (
      this.canSkip &&
      (event.code === "Enter" || event.code === "Space" || event.code === "Escape")
    ) {
      event.preventDefault();
      this.startHome();
    }
  }

  private handlePointerSkip(): void {
    if (this.canSkip) {
      this.startHome();
    }
  }

  private startHome(): void {
    if (this.transitionStarted) {
      return;
    }

    this.transitionStarted = true;
    this.cameras.main.fadeOut(300, 8, 7, 5);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start("HomeScene"),
    );
  }
}
