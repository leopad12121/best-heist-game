// Every tuning number and colour for Velvet Vault, in one place. The museum floor is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  speed: 205,
  startX: 640,
  startY: 648,
};

export const GUARD = {
  radius: 14,
  speed: 72,
  /** How far a guard can see, in pixels. */
  sight: 225,
  /** Half of the vision cone's angle, in radians. */
  halfCone: 0.61,
  /** Inside this distance a guard spots the thief whatever way it faces. */
  bump: 46,
};

export const CAMERA = {
  sight: 265,
  halfCone: 0.5,
  /** Radians per second the camera head sweeps. */
  sweepSpeed: 0.55,
  /** How far either side of its base angle the camera sweeps. */
  sweepRange: 0.85,
};

export const ALARM = {
  /** Points per second while any eye is on the thief. */
  rise: 46,
  /** Points per second while nobody can see the thief. */
  fall: 20,
  /** The meter level where the SPOTTED warning flashes. */
  warn: 70,
  max: 100,
  /** Seconds at full alarm before the guards close in, if the thief stays seen. */
  grace: 1.5,
};

export const TOOLS = {
  smoke: { name: 'Smoke', cost: 15, key: '1', radius: 115, seconds: 4 },
  emp: { name: 'EMP', cost: 25, key: '2', seconds: 6 },
  disguise: { name: 'Disguise', cost: 40, key: '3', seconds: 8, closeRange: 72 },
};

export const COIN_VALUE = 10;
export const START_COINS = 30;

export const EXIT = { x: 600, y: 688, width: 80, height: 32 };

export const PALETTE = {
  backdrop: '#0d0f16',
  floor: '#23202b',
  floorAlt: '#262330',
  carpet: '#4a2b3a',
  carpetEdge: '#6b3a4e',
  wall: '#3d4257',
  wallTop: '#4d5470',
  cover: '#2e3448',
  coverTrim: '#c9a227',
  text: '#eef1f5',
  muted: '#9aa1b5',
  thief: '#39d0ba',
  thiefRing: '#0e5f54',
  guard: '#e5534b',
  guardCone: 'rgba(229, 83, 75, 0.20)',
  guardConeEdge: 'rgba(229, 83, 75, 0.55)',
  camera: '#f2c94c',
  cameraCone: 'rgba(242, 201, 76, 0.16)',
  cameraConeEdge: 'rgba(242, 201, 76, 0.5)',
  cameraOff: '#5a5f6e',
  gem: '#7fe7ff',
  coin: '#f2c94c',
  exit: '#3fbf6f',
  alarmLow: '#3fbf6f',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
  smoke: 'rgba(180, 190, 205, 0.55)',
  panel: '#1b1e2a',
  panelEdge: '#3d4257',
  button: '#2a2f42',
  buttonHot: '#c9a227',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best loot is kept between visits (this browser only). */
export const BEST_KEY = 'velvet-vault.best';
