import * as Phaser from "phaser";

import { GAME_CONFIG } from "../core/gameConfig";
import {
  createInitialAmmunition,
  PROJECTILE_TYPES,
  type AmmunitionInventory,
  type ProjectileType,
} from "../core/projectileCatalog";
import { STRINGS_RU } from "../i18n/strings.ru";
import { PROJECTILE_TEXTURE_KEYS } from "../views/projectileVisuals";
import { RETRO_UI } from "./retroTheme";

export interface AimingValues {
  angleDeg: number;
  power: number;
  projectileType: ProjectileType;
}

interface AimingControlsCallbacks {
  onChange: (values: AimingValues) => void;
  onFire: (values: AimingValues) => void;
  onProjectileChange: (projectileType: ProjectileType) => boolean;
  onRepair: () => boolean;
}

interface SliderView {
  hitZone: Phaser.GameObjects.Rectangle;
  track: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  knob: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  minimum: number;
  maximum: number;
  startX: number;
  width: number;
}

interface ProjectileButtonView {
  type: ProjectileType;
  panel: Phaser.GameObjects.Rectangle;
  marker: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Rectangle;
}

const COLORS = {
  panel: RETRO_UI.colors.panel,
  panelStroke: RETRO_UI.colors.border,
  track: RETRO_UI.colors.inkSoft,
  fill: RETRO_UI.colors.cyan,
  knob: RETRO_UI.colors.cream,
  fire: RETRO_UI.colors.orange,
  fireDisabled: 0x51565a,
  text: RETRO_UI.text.primary,
} as const;

const UI_FONT = RETRO_UI.font.ui;

export class AimingControls extends Phaser.GameObjects.Container {
  private readonly angleSlider: SliderView;
  private readonly powerSlider: SliderView;
  private readonly fireButton: Phaser.GameObjects.Rectangle;
  private readonly fireHitZone: Phaser.GameObjects.Rectangle;
  private readonly repairButton: Phaser.GameObjects.Rectangle;
  private readonly repairHitZone: Phaser.GameObjects.Rectangle;
  private readonly repairLabel: Phaser.GameObjects.Text;
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
  private repairAvailable = false;
  private repairUsed = false;

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
    const panels = dockSpecs.map(({ x, width }) =>
      new Phaser.GameObjects.Rectangle(
        scene,
        x,
        842,
        width,
        104,
        COLORS.panel,
        0.96,
      ).setStrokeStyle(4, COLORS.panelStroke, 0.9),
    );
    const panelDetail = new Phaser.GameObjects.Graphics(scene);
    panelDetail.lineStyle(4, RETRO_UI.colors.orange, 0.9);
    panelDetail.lineBetween(48, 788, 182, 788);
    panelDetail.lineBetween(670, 788, 786, 788);
    panelDetail.lineBetween(1324, 788, 1524, 788);
    panelDetail.lineStyle(2, RETRO_UI.colors.cyan, 0.42);
    dockSpecs.forEach(({ x, width }) => {
      panelDetail.lineBetween(x - width / 2 + 14, 796, x + width / 2 - 14, 796);
    });
    const controlsTitle = new Phaser.GameObjects.Text(
      scene,
      48,
      803,
      "ОРУЖИЕ",
      {
        color: RETRO_UI.text.cyan,
        fontFamily: UI_FONT,
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
      RETRO_UI.colors.ink,
      0.94,
    ).setStrokeStyle(3, RETRO_UI.colors.border, 0.9);
    this.projectileDetailTitle = new Phaser.GameObjects.Text(
      scene,
      48,
      741,
      "",
      {
        color: RETRO_UI.text.orange,
        fontFamily: UI_FONT,
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
        color: RETRO_UI.text.secondary,
        fontFamily: UI_FONT,
        fontSize: "11px",
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
      .setStrokeStyle(4, RETRO_UI.colors.cream, 0.9);

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
        color: RETRO_UI.text.ink,
        fontFamily: UI_FONT,
        fontSize: "18px",
        fontStyle: "bold",
        letterSpacing: 2,
      },
    ).setOrigin(0.5);

    this.repairButton = new Phaser.GameObjects.Rectangle(
      scene,
      1424,
      754,
      194,
      46,
      RETRO_UI.colors.success,
      0.96,
    ).setStrokeStyle(3, RETRO_UI.colors.cream, 0.86);
    this.repairHitZone = new Phaser.GameObjects.Rectangle(
      scene,
      1424,
      754,
      222,
      60,
      0xffffff,
      0.001,
    )
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.repairLabel = new Phaser.GameObjects.Text(
      scene,
      1424,
      754,
      STRINGS_RU.repairButton,
      {
        color: RETRO_UI.text.ink,
        fontFamily: UI_FONT,
        fontSize: "11px",
        fontStyle: "bold",
        letterSpacing: 1,
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
        this.fireButton.setFillStyle(RETRO_UI.colors.cyan, 1);
      }
    });
    this.fireHitZone.on("pointerout", () => {
      this.fireButton.setFillStyle(
        this.enabled ? COLORS.fire : COLORS.fireDisabled,
        1,
      );
    });
    this.repairHitZone.on("pointerdown", () => {
      if (!this.enabled || !this.repairAvailable) {
        return;
      }

      this.callbacks.onRepair();
    });
    this.repairHitZone.on("pointerover", () => {
      if (this.enabled && this.repairAvailable) {
        this.repairButton.setFillStyle(RETRO_UI.colors.cyan, 1);
      }
    });
    this.repairHitZone.on("pointerout", () => {
      this.updateRepairButton();
    });

