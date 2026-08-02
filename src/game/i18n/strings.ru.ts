import type {
  AmmunitionCount,
  ProjectileType,
} from "../core/projectileCatalog";
import type { WeatherId } from "../core/weather";

const PROJECTILE_NAMES: Record<ProjectileType, string> = {
  stone: "КАМЕНЬ",
  fire: "ОГОНЬ",
  ice: "ЛЁД",
  diamond: "АЛМАЗ",
  bomb: "БОМБА",
};

const PROJECTILE_DESCRIPTIONS: Record<ProjectileType, string> = {
  stone: "Универсальный удар · стабильная баллистика",
  fire: "Поджигает цель · особенно опасен для дерева",
  ice: "Замораживает катапульту · ограничивает силу",
  diamond: "Точный тяжёлый удар · игнорирует 50% защиты",
  bomb: "Взрыв радиусом 160 · повреждает несколько целей",
};

const WEATHER_NAMES: Record<WeatherId, string> = {
  superheat: "☀ СУПЕРЖАРА",
  rain: "☂ ДОЖДЬ",
  snow: "❄ СНЕГ",
  sandstorm: "◈ ПЕСЧАНАЯ БУРЯ",
};

export const STRINGS_RU = {
  gameAriaLabel: "Игровое поле",
  gameTitle: "CATAPULT DUEL",
  battleSubtitle: "ТАКТИЧЕСКАЯ ДУЭЛЬ КАТАПУЛЬТ",
  weatherName: (weatherId: WeatherId) => WEATHER_NAMES[weatherId],
  windLabel: (wind: number) => {
    const direction = wind > 0 ? "→" : wind < 0 ? "←" : "•";

    return `ВЕТЕР ${direction} ${Math.abs(wind)}`;
  },
  menuEyebrow: "ПОШАГОВАЯ ДУЭЛЬ НА ДВОИХ",
  menuSubtitle:
    "Выберите поле боя, рассчитайте траекторию и разрушьте катапульту соперника",
  chooseArenaTitle: "ВЫБЕРИТЕ АРЕНУ",
  chooseArenaHint: "Нажмите на карточку · стрелки ← → тоже работают",
  arenaHighlandsName: "СУМЕРЕЧНЫЕ ВЫСОТЫ",
  arenaHighlandsDescription: "Крепости над холодной горной долиной",
  arenaCanyonName: "БАГРОВЫЙ КАНЬОН",
  arenaCanyonDescription: "Древние арки в свете раскалённого заката",
  selectedArena: "ВЫБРАНО",
  startBattleButton: "ПЕРЕЙТИ К РАССТАНОВКЕ",
  startBattleHint: "Кнопка, Enter или пробел",
  placementEyebrow: "ПОДГОТОВКА К БОЮ",
  placementTitle: (playerNumber: number) =>
    `РАССТАНОВКА · ИГРОК ${playerNumber}`,
  placementFieldHint:
    "Расставляйте катапульту и защиту прямо на своей части поля",
  placementCatapultFieldLabel: "ВЫБЕРИТЕ ПОЗИЦИЮ НА ПОЛЕ",
  placementProtectionLabel: "ЗАЩИТА · ВЫБЕРИТЕ МАТЕРИАЛ И СЛОТ",
  placementBudget: (spent: number, remaining: number) =>
    `БЮДЖЕТ ${spent}/4 · ОСТАЛОСЬ ${remaining}`,
  placementWood: "ДЕРЕВО · 1",
  placementNet: "СЕТКА · 1",
  placementMetal: "МЕТАЛЛ · 2",
  placementErase: "УБРАТЬ",
  placementReset: "СБРОСИТЬ",
  placementReady: "ГОТОВО",
  placementRecommended: "Стартовая схема уже заполнена — её можно изменить",
  placementErrorBudget: "Не хватает бюджета защиты",
  placementErrorCount: "Можно поставить не более трёх объектов",
  placementErrorMetal: "Разрешён только один металлический лист",
  placementHandoffTitle: "ИГРОК 1 ГОТОВ",
  placementHandoffMessage:
    "Передайте устройство Игроку 2. Расстановка Игрока 1 скрыта.",
  placementHandoffButton: "РАССТАВИТЬ ИГРОКА 2",
  placementEnemyDirectionRight: "СОПЕРНИК В ЭТОЙ СТОРОНЕ  →",
  placementEnemyDirectionLeft: "←  СОПЕРНИК В ЭТОЙ СТОРОНЕ",
  rotateDeviceTitle: "Поверните устройство",
  rotateDeviceMessage: "Для игры нужен горизонтальный экран",
  playerName: (playerNumber: number) => `ИГРОК ${playerNumber}`,
  health: (health: number) => `ЗДОРОВЬЕ ${health}`,
  activePlayer: "АКТИВЕН",
  angleLabel: (angle: number) => `УГОЛ ${angle}°`,
  powerLabel: (power: number) => `СИЛА ${power}`,
  frozenPowerLabel: (power: number, maximum: number) =>
    `СИЛА ${power} · ЛЁД: МАКС. ${maximum}`,
  projectileName: (projectileType: ProjectileType) =>
    PROJECTILE_NAMES[projectileType],
  projectileDescription: (projectileType: ProjectileType) =>
    PROJECTILE_DESCRIPTIONS[projectileType],
  projectileInventory: (ammunition: AmmunitionCount) =>
    ammunition === null ? "∞" : String(ammunition),
  projectileAmmo: (
    projectileType: ProjectileType,
    ammunition: AmmunitionCount,
  ) =>
    `${PROJECTILE_NAMES[projectileType]}\n${
      ammunition === null ? "∞" : ammunition
    }`,
  fireButton: "ОГОНЬ",
  controlsArsenal: "АРСЕНАЛ · НАВЕДЕНИЕ · ЗАПУСК",
  aimingStatus: (turnNumber: number, playerNumber: number) =>
    `Ход ${turnNumber} · настройте угол и силу · активен Игрок ${playerNumber}`,
  projectileFlightStatus: "Снаряд в полёте · управление заблокировано",
  fireUnavailableStatus: "Сейчас выстрел недоступен",
  frozenPowerUnavailableStatus: "Катапульта заморожена · максимум силы 70",
  impactStatus: (damage: number) => `Попадание · урон ${damage}`,
  fireImpactStatus: (damage: number, turns: number) =>
    `Огонь · урон ${damage} · горение: ${turns} ход.`,
  iceImpactStatus: (damage: number) =>
    `Лёд · урон ${damage} · сила цели ограничена`,
  diamondImpactStatus: (damage: number) =>
    `Алмазное пробитие · урон ${damage}`,
  bombImpactStatus: (damage: number) =>
    `Взрыв · суммарный урон ${damage}`,
  burnDamageStatus: (damage: number) =>
    `Горение в конце хода · урон ${damage}`,
  groundStatus: "Снаряд попал в землю · урон 0",
  obstacleStatus: "Снаряд разбился о препятствие · урон 0",
  destructibleImpactStatus: (damage: number, destroyed: boolean) =>
    destroyed
      ? `Преграда разрушена · урон прочности ${damage}`
      : `Преграда повреждена · урон прочности ${damage}`,
  durabilityDamageTaken: (damage: number) => `−${damage} ПРОЧН.`,
  missStatus: "Промах · урон 0",
  damageTaken: (damage: number) => `−${damage}`,
  burningStatus: (turns: number) => `🔥 ГОРЕНИЕ · ${turns}`,
  frozenStatus: (turns: number) => `❄ ЗАМОРОЗКА · ${turns}`,
  victoryIcon: "★",
  victoryTitle: "ПОБЕДА",
  victoryPlayer: (playerNumber: number) => `ИГРОК ${playerNumber} ПОБЕДИЛ`,
  matchSummary: (turnNumber: number) =>
    `Матч завершён за ${turnNumber} ходов`,
  rematchButton: "РЕВАНШ",
  chooseArenaButton: "ВЫБРАТЬ АРЕНУ",
  resultHint: "Пробел — реванш · Esc — выбор арены",
} as const;
