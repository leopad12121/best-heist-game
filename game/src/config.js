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
  /** Patrol speeds, one per patrolling guard: slow, fast, steady, rookie. */
  speeds: [58, 92, 72, 52],
  /** How far a guard can see, in pixels. */
  sight: 225,
  /** Half of the vision cone's angle, in radians. */
  halfCone: 0.61,
  /** Inside this distance a guard spots the thief whatever way it faces. */
  bump: 46,
};

/** The rookie: the fourth guard, new on the job — slower, shorter-sighted and
 *  narrower-eyed than the veterans, but its beat runs straight across the upper
 *  hall, right under the vault door. */
export const ROOKIE = {
  sight: 200,
  halfCone: 0.55,
};

/** The guard dog: fast, keen-nosed, short-sighted but wide-eyed. It cannot see
 *  far, but its cone is wide and it smells the thief up close. */
export const DOG = {
  radius: 12,
  speed: 130,
  sight: 135,
  halfCone: 1.1,
  /** The dog smells the thief inside this distance, cone or no cone. */
  bump: 62,
};

/** The pup: a second guard dog, younger and a touch slower, working the right
 *  gallery's upper loop — same nose, same wide cone, a different beat. */
export const DOG2 = {
  radius: 11,
  speed: 120,
  sight: 135,
  halfCone: 1.1,
  bump: 62,
};

/** A guard that just spotted the thief investigates the last-seen spot: it walks
 *  there, looks around, then goes back to its patrol. */
export const INVESTIGATE = {
  /** Seconds a guard spends investigating before giving up. */
  seconds: 5,
  /** Speed multiplier while investigating. */
  haste: 1.0,
};

/** The stationary lookout by the vault door: never walks, slowly turns a full
 *  circle, and sees further than a patrolling guard. */
export const LOOKOUT = {
  x: 820,
  y: 260,
  radius: 14,
  sight: 220,
  halfCone: 0.5,
  /** Radians per second the lookout turns. */
  turnSpeed: 0.55,
};

/** Extra loot beyond the coins and the sapphire: different values, different
 *  galleries, so the run is a route choice, not a straight line. */
export const LOOT_ITEMS = [
  { name: 'Gold Idol', x: 170, y: 620, value: 60, color: '#f2c94c' },
  { name: 'Jade Mask', x: 1110, y: 620, value: 40, color: '#4ade80' },
  { name: 'Pearl Necklace', x: 1080, y: 200, value: 25, color: '#f0e6ff' },
  { name: 'Ruby Brooch', x: 170, y: 200, value: 35, color: '#f87171' },
  { name: 'Ancient Vase', x: 1110, y: 300, value: 30, color: '#fbbf24' },
  { name: 'Emerald Tiara', x: 380, y: 150, value: 45, color: '#34d399' },
  { name: 'Silver Dagger', x: 900, y: 120, value: 20, color: '#cbd5e1' },
];

/** The Security Keycard, kept in the guard office in the left gallery — up in the
 *  corner by the display case, off the patrolling guard's beat. The vault case
 *  stays locked until the thief pockets it. */
export const KEYCARD = { x: 270, y: 180 };

/** The laser grid across the central hall: two beams that sweep up and down.
 *  Crossing a beam trips the alarm hard. */
export const LASERS = [
  { x1: 448, x2: 832, baseY: 430, amplitude: 55, speed: 0.5, phase: 0 },
  { x1: 448, x2: 832, baseY: 480, amplitude: 55, speed: 0.65, phase: Math.PI },
];

/** The vault-cracking minigame on the sapphire case: the needle sweeps the dial,
 *  press Space or click while it is in the gold zone to land a tumbler. */
export const CRACK = {
  hitsNeeded: 3,
  /** Needle speed across the dial, in dial-widths per second. */
  markerSpeed: 1.15,
  /** Width of the gold zone, as a fraction of the dial. */
  zoneWidth: 0.22,
  /** Alarm points added when the pick slips outside the zone. */
  slipPenalty: 25,
};

/** Once the sapphire is out of its case the museum heats up: the alarm climbs
 *  on its own and the guards hurry. */
export const ESCAPE = {
  heatRise: 5,
  guardHaste: 1.45,
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
  /** Decoy: a thrown noisemaker. The nearest patrolling guard and the dog walk
   *  to where it lands and look around, giving the thief a clear corridor. */
  decoy: { name: 'Decoy', cost: 20, key: '4', seconds: 6 },
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
  dog: '#b45309',
  dogCone: 'rgba(180, 83, 9, 0.20)',
  dogConeEdge: 'rgba(180, 83, 9, 0.55)',
  decoy: '#fbbf24',
  keycard: '#38bdf8',
  camera: '#f2c94c',
  cameraCone: 'rgba(242, 201, 76, 0.16)',
  cameraConeEdge: 'rgba(242, 201, 76, 0.5)',
  cameraOff: '#5a5f6e',
  gem: '#7fe7ff',
  laser: '#ff3b5c',
  laserGlow: 'rgba(255, 59, 92, 0.22)',
  lookout: '#c084fc',
  gold: '#f2c94c',
  jade: '#4ade80',
  pearl: '#f0e6ff',
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
