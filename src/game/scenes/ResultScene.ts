import * as Phaser from "phaser";

import {
  DEFAULT_ARENA_ID,
  getArenaDefinition,
  isArenaId,
  type ArenaId,
} from "../arena/arenaCatalog";
import type { PlayerId } from "../core/battleTypes";
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
import { GAME_HEIGHT, GAME_WIDTH } from "../gameDimensions";
import { STRINGS_RU } from "../i18n/strings.ru";
import { configure2KCamera, sharpenSceneText } from "../rendering";

interface ResultSceneData {
  winnerId: PlayerId;
  turnNumber: number;
  arenaId?: ArenaId;
  placement?: MatchPlacement;
}

const COLORS = {
  background: 0x08101c,
  panel: 0x111a28,
  panelStroke: 0x54729e,
  amber: 0xffd166,
  mint: 0x7ee2a8,
  amberText: "#ffd166",
  primaryText: "#f4f7ff",
  secondaryText: "#9eb0cb",
  buttonText: "#14221d",
} as const;

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
    recordMatchResult(this.matchSettings, data.winnerId);
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
    this.add
      .image(0, 0, getArenaDefinition(this.arenaId).textureKey)
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(0x71809b);
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.background, 0.68)
      .setOrigin(0);
    this.add
      .circle(GAME_WIDTH / 2, 420, 390, 0x263b62, 0.42)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  private drawResultCard(data: ResultSceneData, playerRating: number): void {
    const winnerName = this.matchSettings.playerNames[data.winnerId];
    const panel = this.add.graphics();

    panel.fillStyle(COLORS.panel, 0.97);
    panel.fillRoundedRect(400, 165, 800, 570, 36);
    panel.lineStyle(3, COLORS.panelStroke, 0.65);
    panel.strokeRoundedRect(400, 165, 800, 570, 36);
    panel.fillStyle(COLORS.amber, 0.12);
    panel.fillCircle(800, 292, 92);
    panel.lineStyle(4, COLORS.amber, 0.75);
    panel.strokeCircle(800, 292, 68);

    this.add
      .text(800, 292, STRINGS_RU.victoryIcon, {
        color: "#ffd166",
        fontFamily: "Arial, sans-serif",
        fontSize: "68px",
      })
      .setOrigin(0.5);

    this.add
      .text(800, 398, STRINGS_RU.victoryTitle, {
        color: COLORS.amberText,
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        letterSpacing: 5,
      })
      .setOrigin(0.5);

    this.add
      .text(800, 455, STRINGS_RU.victoryPlayerName(winnerName), {
        color: COLORS.primaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "36px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(
        800,
        548,
        `${this.matchSettings.playerNames.left} · РЕЙТИНГ ${playerRating}`,
        {
          color: "#ffd166",
          fontFamily: "Arial, sans-serif",
          fontSize: "15px",
          fontStyle: "bold",
          letterSpacing: 1,
        },
      )
      .setOrigin(0.5);

    this.add
      .text(800, 507, STRINGS_RU.matchSummary(data.turnNumber), {
        color: COLORS.secondaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "19px",
      })
      .setOrigin(0.5);

    const rematchButton = this.add
      .rectangle(640, 606, 280, 64, COLORS.mint)
      .setStrokeStyle(3, 0xc7f7dc, 0.8);
    const rematchHitZone = this.add
      .rectangle(640, 606, 300, 110, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(640, 606, STRINGS_RU.rematchButton, {
        color: COLORS.buttonText,
        fontFamily: "Arial, sans-serif",
        fontSize: "19px",
        fontStyle: "bold",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    const arenaButton = this.add
      .rectangle(960, 606, 280, 64, COLORS.panel, 1)
      .setStrokeStyle(3, COLORS.panelStroke, 0.85);
    const arenaHitZone = this.add
      .rectangle(960, 606, 300, 110, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(960, 606, STRINGS_RU.chooseArenaButton, {
        color: COLORS.primaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        fontStyle: "bold",
        letterSpacing: 1,
      })
      .setOrigin(0.5);

    this.add
      .text(800, 681, STRINGS_RU.resultHint, {
        color: COLORS.secondaryText,
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
      })
      .setOrigin(0.5);

    rematchHitZone.on("pointerover", () => {
      rematchButton.setScale(1.025);
    });
    rematchHitZone.on("pointerout", () => {
      rematchButton.setScale(1);
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
