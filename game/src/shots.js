// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot:
// it looks at the eight directions it could move, scores each by how dangerous the
// landing spot is (inside a guard's cone or a camera's sweep, or too close to a guard)
// and how much closer it gets to its target (the nearest coin, then the sapphire, then
// the exit), and takes the best. The same seed always gives the same frame.

import { CAMERA, CRACK, EXIT, FIELD, GUARD, KEYCARD, LASERS, LOOKOUT, STEP, TOOLS } from './config.js';
import { COVER, EVENT_CAUGHT, EVENT_WIN, GEM, SOLIDS, laserY } from './world.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 300;
const LOOKAHEAD = 0.3;
/** Above this alarm the autopilot stops pushing and waits out the heat. */
const PATIENCE_ALARM = 35;

const DIRECTIONS = [
  { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
  { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
  { x: 0, y: 0 },
];

function segmentHitsRect(x1, y1, x2, y2, rect) {
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

function sightBlocked(x1, y1, x2, y2) {
  for (const rect of SOLIDS.concat(COVER)) {
    if (segmentHitsRect(x1, y1, x2, y2, rect)) return true;
  }
  return false;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function circleHitsRect(cx, cy, radius, rect) {
  const nearX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const nearY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < radius * radius;
}

/** True when the thief's circle at (x, y) would overlap a wall or a display case. */
function blockedAt(x, y) {
  for (const rect of SOLIDS.concat(COVER)) {
    if (circleHitsRect(x, y, 13, rect)) return true;
  }
  return false;
}

/** How dangerous the point (x, y) is right now: 0 when no eye can see it. */
function dangerAt(state, x, y) {
  let danger = 0;
  for (const guard of state.guards) {
    const sight = guard.sight ?? (guard.lookout ? LOOKOUT.sight : GUARD.sight);
    const halfCone = guard.halfCone ?? (guard.lookout ? LOOKOUT.halfCone : GUARD.halfCone);
    const bump = guard.bump ?? GUARD.bump;
    const distance = Math.hypot(x - guard.x, y - guard.y);
    // A disguised thief reads as staff to a guard, unless right on top of it.
    if (state.disguise > 0 && distance >= TOOLS.disguise.closeRange) continue;
    if (distance < bump + 8) danger += 500;
    if (distance < sight && angleDiff(Math.atan2(y - guard.y, x - guard.x), guard.facing) < halfCone) {
      if (!sightBlocked(guard.x, guard.y, x, y)) danger += 1000;
    }
  }
  for (const camera of state.cameras) {
    if (camera.frozen > 0) continue;
    const distance = Math.hypot(x - camera.x, y - camera.y);
    if (distance < CAMERA.sight && angleDiff(Math.atan2(y - camera.y, x - camera.x), camera.angle) < CAMERA.halfCone) {
      if (!sightBlocked(camera.x, camera.y, x, y)) danger += 900;
    }
  }
  // The laser beams sweep: standing in one's path is as bad as standing in a cone.
  for (let index = 0; index < LASERS.length; index += 1) {
    const beam = LASERS[index];
    if (x > beam.x1 - 10 && x < beam.x2 + 10 && Math.abs(y - laserY(index, state.elapsed)) < 26) danger += 1000;
  }
  return danger;
}

function currentTarget(state, tour) {
  if (!state.gemTaken) {
    let best = null;
    let bestDistance = Infinity;
    // Coins and gallery loot share the tour: the nearest untaken prize first.
    for (const prize of state.coins.concat(state.lootItems)) {
      if (prize.taken) continue;
      const distance = Math.hypot(state.thief.x - prize.x, state.thief.y - prize.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = prize;
      }
    }
    // The vault case stays locked without the keycard, so the keycard comes
    // before the sapphire — but a prize on the way is still worth the detour.
    if (!state.keycard) {
      if (tour && best !== null) return best;
      if (best !== null && bestDistance < 260) return best;
      return KEYCARD;
    }
    // On a tour the thief sweeps every prize before the sapphire; otherwise a
    // prize on the way is worth a detour only when one is close, else head for
    // the gem.
    if (tour && best !== null) return best;
    if (best !== null && bestDistance < 260) return best;
    return GEM;
  }
  return { x: EXIT.x + EXIT.width / 2, y: EXIT.y };
}

/** Waypoints at the floor's junctions. The autopilot routes through them when a wall
 *  or a display case sits between the thief and the target, because a greedy step
 *  toward the target alone stalls behind any bar that runs across its path. */
const NAV_POINTS = [
  { x: 640, y: 648 },
  { x: 640, y: 560 },
  { x: 640, y: 430 },
  { x: 640, y: 250 },
  { x: 340, y: 470 },
  { x: 940, y: 470 },
  // Junctions just north of the short walls' inner ends: the only way around
  // them into the upper galleries (keycard, brooch, vase).
  { x: 340, y: 300 },
  { x: 940, y: 300 },
  { x: 200, y: 200 },
  { x: 1080, y: 200 },
  { x: 200, y: 300 },
  { x: 1110, y: 300 },
  { x: 200, y: 620 },
  { x: 1080, y: 620 },
  { x: 460, y: 260 },
  { x: 820, y: 260 },
  { x: 460, y: 580 },
  { x: 820, y: 580 },
];

/** True when the straight line between two points stays clear of every solid,
 *  with a little room to spare. The margin is 10, less than the thief's radius:
 *  the graph only routes, and the step scoring still refuses a landing that
 *  would clip a wall. */
function segmentClear(x1, y1, x2, y2) {
  for (const rect of SOLIDS.concat(COVER)) {
    const inflated = { x: rect.x - 10, y: rect.y - 10, width: rect.width + 20, height: rect.height + 20 };
    if (segmentHitsRect(x1, y1, x2, y2, inflated)) return false;
  }
  return true;
}

const NAV_LINKS = NAV_POINTS.map((point, index) => {
  const links = [];
  for (let other = 0; other < NAV_POINTS.length; other += 1) {
    if (other !== index && segmentClear(point.x, point.y, NAV_POINTS[other].x, NAV_POINTS[other].y)) links.push(other);
  }
  return links;
});

/**
 * The point to steer for: the target itself when the way is open, else the next
 * waypoint on the shortest route through the waypoint graph (breadth-first).
 */
function routeTarget(state, target) {
  if (segmentClear(state.thief.x, state.thief.y, target.x, target.y)) return target;
  let start = -1;
  let startDistance = Infinity;
  let goal = -1;
  let goalDistance = Infinity;
  for (let index = 0; index < NAV_POINTS.length; index += 1) {
    const point = NAV_POINTS[index];
    if (segmentClear(state.thief.x, state.thief.y, point.x, point.y)) {
      const distance = Math.hypot(state.thief.x - point.x, state.thief.y - point.y);
      if (distance < startDistance) {
        startDistance = distance;
        start = index;
      }
    }
    if (segmentClear(point.x, point.y, target.x, target.y)) {
      const distance = Math.hypot(point.x - target.x, point.y - target.y);
      if (distance < goalDistance) {
        goalDistance = distance;
        goal = index;
      }
    }
  }
  if (start < 0 || goal < 0) return target;
  const previous = new Array(NAV_POINTS.length).fill(-1);
  const queue = [start];
  previous[start] = start;
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === goal) break;
    for (const next of NAV_LINKS[current]) {
      if (previous[next] < 0) {
        previous[next] = current;
        queue.push(next);
      }
    }
  }
  if (previous[goal] < 0) {
    // No route through the graph: head for the waypoint the thief can reach
    // that is closest to the target, instead of stalling against the wall
    // between it and the target.
    let fallback = null;
    let fallbackDistance = Infinity;
    for (let index = 0; index < NAV_POINTS.length; index += 1) {
      const point = NAV_POINTS[index];
      if (!segmentClear(state.thief.x, state.thief.y, point.x, point.y)) continue;
      const distance = Math.hypot(point.x - target.x, point.y - target.y);
      if (distance < fallbackDistance) {
        fallbackDistance = distance;
        fallback = point;
      }
    }
    return fallback ?? target;
  }
  let node = goal;
  while (previous[node] !== start) node = previous[node];
  return NAV_POINTS[node];
}

/** The direction that gets the thief closer to `point` without walking into a cone.
 *  `dangerScale` trades caution for speed: the final dash for the sapphire runs
 *  hot, because a second in a cone is survivable and a frozen thief is not. */
function moveToward(state, point, dangerScale = 1) {
  const thief = state.thief;
  // Shorten the step when the point is near, so the pilot does not overshoot it.
  const stride = Math.min(205 * LOOKAHEAD, Math.hypot(point.x - thief.x, point.y - thief.y) + 2);
  // A thief standing somewhere safe but far from its target never just stands
  // there: the cones move, and freezing in the open is how you get caught.
  const hereSafe = dangerAt(state, thief.x, thief.y) === 0;
  const far = Math.hypot(point.x - thief.x, point.y - thief.y) > 40;
  let bestDirection = DIRECTIONS[8];
  let bestScore = Infinity;
  for (const direction of DIRECTIONS) {
    if (direction === DIRECTIONS[8] && hereSafe && far) continue;
    const length = Math.hypot(direction.x, direction.y) || 1;
    const x = thief.x + (direction.x / length) * stride;
    const y = thief.y + (direction.y / length) * stride;
    if (x < 30 || x > FIELD.width - 30 || y < 30 || y > FIELD.height - 30) continue;
    const score = dangerAt(state, x, y) * dangerScale + (blockedAt(x, y) ? 5000 : 0) + Math.hypot(point.x - x, point.y - y);
    if (score < bestScore) {
      bestScore = score;
      bestDirection = direction;
    }
  }
  return bestDirection;
}

/** The direction the autopilot wants to move in, from the state's current position.
 *  `options.tour` sweeps the coins first; `options.bold` cuts corners and lets the
 *  alarm run hotter. The play scene is a bold tour, the end scene a careful tour
 *  that ends with the sapphire and the getaway. */
function autopilot(state, options = {}) {
  const tour = !!options.tour;
  const bold = !!options.bold;
  const thief = state.thief;
  // Cracking the case: hands on the dial, press only while the needle sits
  // inside the gold zone.
  if (state.crack) {
    const crack = state.crack;
    const inZone = crack.marker >= crack.zoneStart + 0.01 && crack.marker <= crack.zoneEnd - 0.01;
    return { direction: DIRECTIONS[8], tool: null, crack: inZone };
  }
  // A bold pilot lets the alarm run hotter before backing off, which is what puts
  // the meter and the smoke in the play scene.
  const patienceAlarm = bold ? 55 : PATIENCE_ALARM;
  // Hot alarm, eyes on the thief: back out of the cone, not deeper into it.
  if (state.alarm > patienceAlarm && dangerAt(state, thief.x, thief.y) > 0) {
    let bestDirection = DIRECTIONS[8];
    let bestDanger = dangerAt(state, thief.x, thief.y);
    for (const direction of DIRECTIONS) {
      const length = Math.hypot(direction.x, direction.y) || 1;
      const x = thief.x + (direction.x / length) * 205 * LOOKAHEAD;
      const y = thief.y + (direction.y / length) * 205 * LOOKAHEAD;
      const danger = dangerAt(state, x, y) + (blockedAt(x, y) ? 5000 : 0);
      if (danger < bestDanger) {
        bestDanger = danger;
        bestDirection = direction;
      }
    }
    return { direction: bestDirection, tool: state.coinsHeld >= TOOLS.smoke.cost && state.smoke <= 0 ? 'smoke' : null };
  }
  // Hot alarm, safely hidden: wait for the meter to fall before moving on.
  if (state.alarm > patienceAlarm) {
    return { direction: DIRECTIONS[8], tool: null };
  }
  // The vault door is watched whenever a guard's cone covers it: wait on the carpet
  // at the staging point until the cone sweeps away — or spend the coins on a
  // Disguise and walk straight past the lookout instead. The staging point sits
  // between the laser grid and the vault door, clear of the beams.
  const doorWatched = state.disguise <= 0 && dangerAt(state, 640, 210) > 0;
  if (!state.gemTaken && doorWatched && thief.y > 230 && currentTarget(state, tour) === GEM) {
    if (state.coinsHeld >= TOOLS.disguise.cost && state.disguise <= 0) {
      return { direction: moveToward(state, GEM, 0.25), tool: 'disguise' };
    }
    return { direction: moveToward(state, { x: 640, y: 350 }, 0.25), tool: null };
  }
  const target = routeTarget(state, currentTarget(state, tour));
  // Shorten the step when the target is near, so the pilot does not overshoot it.
  const stride = Math.min(205 * LOOKAHEAD, Math.hypot(target.x - thief.x, target.y - thief.y) + 2);
  // On a tour the pilot cuts corners and takes risks a careful thief would not,
  // which is what puts the alarm meter and the smoke in the play scene. The
  // final dash for the sapphire — and for the keycard that unlocks it — runs
  // hot too: a second in a cone is survivable.
  const dashing = !state.gemTaken && (currentTarget(state, tour) === GEM || currentTarget(state, tour) === KEYCARD);
  const dangerScale = bold ? 0.1 : dashing ? 0.25 : 1;
  // Same no-freeze rule as moveToward: a safe thief far from its target moves.
  const hereSafe = dangerAt(state, thief.x, thief.y) === 0;
  const far = Math.hypot(target.x - thief.x, target.y - thief.y) > 40;
  let bestDirection = DIRECTIONS[8];
  let bestScore = Infinity;
  for (const direction of DIRECTIONS) {
    if (direction === DIRECTIONS[8] && hereSafe && far) continue;
    const length = Math.hypot(direction.x, direction.y) || 1;
    const x = thief.x + (direction.x / length) * stride;
    const y = thief.y + (direction.y / length) * stride;
    if (x < 30 || x > FIELD.width - 30 || y < 30 || y > FIELD.height - 30) continue;
    const score = dangerAt(state, x, y) * dangerScale + (blockedAt(x, y) ? 5000 : 0) + Math.hypot(target.x - x, target.y - y);
    if (score < bestScore) {
      bestScore = score;
      bestDirection = direction;
    }
  }
  // When the alarm is climbing and a tool is affordable, throw smoke and slip away.
  if (state.alarm > 55 && state.coinsHeld >= TOOLS.smoke.cost && state.smoke <= 0) {
    return { direction: bestDirection, tool: 'smoke' };
  }
  return { direction: bestDirection, tool: null };
}

/** A deep copy of the world's state (plain data only), for keeping a dramatic moment. */
function snapshotState(state) {
  return JSON.parse(JSON.stringify(state));
}

/** Copy a snapshot back into the world's state, in place, so the world's own
 *  references to its thief, guards, cameras and coins keep working. */
function restoreState(state, snap) {
  Object.assign(state.thief, snap.thief);
  snap.guards.forEach((guard, index) => Object.assign(state.guards[index], guard));
  snap.cameras.forEach((camera, index) => Object.assign(state.cameras[index], camera));
  snap.coins.forEach((coin, index) => Object.assign(state.coins[index], coin));
  for (const key of Object.keys(snap)) {
    if (key !== 'thief' && key !== 'guards' && key !== 'cameras' && key !== 'coins') state[key] = snap[key];
  }
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, 0, null, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const mode = name === 'end' ? { tour: true, bold: false } : { tour: true, bold: true };
  const keepPeak = name === 'play';
  let outcome = 0;
  // The play scene keeps the moment the alarm ran highest, so the frame shows the
  // heist at its tensest instead of wherever the tour happened to end.
  let peakAlarm = -1;
  let peakSnap = null;
  for (let index = 0; index < limit / STEP; index += 1) {
    const move = autopilot(world.state, mode);
    outcome = world.step(STEP, move.direction.x, move.direction.y, move.tool, false, move.crack);
    if (keepPeak && world.state.alarm > peakAlarm) {
      peakAlarm = world.state.alarm;
      peakSnap = snapshotState(world.state);
    }
    if (outcome & (EVENT_WIN | EVENT_CAUGHT)) break;
  }
  if (keepPeak && peakSnap !== null && !(outcome & (EVENT_WIN | EVENT_CAUGHT))) restoreState(world.state, peakSnap);
  if (outcome & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.loot };
  if (outcome & EVENT_CAUGHT) return { screen: SCREEN_CAUGHT, best: world.state.loot };
  return { screen: SCREEN_PLAY, best: world.state.loot };
}

export { autopilot };
