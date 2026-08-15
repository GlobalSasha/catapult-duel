import * as Phaser from "phaser";

import {
  DEFAULT_ARENA_ID,
  getArenaDefinition,
  isArenaId,
  type ArenaId,
} from "../arena/arenaCatalog";
import type { PlayerId, VictoryReason } from "../core/battleTypes";
import {
  MATCH_SETTINGS_REGISTRY_KEY,
  getRatingForPlayer,
  readMatchSettings,
  recordMatchResult,
  type MatchSettings,
} from "../core/matchSession";
import {
  cloneMatchPlacement,
  createDefaultMatchPlacement,
  isMatchPlacement,
  type MatchPlacement,
} from "../core/placement";
import { STRINGS_RU } from "../i18n/strings.ru";
import {
  configure2KCamera,
  getLogicalViewport,
  sharpenSceneText,
} from "../rendering";
import { RETRO_UI } from "../ui/retroTheme";
import { musicController } from "../audio/MusicController";

interface ResultSceneData {
  winnerId: PlayerId | null;
  isDraw?: boolean;
  victoryReason?: VictoryReason | null;
  turnNumber: number;
  arenaId?: ArenaId;
  placement?: MatchPlacement;
}

const COLORS = {
  background: RETRO_UI.colors.ink,
  panel: RETRO_UI.colors.panel,
  panelStroke: RETRO_UI.colors.border,
  amber: RETRO_UI.colors.orange,
  mint: RETRO_UI.colors.cyan,
  amberText: RETRO_UI.text.orange,
  primaryText: RETRO_UI.text.primary,
  secondaryText: RETRO_UI.text.secondary,
  buttonText: RETRO_UI.text.ink,
} as const;

const DISPLAY_FONT = RETRO_UI.font.display;
const UI_FONT = RETRO_UI.font.ui;

export class ResultScene extends Phaser.Scene {
  private navigationStarted = false;
  private arenaId: ArenaId = DEFAULT_ARENA_ID;
  private matchPlacement: MatchPlacement = createDefaultMatchPlacement();
  private matchSettings: MatchSettings = readMatchSettings(undefined);

  constructor() {
    super("ResultScene");
  }

