import type {
  AmmunitionCount,
  ProjectileType,
} from "../core/projectileCatalog";
import type { WeatherId } from "../core/weather";
import type { AiDifficulty } from "../core/matchSession";

const PROJECTILE_NAMES: Record<ProjectileType, string> = {
  stone: "КАМЕНЬ",
  fire: "ОГОНЬ",
  ice: "ЛЁД",
  diamond: "АЛМАЗ",
  bomb: "БОМБА",
};

const PROJECTILE_DESCRIPTIONS: Record<ProjectileType, string> = {
  stone: "Универсальный удар · стабильная баллистика",
  fire: "Поджигает цель · слабее против каменной башни",
  ice: "Замораживает катапульту · ограничивает силу",
  diamond: "Точный тяжёлый удар · особенно опасен для башни",
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
  menuEyebrow: "КАРТА ВОЕННОЙ КАМПАНИИ",
  menuSubtitle:
    "Разрушьте катапульту соперника или проведите рыцарей к его башне",
  chooseArenaTitle: "ВЫБЕРИТЕ АРЕНУ",
  chooseArenaHint: "12 миров · нажмите на карточку или используйте стрелки",
  arenaHighlandsName: "СУМЕРЕЧНЫЕ ВЫСОТЫ",
  arenaHighlandsDescription: "Крепости над холодной горной долиной",
  arenaCanyonName: "БАГРОВЫЙ КАНЬОН",
  arenaCanyonDescription: "Древние арки в свете раскалённого заката",
  selectedArena: "ВЫБРАНО",
  startBattleButton: "РАЗВЕРНУТЬ АРЕНУ",
  startBattleHint: "Кнопка, Enter или пробел",
  placementEyebrow: "ПОДГОТОВКА К БОЮ",
  placementTitle: (playerNumber: number) =>
    `РАССТАНОВКА · ИГРОК ${playerNumber}`,
  placementTitleForName: (playerName: string) =>
    `РАССТАНОВКА · ${playerName.toLocaleUpperCase("ru-RU")}`,
  placementFieldHint:
    "Выберите позицию башни: катапульта будет стоять на верхней площадке",
  placementCatapultFieldLabel: "ВЫБЕРИТЕ ПОЗИЦИЮ НА ПОЛЕ",
  placementProtectionLabel: "ЗАМОК · КАТАПУЛЬТА НА ВЕРШИНЕ БАШНИ",
  placementBuildCastle: "ПОСТРОИТЬ ЗАМОК",
  placementCastleBuilt: "ЗАМОК ПОСТРОЕН",
  placementRemoveCastle: "УБРАТЬ ЗАМОК",
  placementCastleReady:
    "Башня готова · прямые выстрелы разрушают камень, точные попадают сверху",
  placementCastleRemoved: "Замок убран · катапульта полностью открыта",
  placementBudget: (spent: number, remaining: number) =>
    `БЮДЖЕТ ${spent}/1 · ОСТАЛОСЬ ${remaining}`,
  placementWood: "ДЕРЕВО · 1",
  placementNet: "СЕТКА · 1",
  placementMetal: "МЕТАЛЛ · 2",
  placementErase: "УБРАТЬ",
  placementReset: "СБРОСИТЬ",
  placementReady: "ГОТОВО",
  placementRecommended:
    "Башню можно разрушить или попасть по катапульте точным выстрелом сверху",
  placementDropValid: "МОЖНО ПОСТАВИТЬ",
  placementDropInvalid: "НЕЛЬЗЯ ПОСТАВИТЬ ЗДЕСЬ",
  placementErrorOverlap: "Укрытие пересекается с катапультой или другим объектом",
  placementErrorSupport: "Здесь слишком неровная поверхность",
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
  aiDifficultyName: (difficulty: AiDifficulty) =>
    ({ easy: "ЛЕГКО", normal: "НОРМАЛЬНО", hard: "СЛОЖНО" })[
      difficulty
    ],
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
  repairButton: "РЕМОНТ +25% · R",
  repairUnavailableButton: "РЕМОНТ ИСПОЛЬЗОВАН",
  repairFullHealthButton: "РЕМОНТ · HP ПОЛНОЕ",
  controlsArsenal: "АРСЕНАЛ · НАВЕДЕНИЕ · ЗАПУСК",
  aimingStatus: (turnNumber: number, playerNumber: number) =>
    `Ход ${turnNumber} · настройте угол и силу · активен Игрок ${playerNumber}`,
  aimingStatusForName: (turnNumber: number, playerName: string) =>
    `Ход ${turnNumber} · настройте угол и силу · активен ${playerName}`,
  touchAimingStatusForName: (turnNumber: number, playerName: string) =>
    `Ход ${turnNumber} · оттяните катапульту и отпустите · ${playerName}`,
  aiThinkingStatus: (difficulty: string) =>
    `AI рассчитывает выстрел · сложность: ${difficulty}`,
  projectileFlightStatus: "Снаряд в полёте · управление заблокировано",
  fireUnavailableStatus: "Сейчас выстрел недоступен",
  repairStatus: (amount: number, health: number) =>
    `Починка +${amount} HP · здоровье ${health} · ход продолжается`,
  repairUnavailableStatus:
    "Починка недоступна: она уже использована или здоровье полное",
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
  knightImpactStatus: (damage: number) =>
    `Попадание по рыцарям · урон отряду ${damage}`,
  knightRoundStatus: (roundNumber: number) =>
    `МАРШ ${Math.min(roundNumber, 10)}/10`,
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
  drawTitle: "НИЧЬЯ",
  drawMessage: "Оба отряда одновременно достигли вражеских башен",
  victoryByKnights: "Рыцари захватили вражескую башню",
  victoryPlayer: (playerNumber: number) => `ИГРОК ${playerNumber} ПОБЕДИЛ`,
  victoryPlayerName: (playerName: string) =>
    `${playerName.toLocaleUpperCase("ru-RU")} ПОБЕДИЛ`,
  matchSummary: (turnNumber: number) =>
    `Матч завершён за ${turnNumber} ходов`,
  rematchButton: "РЕВАНШ",
  chooseArenaButton: "ВЫБРАТЬ АРЕНУ",
  resultHint: "Пробел — реванш · Esc — выбор арены",
} as const;
