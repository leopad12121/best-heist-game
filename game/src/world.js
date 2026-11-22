// The heist itself, with no drawing and no browser in it: the museum floor, the thief,
// the guards on their patrols, the guard dog, the sweeping cameras, the loot, the
// alarm meter and the tools. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react without the world knowing about screens or sound.
//
// The floor is one museum hall. Three routes run from the entrance (bottom centre) to
// the vault (top centre): the left gallery, the central hall past the statue, and the
// right gallery. Display cases and planters are cover: they block movement and sight.

import { ALARM, CAMERA, COIN_VALUE, CRACK, DOG, DOG2, ESCAPE, EXIT, FIELD, GUARD, INVESTIGATE, KEYCARD, LASERS, LOOKOUT, LOOT_ITEMS, ROOKIE, START_COINS, THIEF, TOOLS } from './config.js';

export const EVENT_SPOTTED = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_COIN = 4;
export const EVENT_GEM = 8;
export const EVENT_WIN = 16;
export const EVENT_TOOL = 32;
export const EVENT_LOOT = 64;
export const EVENT_CRACK = 128;
export const EVENT_KEYCARD = 256;

const WALL = 24;

/** Solid rectangles: walls and display cases. Movement and sight both stop at them. */
export const SOLIDS = [
  // Outer walls (the exit gap is left open in the bottom wall).
  { x: 0, y: 0, width: FIELD.width, height: WALL },
  { x: 0, y: FIELD.height - WALL, width: 600, height: WALL },
  { x: 680, y: FIELD.height - WALL, width: 600, height: WALL },
  { x: 0, y: 0, width: WALL, height: FIELD.height },
  { x: FIELD.width - WALL, y: 0, width: WALL, height: FIELD.height },
  // The vault room at the top centre, with a door gap at its foot.
  { x: 520, y: WALL, width: 80, height: 196 },
  { x: 680, y: WALL, width: 80, height: 196 },
  { x: 520, y: WALL, width: 240, height: WALL },
  { x: 520, y: 196, width: 80, height: WALL },
  { x: 680, y: 196, width: 80, height: WALL },
  // Dividers that split the hall into three routes, each with a gap at both ends.
  { x: 400, y: 300, width: WALL, height: 240 },
  { x: 856, y: 300, width: WALL, height: 240 },
  // Short walls that force a choice of corridor in the lower hall.
  { x: WALL, y: 380, width: 276, height: WALL },
  { x: 980, y: 380, width: 276, height: WALL },
];

/** Cover that blocks sight and movement but is not a wall: display cases and planters. */
export const COVER = [
  { x: 160, y: 110, width: 96, height: 54 },
  { x: 1024, y: 110, width: 96, height: 54 },
  { x: 160, y: 480, width: 96, height: 54 },
  { x: 1024, y: 480, width: 96, height: 54 },
  // Two statues flanking the red carpet, leaving the carpet itself open to the vault.
  { x: 470, y: 300, width: 80, height: 44 },
  { x: 730, y: 300, width: 80, height: 44 },
  { x: 300, y: 560, width: 84, height: 44 },
  { x: 896, y: 560, width: 84, height: 44 },
];

const ALL_SOLIDS = SOLIDS.concat(COVER);

export const GEM = { x: 640, y: 118, radius: 18 };

/** The laser beams' height right now: a sine sweep, so the same elapsed time
 *  always gives the same beam. */
export function laserY(index, elapsed) {
  const beam = LASERS[index];
  return beam.baseY + Math.sin(elapsed * beam.speed + beam.phase) * beam.amplitude;
}

const COIN_SPOTS = [
  { x: 120, y: 120 },
  { x: 1160, y: 120 },
  { x: 120, y: 640 },
  { x: 1160, y: 640 },
  { x: 460, y: 480 },
  { x: 820, y: 480 },
  { x: 300, y: 150 },
  { x: 980, y: 150 },
];