  create(data: ResultSceneData): void {
    configure2KCamera(this);
    musicController.setTheme("result");
    this.matchSettings = readMatchSettings(
      this.registry.get(MATCH_SETTINGS_REGISTRY_KEY),
    );
    this.navigationStarted = false;
    this.arenaId = isArenaId(data.arenaId)
      ? data.arenaId
      : DEFAULT_ARENA_ID;
    this.matchPlacement = isMatchPlacement(data.placement)
      ? cloneMatchPlacement(data.placement)
      : createDefaultMatchPlacement();
    if (data.winnerId) {
      recordMatchResult(this.matchSettings, data.winnerId);
    }
    const playerRating = getRatingForPlayer(
      this.matchSettings.playerNames.left,
    );
    this.drawBackdrop();
    this.drawResultCard(data, playerRating.rating);
    sharpenSceneText(this);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    });
  }

  private drawBackdrop(): void {
    const viewport = getLogicalViewport(this);
    const backdropX = -viewport.overflowX;
    this.add
      .image(
        backdropX,
        -viewport.overflowY,
        getArenaDefinition(this.arenaId).textureKey,
      )
      .setOrigin(0)
      .setDisplaySize(viewport.width, viewport.height)
      .setTint(0xc4774f);
    this.add
      .rectangle(
        backdropX,
        -viewport.overflowY,
        viewport.width,
        viewport.height,
        COLORS.background,
        0.68,
      )
      .setOrigin(0);
    this.add
      .rectangle(
        backdropX,
        0,
        viewport.width,
        240,
        RETRO_UI.colors.orangeDark,
        0.2,
      )
      .setOrigin(0);
  }

  private drawResultCard(data: ResultSceneData, playerRating: number): void {
    const isDraw = data.isDraw === true || data.winnerId === null;
    const winnerName = data.winnerId
      ? this.matchSettings.playerNames[data.winnerId]
      : "";
    const panel = this.add.graphics();

    panel.fillStyle(COLORS.panel, 0.97);
    panel.fillRect(400, 165, 800, 570);
    panel.lineStyle(8, RETRO_UI.colors.ink, 1);
    panel.strokeRect(400, 165, 800, 570);
    panel.lineStyle(4, COLORS.panelStroke, 0.95);
    panel.strokeRect(412, 177, 776, 546);
    panel.fillStyle(RETRO_UI.colors.panelActive, 1);
    panel.fillRect(708, 220, 184, 144);
    panel.lineStyle(5, COLORS.amber, 1);
    panel.strokeRect(708, 220, 184, 144);
    panel.lineStyle(2, RETRO_UI.colors.cyan, 1);
    panel.strokeRect(716, 228, 168, 128);

    this.add
      .text(800, 292, isDraw ? "⚔" : STRINGS_RU.victoryIcon, {
        color: RETRO_UI.text.orange,
        fontFamily: UI_FONT,
        fontSize: "68px",
      })
      .setOrigin(0.5);

    this.add
      .text(
        800,
        398,
        isDraw ? STRINGS_RU.drawTitle : STRINGS_RU.victoryTitle,
        {
        color: COLORS.amberText,
        fontFamily: DISPLAY_FONT,
        fontSize: "24px",
        fontStyle: "bold",
        letterSpacing: 5,
        },
      )
      .setOrigin(0.5);

    this.add
      .text(
        800,
        455,
        isDraw
          ? STRINGS_RU.drawMessage
          : STRINGS_RU.victoryPlayerName(winnerName),
        {
        color: COLORS.primaryText,
        fontFamily: UI_FONT,
        fontSize: "36px",
        fontStyle: "bold",
        },
      )
      .setOrigin(0.5);

    if (!isDraw && data.victoryReason === "knights") {
      this.add
        .text(800, 487, STRINGS_RU.victoryByKnights, {
          color: COLORS.amberText,
          fontFamily: UI_FONT,
          fontSize: "15px",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }

    this.add
      .text(
        800,
        548,
        `${this.matchSettings.playerNames.left} · РЕЙТИНГ ${playerRating}`,
        {
          color: RETRO_UI.text.cyan,
          fontFamily: UI_FONT,
          fontSize: "15px",
          fontStyle: "bold",
          letterSpacing: 1,
        },
      )
      .setOrigin(0.5);

    this.add
      .text(800, 507, STRINGS_RU.matchSummary(data.turnNumber), {
        color: COLORS.secondaryText,
        fontFamily: UI_FONT,
        fontSize: "19px",
      })
      .setOrigin(0.5);

    const rematchButton = this.add
      .rectangle(640, 606, 280, 64, COLORS.mint)
      .setFillStyle(COLORS.amber, 1)
      .setStrokeStyle(4, RETRO_UI.colors.cream, 0.9);
    const rematchHitZone = this.add
      .rectangle(640, 606, 300, 110, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(640, 606, STRINGS_RU.rematchButton, {
        color: COLORS.buttonText,
        fontFamily: UI_FONT,
        fontSize: "19px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    const arenaButton = this.add
      .rectangle(960, 606, 280, 64, COLORS.panel, 1)
      .setStrokeStyle(4, RETRO_UI.colors.cyan, 0.9);
    const arenaHitZone = this.add
      .rectangle(960, 606, 300, 110, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(960, 606, STRINGS_RU.chooseArenaButton, {
        color: COLORS.primaryText,
        fontFamily: UI_FONT,
        fontSize: "17px",
        fontStyle: "bold",
        letterSpacing: 1,
      })
      .setOrigin(0.5);

    this.add
      .text(800, 681, STRINGS_RU.resultHint, {
        color: COLORS.secondaryText,
        fontFamily: UI_FONT,
        fontSize: "14px",
      })
      .setOrigin(0.5);

    rematchHitZone.on("pointerover", () => {
      rematchButton.setFillStyle(RETRO_UI.colors.cyan, 1);
    });
    rematchHitZone.on("pointerout", () => {
      rematchButton.setFillStyle(COLORS.amber, 1);
    });
    arenaHitZone.on("pointerover", () => {
      arenaButton.setStrokeStyle(4, COLORS.amber, 0.9);
    });
    arenaHitZone.on("pointerout", () => {
      arenaButton.setStrokeStyle(3, COLORS.panelStroke, 0.85);
    });
    rematchHitZone.on("pointerdown", this.startRematch, this);
    arenaHitZone.on("pointerdown", this.chooseArena, this);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.repeat) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      this.startRematch();
      return;
    }

    if (event.code === "Escape") {
      this.chooseArena();
    }
  }

  private startRematch(): void {
    if (this.navigationStarted) {
      return;
    }

    this.navigationStarted = true;
    this.scene.start("BattleScene", {
      arenaId: this.arenaId,
      placement: this.matchPlacement,
    });
  }

  private chooseArena(): void {
    if (this.navigationStarted) {
      return;
    }

    this.navigationStarted = true;
    this.scene.start("MenuScene");
  }
}
