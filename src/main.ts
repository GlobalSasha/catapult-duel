import * as Phaser from "phaser";

import {
  IS_MOBILE_RENDER_TARGET,
  RENDER_HEIGHT,
  RENDER_WIDTH,
} from "./game/gameDimensions";
import { musicController } from "./game/audio/MusicController";
import { STRINGS_RU } from "./game/i18n/strings.ru";
import { BattleScene } from "./game/scenes/BattleScene";
import { ArenaLoadingScene } from "./game/scenes/ArenaLoadingScene";
import { BootScene } from "./game/scenes/BootScene";
import { HomeScene } from "./game/scenes/HomeScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { PlacementScene } from "./game/scenes/PlacementScene";
import { ResultScene } from "./game/scenes/ResultScene";
import "./style.css";

const gameRoot = document.querySelector("#game");
const rotateTitle = document.querySelector('[data-string="rotate-title"]');
const rotateMessage = document.querySelector('[data-string="rotate-message"]');
const musicToggle = document.querySelector<HTMLButtonElement>("#music-toggle");
const fullscreenToggle = document.querySelector<HTMLButtonElement>(
  "#fullscreen-toggle",
);
const fullscreenHint = document.querySelector<HTMLElement>("#fullscreen-hint");
const fullscreenHintClose = document.querySelector<HTMLButtonElement>(
  "#fullscreen-hint-close",
);
const installHint = document.querySelector<HTMLElement>("#install-hint");
const installConfirm = document.querySelector<HTMLButtonElement>(
  "#install-confirm",
);
const installDismiss = document.querySelector<HTMLButtonElement>(
  "#install-dismiss",
);
let fullscreenHintTimer: number | undefined;
let installPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const webkitDocument = document as WebkitDocument;
const fullscreenTarget = document.documentElement as WebkitElement;
const isStandalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  ("standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
const isFullscreen = (): boolean =>
  Boolean(document.fullscreenElement ?? webkitDocument.webkitFullscreenElement) ||
  isStandalone();

const updateFullscreenButton = (): void => {
  const active = isFullscreen();
  if (active) {
    fullscreenHint?.classList.remove("is-visible");
  }
  fullscreenToggle?.classList.toggle("is-active", active);
  fullscreenToggle?.setAttribute(
    "aria-label",
    active ? "Выйти из полноэкранного режима" : "Открыть игру на весь экран",
  );
  const label = fullscreenToggle?.querySelector("span:last-child");
  if (label) {
    label.textContent = active ? "ВЫЙТИ" : "ВЕСЬ ЭКРАН";
  }
};

const hideFullscreenHint = (): void => {
  if (fullscreenHintTimer !== undefined) {
    window.clearTimeout(fullscreenHintTimer);
    fullscreenHintTimer = undefined;
  }
  fullscreenHint?.classList.remove("is-visible");
};

const showFullscreenHint = (): void => {
  if (!fullscreenHint) {
    return;
  }

  fullscreenHint.classList.add("is-visible");
  if (fullscreenHintTimer !== undefined) {
    window.clearTimeout(fullscreenHintTimer);
  }
  fullscreenHintTimer = window.setTimeout(hideFullscreenHint, 2400);
};

const tryLockLandscape = async (): Promise<void> => {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: "landscape") => Promise<void>;
  };
  try {
    await orientation.lock?.("landscape");
  } catch {
    // Orientation locking is optional and unsupported by iOS Safari tabs.
  }
};

const toggleFullscreen = async (): Promise<void> => {
  if (isStandalone()) {
    return;
  }

  try {
    if (document.fullscreenElement ?? webkitDocument.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else {
        await webkitDocument.webkitExitFullscreen?.();
      }
      return;
    }

    if (fullscreenTarget.requestFullscreen) {
      await fullscreenTarget.requestFullscreen({ navigationUI: "hide" });
      await tryLockLandscape();
    } else if (fullscreenTarget.webkitRequestFullscreen) {
      await fullscreenTarget.webkitRequestFullscreen();
      await tryLockLandscape();
    } else {
      showFullscreenHint();
    }
  } catch {
    showFullscreenHint();
  } finally {
    updateFullscreenButton();
  }
};

gameRoot?.setAttribute("aria-label", STRINGS_RU.gameAriaLabel);
if (rotateTitle) {
  rotateTitle.textContent = STRINGS_RU.rotateDeviceTitle;
}
if (rotateMessage) {
  rotateMessage.textContent = STRINGS_RU.rotateDeviceMessage;
}

musicController.installAutoUnlock();
musicController.subscribe((muted) => {
  if (!musicToggle) {
    return;
  }

  musicToggle.textContent = "♫";
  musicToggle.setAttribute("aria-pressed", String(!muted));
  musicToggle.setAttribute(
    "aria-label",
    muted ? "Включить музыку" : "Выключить музыку",
  );
  musicToggle.title = muted ? "Включить музыку" : "Выключить музыку";
});
musicToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  void musicController.toggleMuted();
});
fullscreenToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  void toggleFullscreen();
});
fullscreenHintClose?.addEventListener("click", () => {
  hideFullscreenHint();
});
document.addEventListener("fullscreenchange", () => {
  updateFullscreenButton();
  if (isFullscreen()) {
    hideFullscreenHint();
  }
});
document.addEventListener("webkitfullscreenchange", () => {
  updateFullscreenButton();
  if (isFullscreen()) {
    hideFullscreenHint();
  }
});
updateFullscreenButton();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event as BeforeInstallPromptEvent;
  if (!isStandalone() && sessionStorage.getItem("install-hint-dismissed") !== "1") {
    installHint?.classList.add("is-visible");
  }
});
installConfirm?.addEventListener("click", async () => {
  if (!installPrompt) {
    return;
  }
  await installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  if (choice.outcome === "accepted") {
    installHint?.classList.remove("is-visible");
  }
  installPrompt = null;
});
installDismiss?.addEventListener("click", () => {
  installHint?.classList.remove("is-visible");
  sessionStorage.setItem("install-hint-dismissed", "1");
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installHint?.classList.remove("is-visible");
  updateFullscreenButton();
});

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: RENDER_WIDTH,
  height: RENDER_HEIGHT,
  backgroundColor: "#17140f",
  scene: [
    BootScene,
    HomeScene,
    MenuScene,
    ArenaLoadingScene,
    PlacementScene,
    BattleScene,
    ResultScene,
  ],
  scale: {
    mode: IS_MOBILE_RENDER_TARGET ? Phaser.Scale.EXPAND : Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
    width: RENDER_WIDTH,
    height: RENDER_HEIGHT,
  },
};

new Phaser.Game(config);
