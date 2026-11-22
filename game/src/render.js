// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// museum floor is scaled to fit the window and centred, the margin filled with the
// backdrop colour. Canvas shapes and text: floor tiles and carpet, walls and display
// cases, guards with their vision cones, sweeping cameras, the gem, the coins, the exit
// door, the thief, the smoke, then the HUD (alarm meter, coins, tool buttons) and the
// screen panels.

import { ALARM, CAMERA, CRACK, EXIT, FIELD, FONT, GUARD, LASERS, LOOKOUT, PALETTE, TOOLS } from './config.js';
import { COVER, GEM as GEM_POS, SOLIDS, laserY } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

/** Tool buttons drawn in the HUD, in playfield coordinates, for click handling. */
export const TOOL_BUTTONS = [
  { name: 'smoke', x: 40, y: 648, width: 150, height: 36 },
  { name: 'emp', x: 200, y: 648, width: 150, height: 36 },
  { name: 'disguise', x: 360, y: 648, width: 150, height: 36 },
];

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const ALARM_BAR = { x: 480, y: 40, width: 320, height: 20 };

const TOOL_ORDER = ['smoke', 'emp', 'disguise'];

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const coinsLabel = cachedLabel('Coins ');
  const lootLabel = cachedLabel('Loot $');
  const bestLabel = cachedLabel('Best loot $');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Client (CSS pixel) coordinates to playfield coordinates. */
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    return {
      x: ((clientX - rect.left) * ratio - view.x) / view.scale,
      y: ((clientY - rect.top) * ratio - view.y) / view.scale,
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawCone(x, y, facing, range, halfCone, fill, edge) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, facing - halfCone, facing + halfCone);
    context.closePath();
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(facing - halfCone) * range, y + Math.sin(facing - halfCone) * range);
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(facing + halfCone) * range, y + Math.sin(facing + halfCone) * range);
    context.stroke();
  }

  function drawFloor() {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Checker tiles.
    context.fillStyle = PALETTE.floorAlt;
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 16; col += 1) {
        if ((row + col) % 2 === 0) context.fillRect(col * 80, row * 80, 80, 80);
      }
    }
    // The red carpet runner from the entrance to the vault door.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(580, 220, 120, 476);
    context.fillStyle = PALETTE.carpetEdge;
    context.fillRect(576, 220, 4, 476);
    context.fillRect(700, 220, 4, 476);
    // Vault room floor.
    context.fillStyle = '#2b2438';
    context.fillRect(524, 28, 232, 188);
  }

  function drawSolids() {
    for (const rect of SOLIDS) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(rect.x, rect.y, rect.width, 4);
    }
    for (const rect of COVER) {
      context.fillStyle = PALETTE.cover;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.strokeStyle = PALETTE.coverTrim;
      context.lineWidth = 2;
      context.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
      // A glint on each case: something worth stealing sits inside.
      context.fillStyle = PALETTE.coverTrim;
      context.beginPath();
      context.arc(rect.x + rect.width / 2, rect.y + rect.height / 2, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawLoot(state) {
    // The exit door: green, at the bottom centre.
    context.fillStyle = PALETTE.exit;
    context.fillRect(EXIT.x, EXIT.y - 8, EXIT.width, 10);
    context.fillStyle = '#eef1f5';
    text('EXIT', EXIT.x + EXIT.width / 2, EXIT.y - 20, 16, PALETTE.exit, 'center');
    // Coins.
    for (const coin of state.coins) {
      if (coin.taken) continue;
      context.fillStyle = PALETTE.coin;
      context.beginPath();
      context.arc(coin.x, coin.y, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#8a6d1a';
      context.beginPath();
      context.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
      context.fill();
    }
    // The gallery loot: each piece has its own colour and value.
    for (const item of state.lootItems) {
      if (item.taken) continue;
      const pulse = 0.75 + 0.25 * Math.sin(state.elapsed * 3 + item.x);
      context.fillStyle = item.color;
      context.globalAlpha = 0.25 * pulse;
      context.beginPath();
      context.arc(item.x, item.y, 26, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.beginPath();
      context.moveTo(item.x, item.y - 12);
      context.lineTo(item.x + 12, item.y);
      context.lineTo(item.x, item.y + 12);
      context.lineTo(item.x - 12, item.y);
      context.closePath();
      context.fill();
      context.fillStyle = '#11141b';
      context.beginPath();
      context.arc(item.x, item.y, 4, 0, Math.PI * 2);
      context.fill();
      text(`${item.name} $${item.value}`, item.x, item.y + 34, 13, item.color, 'center');
    }
    // The Starlight Sapphire in its vault.
    if (!state.gemTaken) {
      const pulse = 0.7 + 0.3 * Math.sin(state.elapsed * 4);
      context.fillStyle = `rgba(127, 231, 255, ${0.25 * pulse})`;
      context.beginPath();
      context.arc(GEM_POS.x, GEM_POS.y, 34, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.gem;
      context.beginPath();
      context.moveTo(GEM_POS.x, GEM_POS.y - GEM_POS.radius);
      context.lineTo(GEM_POS.x + GEM_POS.radius, GEM_POS.y);
      context.lineTo(GEM_POS.x, GEM_POS.y + GEM_POS.radius);
      context.lineTo(GEM_POS.x - GEM_POS.radius, GEM_POS.y);
      context.closePath();
      context.fill();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(GEM_POS.x - 4, GEM_POS.y - 5, 3, 0, Math.PI * 2);
      context.fill();
      text('THE STARLIGHT SAPPHIRE', GEM_POS.x, GEM_POS.y + 44, 13, PALETTE.gem, 'center');
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const sight = guard.lookout ? LOOKOUT.sight : GUARD.sight;
      const halfCone = guard.lookout ? LOOKOUT.halfCone : GUARD.halfCone;
      const fill = guard.lookout ? 'rgba(192, 132, 252, 0.18)' : PALETTE.guardCone;
      const edge = guard.lookout ? 'rgba(192, 132, 252, 0.55)' : PALETTE.guardConeEdge;
      drawCone(guard.x, guard.y, guard.facing, sight, halfCone, fill, edge);
    }
    for (const guard of state.guards) {
      context.fillStyle = guard.lookout ? PALETTE.lookout : PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      context.fill();
      // The guard's cap brim points where it looks.
      context.fillStyle = guard.lookout ? '#f2c94c' : '#7a1f1a';
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.facing) * 8, guard.y + Math.sin(guard.facing) * 8, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(guard.x - 4, guard.y - 4, 2, 0, Math.PI * 2);
      context.arc(guard.x + 4, guard.y - 4, 2, 0, Math.PI * 2);
      context.fill();
      if (guard.lookout) {
        context.strokeStyle = PALETTE.gold;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(guard.x, guard.y, guard.radius + 5, 0, Math.PI * 2);
        context.stroke();
        text('LOOKOUT', guard.x, guard.y - 26, 11, PALETTE.lookout, 'center');
      }
    }
  }

  /** The laser grid: two glowing beams sweeping the central hall, with posts. */
  function drawLasers(state) {
    for (let index = 0; index < LASERS.length; index += 1) {
      const beam = LASERS[index];
      const y = laserY(index, state.elapsed);
      context.strokeStyle = PALETTE.laserGlow;
      context.lineWidth = 12;
      context.beginPath();
      context.moveTo(beam.x1, y);
      context.lineTo(beam.x2, y);
      context.stroke();
      context.strokeStyle = PALETTE.laser;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(beam.x1, y);
      context.lineTo(beam.x2, y);
      context.stroke();
      // The emitter posts ride the beam's ends.
      for (const x of [beam.x1, beam.x2]) {
        context.fillStyle = '#ff8fa3';
        context.fillRect(x - 4, y - 8, 8, 16);
      }
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      if (camera.frozen <= 0) {
        drawCone(camera.x, camera.y, camera.angle, CAMERA.sight, CAMERA.halfCone, PALETTE.cameraCone, PALETTE.cameraConeEdge);
      }
    }
    for (const camera of state.cameras) {
      const frozen = camera.frozen > 0;
      context.fillStyle = frozen ? PALETTE.cameraOff : PALETTE.camera;
      context.beginPath();
      context.arc(camera.x, camera.y, 10, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#11141b';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(camera.x, camera.y);
      context.lineTo(camera.x + Math.cos(camera.angle) * 16, camera.y + Math.sin(camera.angle) * 16);
      context.stroke();
      if (frozen) text('EMP', camera.x, camera.y - 16, 12, PALETTE.cameraOff, 'center');
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    const disguised = state.disguise > 0;
    // A soft shadow.
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.beginPath();
    context.ellipse(thief.x, thief.y + 10, 14, 6, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = disguised ? '#c9a227' : PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.thiefRing;
    context.lineWidth = 2;
    context.stroke();
    // The mask: two eyes over a dark band.
    context.fillStyle = '#11141b';
    context.fillRect(thief.x - 9, thief.y - 4, 18, 6);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(thief.x - 4, thief.y - 1, 2, 0, Math.PI * 2);
    context.arc(thief.x + 4, thief.y - 1, 2, 0, Math.PI * 2);
    context.fill();
    if (state.gemTaken) {
      context.fillStyle = PALETTE.gem;
      context.beginPath();
      context.arc(thief.x + 10, thief.y + 10, 5, 0, Math.PI * 2);
      context.fill();
    }
    if (disguised) text('DISGUISED', thief.x, thief.y - 22, 12, PALETTE.coverTrim, 'center');
  }

  function drawSmoke(state) {
    if (state.smoke <= 0) return;
    context.fillStyle = PALETTE.smoke;
    context.beginPath();
    context.arc(state.smokeX, state.smokeY, TOOLS.smoke.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(238, 241, 245, 0.8)';
    context.beginPath();
    context.arc(state.smokeX - 30, state.smokeY + 20, 22, 0, Math.PI * 2);
    context.arc(state.smokeX + 34, state.smokeY - 18, 26, 0, Math.PI * 2);
    context.arc(state.smokeX + 10, state.smokeY + 34, 20, 0, Math.PI * 2);
    context.fill();
  }

  /** The vault-cracking dial: a bar, the gold zone, the sweeping needle. */
  function drawCrack(state) {
    const crack = state.crack;
    if (!crack) return;
    const bar = { x: 460, y: 556, width: 360, height: 26 };
    text('CRACK THE CASE — press SPACE when the needle is in the gold zone!', FIELD.width / 2, bar.y - 14, 18, PALETTE.gold, 'center');
    context.fillStyle = '#11141b';
    context.fillRect(bar.x - 3, bar.y - 3, bar.width + 6, bar.height + 6);
    context.fillStyle = '#2a2f42';
    context.fillRect(bar.x, bar.y, bar.width, bar.height);
    context.fillStyle = PALETTE.gold;
    context.fillRect(bar.x + crack.zoneStart * bar.width, bar.y, (crack.zoneEnd - crack.zoneStart) * bar.width, bar.height);
    const needleX = bar.x + crack.marker * bar.width;
    context.fillStyle = '#ffffff';
    context.fillRect(needleX - 2, bar.y - 6, 4, bar.height + 12);
    for (let hit = 0; hit < CRACK.hitsNeeded; hit += 1) {
      context.fillStyle = hit < crack.hits ? PALETTE.gold : '#2a2f42';
      context.beginPath();
      context.arc(bar.x + bar.width / 2 - 24 + hit * 24, bar.y + bar.height + 22, 7, 0, Math.PI * 2);
      context.fill();
    }
    text(`${crack.hits} of ${CRACK.hitsNeeded} tumblers`, FIELD.width / 2, bar.y + bar.height + 44, 15, PALETTE.text, 'center');
  }

  // Pickup sparkles: render-side only, spawned when the loot total jumps.
  let particles = [];
  let lastLoot = 0;
  let lastElapsed = 0;

  function drawParticles(state) {
    const dt = Math.max(0, state.elapsed - lastElapsed);
    lastElapsed = state.elapsed;
    if (state.loot > lastLoot) {
      for (let index = 0; index < 16; index += 1) {
        const angle = (index / 16) * Math.PI * 2;
        particles.push({
          x: state.thief.x, y: state.thief.y,
          vx: Math.cos(angle) * (60 + (index % 5) * 22),
          vy: Math.sin(angle) * (60 + (index % 5) * 22),
          life: 0.7,
        });
      }
    }
    lastLoot = state.loot;
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) continue;
      context.globalAlpha = Math.max(0, p.life / 0.7);
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  /** A dark vignette: the museum feels lit, the edges fall away. */
  function drawVignette() {
    const gradient = context.createRadialGradient(640, 360, 260, 640, 360, 760);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawHud(state, selectedTool) {
    context.textBaseline = 'top';
    // Coins and loot, top left.
    text(coinsLabel(state.coinsHeld), 40, 36, 22, PALETTE.coin, 'left');
    text(lootLabel(state.loot), 40, 62, 18, PALETTE.text, 'left');
    // Alarm meter, top centre.
    const fraction = state.alarm / ALARM.max;
    const color = fraction < 0.5 ? PALETTE.alarmLow : fraction < ALARM.warn / ALARM.max ? PALETTE.alarmMid : PALETTE.alarmHigh;
    text('ALARM', ALARM_BAR.x + ALARM_BAR.width / 2, 14, 16, PALETTE.text, 'center');
    context.fillStyle = '#11141b';
    context.fillRect(ALARM_BAR.x - 2, ALARM_BAR.y - 2, ALARM_BAR.width + 4, ALARM_BAR.height + 4);
    context.fillStyle = '#2a2f42';
    context.fillRect(ALARM_BAR.x, ALARM_BAR.y, ALARM_BAR.width, ALARM_BAR.height);
    context.fillStyle = color;
    context.fillRect(ALARM_BAR.x, ALARM_BAR.y, ALARM_BAR.width * fraction, ALARM_BAR.height);
    if (state.spotted) {
      const blink = Math.floor(state.elapsed * 6) % 2 === 0;
      if (blink) text(`SPOTTED by ${state.seenBy}!`, ALARM_BAR.x + ALARM_BAR.width / 2, 68, 20, PALETTE.alarmHigh, 'center');
    }
    // Tool buttons, bottom left.
    for (const button of TOOL_BUTTONS) {
      const tool = TOOLS[button.name];
      const affordable = state.coinsHeld >= tool.cost;
      const selected = selectedTool === button.name;
      context.fillStyle = selected ? PALETTE.buttonHot : PALETTE.button;
      context.fillRect(button.x, button.y, button.width, button.height);
      context.strokeStyle = selected ? '#ffffff' : PALETTE.panelEdge;
      context.lineWidth = 2;
      context.strokeRect(button.x, button.y, button.width, button.height);
      const label = `${tool.key} ${tool.name} $${tool.cost}`;
      text(label, button.x + button.width / 2, button.y + 11, 15, affordable ? PALETTE.text : PALETTE.muted, 'center');
    }
    // Active tool timers, bottom right.
    let line = 0;
    if (state.smoke > 0) { text(`Smoke ${state.smoke.toFixed(1)}s`, 1240, 620 + line * 20, 15, PALETTE.text, 'right'); line += 1; }
    if (state.emp > 0) { text(`EMP ${state.emp.toFixed(1)}s`, 1240, 620 + line * 20, 15, PALETTE.text, 'right'); line += 1; }
    if (state.disguise > 0) { text(`Disguise ${state.disguise.toFixed(1)}s`, 1240, 620 + line * 20, 15, PALETTE.text, 'right'); line += 1; }
    if (state.gemTaken) text('Gem secured — reach the EXIT!', 1240, 596, 16, PALETTE.gem, 'right');
    // The objective, top right: what the thief still has to do.
    const takenPieces = state.lootItems.filter((item) => item.taken).length;
    let objective;
    if (state.crack) objective = 'CRACKING — SPACE in the gold zone!';
    else if (!state.gemTaken) objective = `Loot the galleries ${takenPieces}/3 · then crack the vault`;
    else objective = 'GETAWAY! Reach the green EXIT!';
    text(objective, 1240, 36, 16, state.gemTaken ? PALETTE.gold : PALETTE.text, 'right');
    // The getaway banner, once the sapphire is out.
    if (state.gemTaken) {
      const blink = Math.floor(state.elapsed * 4) % 2 === 0;
      if (blink) text('GETAWAY — RUN FOR THE EXIT!', FIELD.width / 2, 130, 24, PALETTE.gold, 'center');
    }
    if (state.messageTime > 0) text(state.message, FIELD.width / 2, 96, 18, PALETTE.text, 'center');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(13, 15, 22, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.coin, 'center');
  }

  const TITLE_LINES = [
    'One museum. Four guards, a lookout, two cameras, a laser grid.',
    'Move with WASD or arrows. Read the cones before you move.',
    'Loot the galleries — Idol $60 · Mask $40 · Necklace $25 — then crack the vault.',
    'Crack the case: SPACE in the gold zone, three tumblers. Then RUN for the EXIT.',
    'Tools: 1 Smoke ($15) · 2 EMP ($25) · 3 Disguise ($40).',
    '',
  ];
  const PAUSED_LINES = ['The guards will wait for you.'];
  const CAUGHT_LINES = ['', ''];
  const WIN_LINES = ['', '', ''];

  /** Paint one frame: the floor, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, selectedTool) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // The world labels use an alphabetic baseline; the HUD sets 'top' for itself.
    context.textBaseline = 'alphabetic';
    // Screen shake while spotted: the whole museum jolts.
    if (state.spotted && screen === SCREEN_PLAY) {
      context.translate(Math.sin(state.elapsed * 47) * 3, Math.cos(state.elapsed * 39) * 3);
    }
    drawFloor();
    drawLasers(state);
    drawGuards(state);
    drawCameras(state);
    drawSolids();
    drawLoot(state);
    drawThief(state);
    drawSmoke(state);
    drawParticles(state);
    drawVignette();
    drawCrack(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('VELVET VAULT', TITLE_LINES, 'Press Space or click to start the heist');
      return;
    }
    drawHud(state, selectedTool);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_CAUGHT) {
      CAUGHT_LINES[0] = lootLabel(state.loot);
      CAUGHT_LINES[1] = `The alarm hit ${ALARM.max}. The guards closed in.`;
      drawPanel('CAUGHT!', CAUGHT_LINES, 'Press Space or click to try again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = lootLabel(state.loot);
      WIN_LINES[1] = `Time ${Math.round(state.elapsed)}s`;
      WIN_LINES[2] = bestLabel(best);
      drawPanel('CLEAN GETAWAY!', WIN_LINES, 'Press Space or click to steal again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toLogical };
}
