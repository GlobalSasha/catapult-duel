import * as Phaser from "phaser";

import { GAME_CONFIG } from "../core/gameConfig";
import {
  createInitialAmmunition,
  PROJECTILE_TYPES,
  type AmmunitionInventory,
  type ProjectileType,
} from "../core/projectileCatalog";
import { STRINGS_RU } from "../i18n/strings.ru";

export interface AimingValues {
  angleDeg: number;
  power: number;
  projectileType: ProjectileType;
}

interface AimingControlsCallbacks {
  onChange: (values: AimingValues) => void;
  onFire: (values: AimingValues) => void;
  onProjectileChange: (projectileType: ProjectileType) => boolean;
}

interface SliderView {
  hitZone: Phaser.GameObjects.Rectangle;
  track: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  knob: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  minimum: number;
  maximum: number;
  startX: number;
  width: number;
}

interface ProjectileButtonView {
  type: ProjectileType;
  panel: Phaser.GameObjects.Rectangle;
  marker: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Rectangle;
}

const COLORS = {
  panel: 0x171a1c,
  panelStroke: 0x8b6749,
  track: 0x303539,
  fill: 0x70b8b5,
  knob: 0xc8b99d,
  fire: 0xc87538,
  fireDisabled: 0x51565a,
  text: "#e7dfcf",
} as const;