    this.add([
      ...panels,
      panelDetail,
      controlsTitle,
      ...rivets,
      this.fireHitZone,
      this.repairHitZone,
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
      this.repairButton,
      this.repairLabel,
    ]);
    this.setDepth(1000);
    this.setScrollFactor(0);
    this.projectileButtons.forEach((button, index) => {
      scene.tweens.add({
        targets: button.marker,
        y: button.marker.y - 2,
        angle: index % 2 === 0 ? 1.5 : -1.5,
        duration: 960 + index * 80,
        delay: index * 90,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
    this.updateProjectileButtons();
    this.updateRepairButton();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.58);
    [this.angleSlider, this.powerSlider].forEach((slider) => {
      if (slider.hitZone.input) {
        slider.hitZone.input.enabled = enabled;
      }
      if (slider.knob.input) {
        slider.knob.input.enabled = enabled;
      }
    });
    if (this.fireHitZone.input) {
      this.fireHitZone.input.enabled = enabled;
    }
    this.fireButton.setFillStyle(
      enabled ? COLORS.fire : COLORS.fireDisabled,
      1,
    );
    this.updateProjectileButtons();
    this.updateRepairButton();
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

  setRepairState(available: boolean, used: boolean): void {
    this.repairAvailable = available;
    this.repairUsed = used;
    this.updateRepairButton();
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
        fontFamily: UI_FONT,
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
        selected ? RETRO_UI.colors.panelActive : COLORS.track,
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

  private updateRepairButton(): void {
    const active = this.enabled && this.repairAvailable;

    this.repairButton
      .setFillStyle(
        active ? RETRO_UI.colors.success : COLORS.fireDisabled,
        active ? 0.96 : 0.82,
      )
      .setAlpha(active ? 1 : 0.64);
    this.repairLabel
      .setText(
        this.repairAvailable
          ? STRINGS_RU.repairButton
          : this.repairUsed
            ? STRINGS_RU.repairUnavailableButton
            : STRINGS_RU.repairFullHealthButton,
      )
      .setAlpha(active ? 1 : 0.52);
    if (this.repairHitZone.input) {
      this.repairHitZone.input.enabled = active;
    }
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
  ): Phaser.GameObjects.Image {
    return new Phaser.GameObjects.Image(
      scene,
      x,
      y,
      PROJECTILE_TEXTURE_KEYS[projectileType],
    ).setDisplaySize(36, 36);
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
    const knob = new Phaser.GameObjects.Rectangle(
      options.scene,
      options.startX,
      options.y,
      28,
      34,
      COLORS.knob,
      1,
    )
      .setStrokeStyle(RETRO_UI.line.selected, COLORS.fill, 1)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    const label = new Phaser.GameObjects.Text(
      options.scene,
      options.startX,
      options.y - 42,
      options.label,
      {
        color: COLORS.text,
        fontFamily: UI_FONT,
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
      const camera = options.scene.cameras.main;
      const localX =
        pointer.x / camera.zoom + camera.scrollX * hitZone.scrollFactorX;
      setFromX(localX);
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