const GUARD_ROUTES = [
  // Left gallery guard.
  [{ x: 140, y: 300 }, { x: 140, y: 620 }, { x: 340, y: 620 }, { x: 340, y: 300 }],
  // Right gallery guard.
  [{ x: 1140, y: 300 }, { x: 1140, y: 620 }, { x: 940, y: 620 }, { x: 940, y: 300 }],
  // Central hall guard, sweeping past the statue.
  [{ x: 480, y: 260 }, { x: 800, y: 260 }, { x: 800, y: 600 }, { x: 480, y: 600 }],
  // The rookie's beat: straight across the upper hall, under the vault door.
  [{ x: 200, y: 240 }, { x: 1080, y: 240 }],
];

// The guard dog's beat: a fast loop around the lower central hall, below the lasers.
const DOG_ROUTE = [
  { x: 480, y: 600 }, { x: 800, y: 600 }, { x: 800, y: 540 }, { x: 480, y: 540 },
];

// The pup's beat: a loop around the middle of the right gallery, between the
// upper prizes and the lower ones — it guards the crossing, not the prizes
// themselves, so the thief can still time a grab at the necklace and the vase.
const DOG2_ROUTE = [
  { x: 920, y: 370 }, { x: 1160, y: 370 }, { x: 1160, y: 450 }, { x: 920, y: 450 },
];

const CAMERA_SPOTS = [
  { x: 200, y: 40, base: Math.PI / 2 },
  { x: 1080, y: 40, base: Math.PI / 2 },
  // The third camera watches the red carpet straight down to the vault door.
  { x: 640, y: 40, base: Math.PI / 2 },
];

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function circleHitsRect(cx, cy, radius, rect) {
  const nearX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const nearY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < radius * radius;
}