export class AimingControls extends Phaser.GameObjects.Container {
  private readonly angleSlider: SliderView;
  private readonly powerSlider: SliderView;
  private readonly fireButton: Phaser.GameObjects.Rectangle;
  private readonly fireHitZone: Phaser.GameObjects.Rectangle;
  private readonly projectileButtons: readonly ProjectileButtonView[];
  private readonly projectileDetailTitle: Phaser.GameObjects.Text;
  private readonly projectileDetailDescription: Phaser.GameObjects.Text;
  private readonly callbacks: AimingControlsCallbacks;
  private angleDeg: number = GAME_CONFIG.aiming.initialAngleDeg;
  private power: number = GAME_CONFIG.aiming.initialPower;
  private projectileType: ProjectileType = "stone";
  private ammunition: AmmunitionInventory =
    createInitialAmmunition();
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    callbacks: AimingControlsCallbacks,
  ) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setScrollFactor(0).setDepth(1000);
    this.callbacks = callbacks;

    const dockSpecs = [
      { x: 326, width: 594 },
      { x: 948, width: 590 },
      { x: 1424, width: 232 },
    ] as const;
    const panelShadows = dockSpecs.map(
      ({ x, width }) =>
        new Phaser.GameObjects.Rectangle(
          scene,
          x + 7,
          850,
          width,
          104,
          0x05080d,
          0.48,
        ),
    );
    const panels = dockSpecs.map(({ x, width }) =>
      new Phaser.GameObjects.Rectangle(
        scene,
        x,
        842,
        width,
        104,
        COLORS.panel,
        0.96,
      ).setStrokeStyle(3, COLORS.panelStroke, 0.7),
    );
    const panelDetail = new Phaser.GameObjects.Graphics(scene);
    panelDetail.lineStyle(3, 0xc87538, 0.58);
    panelDetail.lineBetween(48, 788, 182, 788);
    panelDetail.lineBetween(670, 788, 786, 788);
    panelDetail.lineBetween(1324, 788, 1524, 788);
    panelDetail.lineStyle(2, 0x6b8791, 0.34);
    dockSpecs.forEach(({ x, width }) => {
      panelDetail.lineBetween(x - width / 2 + 14, 796, x + width / 2 - 14, 796);
    });
    const controlsTitle = new Phaser.GameObjects.Text(
      scene,
      48,
      803,
      "ОРУЖИЕ",
      {
        color: "#9eb0cb",
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        letterSpacing: 2,
      },
    );
    const rivets = dockSpecs.flatMap(({ x, width }) =>
      [
        [x - width / 2 + 12, 802],
        [x + width / 2 - 12, 802],
        [x - width / 2 + 12, 882],
        [x + width / 2 - 12, 882],
      ].map(
      ([x, y]) =>
        new Phaser.GameObjects.Arc(
          scene,
          x ?? 0,
          y ?? 0,
          4,
          0,
          360,
          false,
          0xb49b7c,
          0.65,
        ),
      ),
    );

    this.projectileButtons = PROJECTILE_TYPES.map(
      (projectileType, index) =>
        this.createProjectileButton(
          scene,
          projectileType,
          88 + index * 116,
          848,
        ),
    );

    const projectileDetailPanel = new Phaser.GameObjects.Rectangle(
      scene,
      326,
      752,
      594,
      66,
      0x101416,
      0.94,
    ).setStrokeStyle(2, 0x6b8791, 0.78);
    this.projectileDetailTitle = new Phaser.GameObjects.Text(
      scene,
      48,
      741,
      "",
      {
        color: "#f0d18b",
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        letterSpacing: 1,
      },
    ).setOrigin(0, 0.5);
    this.projectileDetailDescription = new Phaser.GameObjects.Text(
      scene,
      48,
      765,
      "",
      {
        color: "#b9c7ca",
        fontFamily: "Arial, sans-serif",
        fontSize: "9px",
        fontStyle: "bold",
        wordWrap: { width: 548 },
      },
    ).setOrigin(0, 0.5);

    this.angleSlider = this.createSlider({
      scene,
      startX: 690,
      y: 854,
      width: 210,
      minimum: GAME_CONFIG.aiming.minAngleDeg,
      maximum: GAME_CONFIG.aiming.maxAngleDeg,
      value: this.angleDeg,
      label: STRINGS_RU.angleLabel(this.angleDeg),
      onValue: (value) => {
        if (value === this.angleDeg) {
          return;
        }

        this.angleDeg = value;
        this.notifyChange();
      },
    });

    this.powerSlider = this.createSlider({
      scene,
      startX: 1000,
      y: 854,
      width: 210,
      minimum: GAME_CONFIG.aiming.minPower,
      maximum: GAME_CONFIG.aiming.maxPower,
      value: this.power,
      label: STRINGS_RU.powerLabel(this.power),
      onValue: (value) => {
        if (value === this.power) {
          return;
        }

        this.power = value;
        this.notifyChange();
      },
    });

    this.fireButton = new Phaser.GameObjects.Rectangle(
      scene,
      1424,
      842,
      194,
      70,
      COLORS.fire,
      1,
    )
      .setStrokeStyle(2, 0xffe29a, 0.8);
    const fireGlow = new Phaser.GameObjects.Rectangle(
      scene,
      1424,
      842,
      210,
      82,
      0xc87538,
      0.13,
    ).setBlendMode(Phaser.BlendModes.ADD);

    this.fireHitZone = new Phaser.GameObjects.Rectangle(
      scene,
      1424,
      842,
      222,
      98,
      0xffffff,
      0.001,
    )
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    const fireLabel = new Phaser.GameObjects.Text(
      scene,
      1424,
      842,
      STRINGS_RU.fireButton,
      {
        color: "#17130f",
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        letterSpacing: 2,
      },
    ).setOrigin(0.5);

    this.fireHitZone.on("pointerdown", () => {
      if (!this.enabled) {
        return;
      }

      this.callbacks.onFire(this.getValues());
    });
    this.fireHitZone.on("pointerover", () => {
      if (this.enabled) {
        this.fireButton.setScale(1.035);
      }
    });
    this.fireHitZone.on("pointerout", () => {
      this.fireButton.setScale(1);
    });

    this.add([
      ...panelShadows,
      ...panels,
      panelDetail,
      controlsTitle,
      ...rivets,
      fireGlow,
      this.fireHitZone,
      ...this.projectileButtons.flatMap((button) => [
        button.hitZone,
        button.panel,
        button.marker,
        button.label,
      ]),
      projectileDetailPanel,
      this.projectileDetailTitle,
      this.projectileDetailDescription,
      this.angleSlider.hitZone,
      this.angleSlider.track,
      this.angleSlider.fill,
      this.angleSlider.knob,
      this.angleSlider.label,
      this.powerSlider.hitZone,
      this.powerSlider.track,
      this.powerSlider.fill,
      this.powerSlider.knob,
      this.powerSlider.label,
      this.fireButton,
      fireLabel,
    ]);
    this.setDepth(1000);
    this.setScrollFactor(0);
    scene.tweens.add({
      targets: fireGlow,
      alpha: 0.32,
      scaleX: 1.045,
      scaleY: 1.12,
      duration: 1250,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    scene.tweens.add({
      targets: this.projectileButtons.map((button) => button.marker),
      scale: 1.12,
      duration: 900,
      yoyo: true,
      repeat: -1,
      stagger: 120,
      ease: "Sine.easeInOut",
    });
    this.updateProjectileButtons();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.58);
    this.fireButton.setFillStyle(
      enabled ? COLORS.fire : COLORS.fireDisabled,
      1,
    );
    this.updateProjectileButtons();
  }

  getValues(): AimingValues {
    return {
      angleDeg: this.angleDeg,
      power: this.power,
      projectileType: this.projectileType,
    };
  }

  setProjectileState(
    projectileType: ProjectileType,
    ammunition: AmmunitionInventory,
  ): void {
    this.projectileType = projectileType;
    this.ammunition = { ...ammunition };
    this.updateProjectileButtons();
  }

  setPowerMaximum(maximum: number): void {
    const nextMaximum = Phaser.Math.Clamp(
      maximum,
      GAME_CONFIG.aiming.minPower,
      GAME_CONFIG.aiming.maxPower,
    );

    this.powerSlider.maximum = nextMaximum;
    this.power = Math.min(this.power, nextMaximum);
    this.powerSlider.label.setText(this.getPowerLabel());
    this.updateSliderVisual(this.powerSlider, this.power);
  }

  private notifyChange(): void {
    this.angleSlider.label.setText(STRINGS_RU.angleLabel(this.angleDeg));
    this.powerSlider.label.setText(this.getPowerLabel());
    this.updateSliderVisual(this.angleSlider, this.angleDeg);
    this.updateSliderVisual(this.powerSlider, this.power);
    this.callbacks.onChange(this.getValues());
  }

  private createProjectileButton(
    scene: Phaser.Scene,
    projectileType: ProjectileType,
    x: number,
    y: number,
  ): ProjectileButtonView {
    const panel = new Phaser.GameObjects.Rectangle(
      scene,
      x,
      y,
      104,
      68,
      COLORS.track,
      0.96,
    ).setStrokeStyle(2, COLORS.panelStroke, 0.55);
    const marker = this.createProjectileMarker(
      scene,
      projectileType,
      x,
      y - 11,
    );
    const label = new Phaser.GameObjects.Text(
      scene,
      x,
      y + 22,
      this.getProjectileCardLabel(projectileType),
      {
        align: "center",
        color: COLORS.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "8px",
        fontStyle: "bold",
        letterSpacing: 0.5,
      },
    ).setOrigin(0.5);
    const hitZone = new Phaser.GameObjects.Rectangle(
      scene,
      x,
      y,
      112,
      78,
      0xffffff,
      0.001,
    )
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    const view = {
      type: projectileType,
      panel,
      marker,
      label,
      hitZone,
    };

    hitZone.on("pointerdown", () => {
      if (
        !this.enabled ||
        this.ammunition[projectileType] === 0 ||
        !this.callbacks.onProjectileChange(projectileType)
      ) {
        return;
      }

      this.projectileType = projectileType;
      this.updateProjectileButtons();
      this.notifyChange();
    });

    return view;
  }

  private updateProjectileButtons(): void {
    this.projectileButtons.forEach((button) => {
      const selected = button.type === this.projectileType;
      const unavailable = this.ammunition[button.type] === 0;
      const active = this.enabled && !unavailable;

      button.panel.setFillStyle(
        selected ? 0x51412f : COLORS.track,
        selected ? 1 : 0.96,
      );
      button.panel.setStrokeStyle(
        selected ? 3 : 2,
        selected ? COLORS.fill : COLORS.panelStroke,
        selected ? 1 : 0.55,
      );
      button.marker.setAlpha(active ? 1 : 0.28);
      button.label
        .setAlpha(active ? 1 : 0.38)
        .setText(this.getProjectileCardLabel(button.type));
      if (button.hitZone.input) {
        button.hitZone.input.enabled = active;
      }
    });

    const selectedDamage = GAME_CONFIG.projectiles[this.projectileType]
      .baseDamage;
    const selectedAmmo = STRINGS_RU.projectileInventory(
      this.ammunition[this.projectileType],
    );
    const damageLabel =
      this.projectileType === "bomb"
        ? `ПРЯМОЙ УРОН ${selectedDamage} · ВЗРЫВ ДО ${GAME_CONFIG.projectileEffects.bomb.maxExplosionDamage}`
        : `УРОН ${selectedDamage}`;

    this.projectileDetailTitle.setText(
      `${STRINGS_RU.projectileName(this.projectileType)} · ${damageLabel} · ЗАПАС ${selectedAmmo}`,
    );
    this.projectileDetailDescription.setText(
      STRINGS_RU.projectileDescription(this.projectileType),
    );
  }

  private getProjectileCardLabel(projectileType: ProjectileType): string {
    const ammunition = STRINGS_RU.projectileInventory(
      this.ammunition[projectileType],
    );

    return `${STRINGS_RU.projectileName(projectileType)} · ${ammunition}`;
  }

  private createProjectileMarker(
    scene: Phaser.Scene,
    projectileType: ProjectileType,
    x: number,
    y: number,
  ): Phaser.GameObjects.Graphics {
    const graphics = new Phaser.GameObjects.Graphics(scene, { x, y });
    const tint = GAME_CONFIG.projectiles[projectileType].tint;

    graphics.lineStyle(2, 0xe7dfcf, 0.72);
    graphics.fillStyle(tint, 1);

    if (projectileType === "stone") {
      graphics.beginPath();
      graphics.moveTo(-14, -7);
      graphics.lineTo(-5, -15);
      graphics.lineTo(9, -12);
      graphics.lineTo(15, -2);
      graphics.lineTo(10, 12);
      graphics.lineTo(-5, 15);
      graphics.lineTo(-15, 6);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
      graphics.lineStyle(2, 0x64503c, 0.75);
      graphics.lineBetween(-7, -5, 6, 7);
    } else if (projectileType === "fire") {
      graphics.fillRoundedRect(-11, -11, 22, 25, 4);
      graphics.strokeRoundedRect(-11, -11, 22, 25, 4);
      graphics.fillStyle(0xffd166, 1);
      graphics.fillTriangle(-7, -12, 0, -23, 7, -12);
      graphics.fillStyle(0x272b2d, 0.9);
      graphics.fillRect(-5, -4, 10, 4);
    } else if (projectileType === "ice") {
      graphics.beginPath();
      graphics.moveTo(-18, 0);
      graphics.lineTo(5, -12);
      graphics.lineTo(17, 0);
      graphics.lineTo(5, 12);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
      graphics.lineStyle(2, 0xffffff, 0.72);
      graphics.lineBetween(-6, 0, 9, 0);
    } else if (projectileType === "diamond") {
      graphics.beginPath();
      graphics.moveTo(0, -18);
      graphics.lineTo(15, -4);
      graphics.lineTo(9, 14);
      graphics.lineTo(-9, 14);
      graphics.lineTo(-15, -4);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
      graphics.lineStyle(2, 0xffffff, 0.74);
      graphics.lineBetween(-15, -4, 15, -4);
      graphics.lineBetween(0, -18, -6, -4);
      graphics.lineBetween(0, -18, 6, -4);
    } else {
      graphics.fillCircle(0, 2, 16);
      graphics.strokeCircle(0, 2, 16);
      graphics.lineStyle(3, 0xe7dfcf, 0.78);
      graphics.lineBetween(7, -12, 13, -21);
      graphics.lineStyle(2, 0xd39a4b, 1);
      graphics.lineBetween(13, -21, 18, -16);
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2;
        graphics.lineBetween(
          Math.cos(angle) * 12,
          2 + Math.sin(angle) * 12,
          Math.cos(angle) * 19,
          2 + Math.sin(angle) * 19,
        );
      }
    }

    return graphics;
  }

  private createSlider(options: {
    scene: Phaser.Scene;
    startX: number;
    y: number;
    width: number;
    minimum: number;
    maximum: number;
    value: number;
    label: string;
    onValue: (value: number) => void;
  }): SliderView {
    const hitZone = new Phaser.GameObjects.Rectangle(
      options.scene,
      options.startX + options.width / 2,
      options.y,
      options.width + 48,
      108,
      0xffffff,
      0.001,
    )
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    const track = new Phaser.GameObjects.Rectangle(
      options.scene,
      options.startX + options.width / 2,
      options.y,
      options.width,
      14,
      COLORS.track,
      1,
    );
    const fill = new Phaser.GameObjects.Rectangle(
      options.scene,
      options.startX,
      options.y,
      0,
      14,
      COLORS.fill,
      1,
    ).setOrigin(0, 0.5);
    const knob = new Phaser.GameObjects.Arc(
      options.scene,
      options.startX,
      options.y,
      22,
      0,
      360,
      false,
      COLORS.knob,
      1,
    )
      .setStrokeStyle(3, COLORS.fill, 1)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    const label = new Phaser.GameObjects.Text(
      options.scene,
      options.startX,
      options.y - 42,
      options.label,
      {
        color: COLORS.text,
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        fontStyle: "bold",
      },
    );

    const slider: SliderView = {
      hitZone,
      track,
      fill,
      knob,
      label,
      minimum: options.minimum,
      maximum: options.maximum,
      startX: options.startX,
      width: options.width,
    };
    const setFromX = (x: number): void => {
      if (!this.enabled) {
        return;
      }

      const ratio = Phaser.Math.Clamp(
        (x - slider.startX) / slider.width,
        0,
        1,
      );
      const value = Math.round(
        slider.minimum + ratio * (slider.maximum - slider.minimum),
      );
      options.onValue(value);
    };

    hitZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      setFromX(pointer.x);
    });
    options.scene.input.setDraggable(knob);
    options.scene.input.setDraggable(hitZone);
    knob.on(
      "drag",
      (_pointer: Phaser.Input.Pointer, dragX: number) => {
        setFromX(dragX);
      },
    );
    hitZone.on(
      "drag",
      (_pointer: Phaser.Input.Pointer, dragX: number) => {
        setFromX(dragX);
      },
    );

    this.updateSliderVisual(slider, options.value);

    return slider;
  }

  private updateSliderVisual(slider: SliderView, value: number): void {
    const ratio =
      (value - slider.minimum) / (slider.maximum - slider.minimum);
    const knobX = slider.startX + slider.width * ratio;

    slider.fill.setDisplaySize(slider.width * ratio, 14);
    slider.knob.setX(knobX);
  }

  private getPowerLabel(): string {
    return this.powerSlider.maximum < GAME_CONFIG.aiming.maxPower
      ? STRINGS_RU.frozenPowerLabel(
          this.power,
          this.powerSlider.maximum,
        )
      : STRINGS_RU.powerLabel(this.power);
  }
}