function segmentHitsRect(x1, y1, x2, y2, rect) {
  // Slab test: the segment crosses the rectangle when the parameter intervals overlap.
  let tMin = 0;
  let tMax = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const axes = [
    [dx, rect.x - x1, rect.x + rect.width - x1],
    [dy, rect.y - y1, rect.y + rect.height - y1],
  ];
  for (const [d, low, high] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (low > 0 || high < 0) return false;
    } else {
      let a = low / d;
      let b = high / d;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      tMin = Math.max(tMin, a);
      tMax = Math.min(tMax, b);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

function segmentBlocked(x1, y1, x2, y2) {
  for (const rect of ALL_SOLIDS) {
    if (segmentHitsRect(x1, y1, x2, y2, rect)) return true;
  }
  return false;
}

function segmentHitsCircle(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  const ddx = px - cx;
  const ddy = py - cy;
  return ddx * ddx + ddy * ddy < radius * radius;
}

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function createWorld(random) {
  const rng = random ?? Math.random;
  const thief = { x: THIEF.startX, y: THIEF.startY, radius: THIEF.radius };
  const guards = GUARD_ROUTES.map((route, index) => ({
    x: route[0].x,
    y: route[0].y,
    leg: 0,
    route,
    speed: GUARD.speeds[index] ?? GUARD.speeds[0],
    facing: index === 2 ? 0 : Math.PI / 2,
    radius: GUARD.radius,
    // The rookie sees less far and through a narrower cone than the veterans.
    sight: index === 3 ? ROOKIE.sight : GUARD.sight,
    halfCone: index === 3 ? ROOKIE.halfCone : GUARD.halfCone,
    bump: GUARD.bump,
    lookout: false,
    dog: false,
    pup: false,
    rookie: index === 3,
    investigateX: 0,
    investigateY: 0,
    investigateTime: 0,
  }));
  // The lookout never walks: it stands by the vault door and turns slowly.
  guards.push({
    x: LOOKOUT.x,
    y: LOOKOUT.y,
    leg: 0,
    route: [{ x: LOOKOUT.x, y: LOOKOUT.y }],
    speed: 0,
    facing: Math.PI / 2,
    radius: LOOKOUT.radius,
    sight: LOOKOUT.sight,
    halfCone: LOOKOUT.halfCone,
    bump: GUARD.bump,
    lookout: true,
    dog: false,
    pup: false,
    rookie: false,
    investigateX: 0,
    investigateY: 0,
    investigateTime: 0,
  });
  // The guard dog: fast, wide-eyed, keen-nosed — it patrols the lower hall and
  // smells the thief up close even out of its cone.
  guards.push({
    x: DOG_ROUTE[0].x,
    y: DOG_ROUTE[0].y,
    leg: 0,
    route: DOG_ROUTE,
    speed: DOG.speed,
    facing: 0,
    radius: DOG.radius,
    sight: DOG.sight,
    halfCone: DOG.halfCone,
    bump: DOG.bump,
    lookout: false,
    dog: true,
    pup: false,
    rookie: false,
    investigateX: 0,
    investigateY: 0,
    investigateTime: 0,
  });
  // The pup: a second guard dog, working the right gallery's upper loop.
  guards.push({
    x: DOG2_ROUTE[0].x,
    y: DOG2_ROUTE[0].y,
    leg: 0,
    route: DOG2_ROUTE,
    speed: DOG2.speed,
    facing: 0,
    radius: DOG2.radius,
    sight: DOG2.sight,
    halfCone: DOG2.halfCone,
    bump: DOG2.bump,
    lookout: false,
    dog: true,
    pup: true,
    rookie: false,
    investigateX: 0,
    investigateY: 0,
    investigateTime: 0,
  });
  const cameras = CAMERA_SPOTS.map((spot) => ({
    x: spot.x,
    y: spot.y,
    base: spot.base,
    angle: spot.base,
    frozen: 0,
    phase: spot.x < FIELD.width / 2 ? 0 : Math.PI,
  }));
  const coins = COIN_SPOTS.map((spot) => ({ x: spot.x, y: spot.y, taken: false }));
  const loot = LOOT_ITEMS.map((item) => ({ ...item, taken: false }));
  const state = {
    thief,
    guards,
    cameras,
    coins,
    lootItems: loot,
    gemTaken: false,
    crack: null,
    keycard: false,
    coinsHeld: START_COINS,
    loot: 0,
    alarm: 0,
    grace: 0,
    spotted: false,
    smoke: 0,
    smokeX: 0,
    smokeY: 0,
    emp: 0,
    disguise: 0,
    decoy: 0,
    decoyX: 0,
    decoyY: 0,
    elapsed: 0,
    seenBy: '',
    message: '',
    messageTime: 0,
  };

  function reset() {
    thief.x = THIEF.startX;
    thief.y = THIEF.startY;
    for (let index = 0; index < guards.length; index += 1) {
      const guard = guards[index];
      const start = guard.lookout ? { x: LOOKOUT.x, y: LOOKOUT.y } : guard.route[0];
      guard.x = start.x;
      guard.y = start.y;
      guard.leg = 0;
      guard.facing = index === 2 ? 0 : Math.PI / 2;
      guard.investigateX = 0;
      guard.investigateY = 0;
      guard.investigateTime = 0;
    }
    for (const camera of cameras) {
      camera.angle = camera.base;
      camera.frozen = 0;
      camera.phase = camera.x < FIELD.width / 2 ? 0 : Math.PI;
    }
    for (const coin of coins) coin.taken = false;
    for (const item of loot) item.taken = false;
    state.gemTaken = false;
    state.crack = null;
    state.keycard = false;
    state.coinsHeld = START_COINS;
    state.loot = 0;
    state.alarm = 0;
    state.grace = 0;
    state.spotted = false;
    state.smoke = 0;
    state.emp = 0;
    state.disguise = 0;
    state.decoy = 0;
    state.decoyX = 0;
    state.decoyY = 0;
    state.elapsed = 0;
    state.seenBy = '';
    state.message = '';
    state.messageTime = 0;
  }

  function moveThief(dx, dy) {
    const nextX = thief.x + dx;
    const nextY = thief.y + dy;
    let blockedX = false;
    let blockedY = false;
    for (const rect of ALL_SOLIDS) {
      if (circleHitsRect(nextX, thief.y, thief.radius, rect)) blockedX = true;
      if (circleHitsRect(thief.x, nextY, thief.radius, rect)) blockedY = true;
    }
    if (!blockedX) thief.x = Math.max(WALL + thief.radius, Math.min(FIELD.width - WALL - thief.radius, nextX));
    if (!blockedY) thief.y = Math.max(WALL + thief.radius, Math.min(FIELD.height - WALL - thief.radius, nextY));
  }

  function thiefHiddenFrom(x, y) {
    if (state.smoke > 0 && segmentHitsCircle(x, y, thief.x, thief.y, state.smokeX, state.smokeY, TOOLS.smoke.radius)) return true;
    return segmentBlocked(x, y, thief.x, thief.y);
  }

  /** True when this watcher can see the thief right now. `bump` is the distance
   *  inside which the watcher spots the thief whatever way it faces (0 for cameras). */
  function canSee(x, y, facing, range, halfCone, bump) {
    const dx = thief.x - x;
    const dy = thief.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance > range) return false;
    if (bump > 0 && distance < bump) return true;
    if (angleDiff(angleTo(x, y, thief.x, thief.y), facing) > halfCone) return false;
    if (thiefHiddenFrom(x, y)) return false;
    return true;
  }

  function useTool(name) {
    const tool = TOOLS[name];
    if (!tool || state.coinsHeld < tool.cost) {
      state.message = 'Not enough coins for that tool.';
      state.messageTime = 1.6;
      return 0;
    }
    state.coinsHeld -= tool.cost;
    if (name === 'smoke') {
      state.smoke = tool.seconds;
      state.smokeX = thief.x;
      state.smokeY = thief.y;
    } else if (name === 'emp') {
      state.emp = tool.seconds;
      for (const camera of cameras) camera.frozen = tool.seconds;
    } else if (name === 'disguise') {
      state.disguise = tool.seconds;
    } else if (name === 'decoy') {
      // The noisemaker lands where the thief stands: the patrols walk to it.
      state.decoy = tool.seconds;
      state.decoyX = thief.x;
      state.decoyY = thief.y;
    }
    state.message = `${tool.name} used.`;
    state.messageTime = 1.6;
    return EVENT_TOOL;
  }

  /** True when the thief is standing in a live laser beam right now. */
  function laserHit() {
    for (let index = 0; index < LASERS.length; index += 1) {
      const beam = LASERS[index];
      if (thief.x > beam.x1 && thief.x < beam.x2 && Math.abs(thief.y - laserY(index, state.elapsed)) < 10) return true;
    }
    return false;
  }

  /** Start cracking the sapphire case: three tumblers, one gold zone each. */
  function newCrack() {
    const zoneStart = 0.15 + rng() * 0.6;
    return { hits: 0, marker: 0, dir: 1, zoneStart, zoneEnd: zoneStart + CRACK.zoneWidth };
  }

  /** One press of Space or click while cracking: land a tumbler or slip. */
  function crackAttempt() {
    const crack = state.crack;
    if (!crack) return 0;
    if (crack.marker >= crack.zoneStart && crack.marker <= crack.zoneEnd) {
      crack.hits += 1;
      if (crack.hits >= CRACK.hitsNeeded) {
        state.crack = null;
        state.gemTaken = true;
        state.loot += 100;
        state.message = 'The case clicks open — sapphire secured!';
        state.messageTime = 2;
        return EVENT_GEM;
      }
      const zoneStart = 0.15 + rng() * 0.6;
      crack.zoneStart = zoneStart;
      crack.zoneEnd = zoneStart + CRACK.zoneWidth;
      crack.marker = 0;
      crack.dir = 1;
      state.message = `Tumbler ${crack.hits} of ${CRACK.hitsNeeded} falls.`;
      state.messageTime = 1.4;
      return EVENT_CRACK;
    }
    state.alarm = Math.min(ALARM.max, state.alarm + CRACK.slipPenalty);
    crack.marker = 0;
    crack.dir = 1;
    state.message = 'The pick slips — the case rattles!';
    state.messageTime = 1.6;
    return EVENT_CRACK;
  }

  /**
   * One fixed step. `dx` and `dy` are the thief's movement for this step, `tool` names a
   * tool to use this step or is null, and `crack` presses the pick while cracking.
   * With `harmless` set (the title screen's backdrop) the patrols move but nothing is
   * spotted and nothing scores.
   */
  function step(dt, dx, dy, tool, harmless, crack) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTime > 0) state.messageTime = Math.max(0, state.messageTime - dt);
    if (state.smoke > 0) state.smoke = Math.max(0, state.smoke - dt);
    if (state.emp > 0) state.emp = Math.max(0, state.emp - dt);
    if (state.disguise > 0) state.disguise = Math.max(0, state.disguise - dt);
    if (state.decoy > 0) state.decoy = Math.max(0, state.decoy - dt);

    if (tool && !harmless) events |= useTool(tool);
    if (crack && state.crack && !harmless) events |= crackAttempt();

    // The cracking needle sweeps its dial while the thief works the case.
    if (state.crack) {
      state.crack.marker += state.crack.dir * CRACK.markerSpeed * dt;
      if (state.crack.marker >= 1) { state.crack.marker = 1; state.crack.dir = -1; }
      if (state.crack.marker <= 0) { state.crack.marker = 0; state.crack.dir = 1; }
    }

    // The thief moves — unless both hands are on the sapphire case.
    if (!state.crack) {
      const length = Math.hypot(dx, dy);
      if (length > 0) moveThief((dx / length) * THIEF.speed * dt, (dy / length) * THIEF.speed * dt);
    }

    // Guards walk their patrol routes; the lookout turns on the spot. After the
    // sapphire is out, every guard hurries. A guard that is investigating walks to
    // the last-seen spot instead, and a live decoy pulls the patrols to where it
    // landed — both take priority over the route, and neither advances the patrol.
    const haste = state.gemTaken ? ESCAPE.guardHaste : 1;
    for (const guard of guards) {
      if (guard.lookout) {
        guard.facing = (state.elapsed * LOOKOUT.turnSpeed) % (Math.PI * 2);
        continue;
      }
      let target;
      let stride = guard.speed * haste * dt;
      let advanceLeg = false;
      if (guard.investigateTime > 0) {
        guard.investigateTime = Math.max(0, guard.investigateTime - dt);
        target = { x: guard.investigateX, y: guard.investigateY };
        stride *= INVESTIGATE.haste;
      } else if (state.decoy > 0) {
        target = { x: state.decoyX, y: state.decoyY };
      } else {
        target = guard.route[(guard.leg + 1) % guard.route.length];
        advanceLeg = true;
      }
      const gx = target.x - guard.x;
      const gy = target.y - guard.y;
      const distance = Math.hypot(gx, gy);
      if (distance <= stride) {
        guard.x = target.x;
        guard.y = target.y;
        if (advanceLeg) guard.leg = (guard.leg + 1) % guard.route.length;
      } else {
        guard.x += (gx / distance) * stride;
        guard.y += (gy / distance) * stride;
        guard.facing = Math.atan2(gy, gx);
      }
    }

    // Cameras sweep back and forth unless the EMP froze them.
    for (const camera of cameras) {
      if (camera.frozen > 0) {
        camera.frozen = Math.max(0, camera.frozen - dt);
        continue;
      }
      camera.phase += CAMERA.sweepSpeed * dt;
      camera.angle = camera.base + Math.sin(camera.phase) * CAMERA.sweepRange;
    }

    if (harmless) return events;

    // Who can see the thief?
    let seen = false;
    let seenBy = '';
    let laser = false;
    for (let index = 0; index < guards.length; index += 1) {
      const guard = guards[index];
      const close = Math.hypot(thief.x - guard.x, thief.y - guard.y) < TOOLS.disguise.closeRange;
      const disguised = state.disguise > 0 && !close;
      if (!disguised && canSee(guard.x, guard.y, guard.facing, guard.sight, guard.halfCone, guard.bump)) {
        seen = true;
        seenBy = guard.lookout ? 'Lookout' : guard.pup ? 'Guard pup' : guard.dog ? 'Guard dog' : `Guard ${index + 1}`;
        break;
      }
    }
    if (!seen) {
      for (let index = 0; index < cameras.length; index += 1) {
        const camera = cameras[index];
        if (camera.frozen > 0) continue;
        if (canSee(camera.x, camera.y, camera.angle, CAMERA.sight, CAMERA.halfCone, 0)) {
          seen = true;
          seenBy = `Camera ${index + 1}`;
          break;
        }
      }
    }
    if (laserHit()) {
      seen = true;
      seenBy = 'Laser grid';
      laser = true;
    }

    // The alarm meter. Lasers trip it twice as fast; after the sapphire is out
    // the museum heats up on its own.
    if (seen) {
      state.alarm = Math.min(ALARM.max, state.alarm + ALARM.rise * (laser ? 2 : 1) * dt);
      state.seenBy = seenBy;
    } else {
      state.alarm = Math.max(0, state.alarm - ALARM.fall * dt);
      // Keep the last watcher named: the SPOTTED warning still names who saw the thief.
    }
    if (state.gemTaken) state.alarm = Math.min(ALARM.max, state.alarm + ESCAPE.heatRise * dt);

    if (state.alarm >= ALARM.warn && !state.spotted) {
      state.spotted = true;
      events |= EVENT_SPOTTED;
      // The nearest patrolling guard (the dog included) breaks off to investigate
      // where the thief was last seen.
      let nearest = null;
      let nearestDistance = Infinity;
      for (const guard of guards) {
        if (guard.lookout) continue;
        const distance = Math.hypot(thief.x - guard.x, thief.y - guard.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = guard;
        }
      }
      if (nearest) {
        nearest.investigateX = thief.x;
        nearest.investigateY = thief.y;
        nearest.investigateTime = INVESTIGATE.seconds;
      }
    }
    if (state.alarm >= ALARM.max) {
      state.grace += dt;
      if (state.grace >= ALARM.grace && seen) {
        return events | EVENT_CAUGHT;
      }
    } else {
      state.grace = 0;
      if (state.alarm < ALARM.warn) state.spotted = false;
    }

    // Coins and the gallery loot.
    for (const coin of coins) {
      if (!coin.taken && Math.hypot(thief.x - coin.x, thief.y - coin.y) < thief.radius + 14) {
        coin.taken = true;
        state.coinsHeld += COIN_VALUE;
        state.loot += COIN_VALUE;
        events |= EVENT_COIN;
      }
    }
    for (const item of loot) {
      if (!item.taken && Math.hypot(thief.x - item.x, thief.y - item.y) < thief.radius + 16) {
        item.taken = true;
        state.loot += item.value;
        state.message = `${item.name} pocketed — $${item.value}!`;
        state.messageTime = 1.8;
        events |= EVENT_LOOT;
      }
    }
    // The Security Keycard, kept in the guard office in the left gallery.
    if (!state.keycard && Math.hypot(thief.x - KEYCARD.x, thief.y - KEYCARD.y) < thief.radius + 16) {
      state.keycard = true;
      state.message = 'Security Keycard pocketed — the vault case will open now!';
      state.messageTime = 1.8;
      events |= EVENT_KEYCARD;
    }
    // Reaching the sapphire case starts the crack: the gem only comes out once
    // the tumblers fall, and the thief's hands are busy until then. Without the
    // keycard the case stays locked.
    if (!state.gemTaken && !state.crack && Math.hypot(thief.x - GEM.x, thief.y - GEM.y) < thief.radius + GEM.radius) {
      if (!state.keycard) {
        if (state.messageTime <= 0) {
          state.message = 'Locked — the vault case needs the Security Keycard.';
          state.messageTime = 1.2;
        }
      } else {
        state.crack = newCrack();
        state.message = 'Cracking the case — press SPACE in the gold zone!';
        state.messageTime = 2.4;
        events |= EVENT_CRACK;
      }
    }

    // The getaway: gem in hand, reach the green exit door.
    if (state.gemTaken && rectsOverlap(
      { x: thief.x - thief.radius, y: thief.y - thief.radius, width: thief.radius * 2, height: thief.radius * 2 },
      EXIT,
    )) {
      return events | EVENT_WIN;
    }

    return events;
  }

  reset();
  return { state, reset, step, useTool, crackAttempt };
}
