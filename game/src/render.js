// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// museum floor is scaled to fit the window and centred, the margin filled with the
// backdrop colour. Canvas shapes and text: floor tiles and carpet, walls and display
// cases, guards with their vision cones, sweeping cameras, the gem, the coins, the exit
// door, the thief, the smoke, then the HUD (alarm meter, coins, tool buttons) and the
// screen panels.

import { ALARM, CAMERA, EXIT, FIELD, FONT, GUARD, PALETTE, TOOLS } from './config.js';
import { COVER, GEM as GEM_POS, SOLIDS } from './world.js';

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
    text('EXIT', EXIT.x + EXIT.width / 2, EXIT.y - 14, 16, PALETTE.exit, 'center');
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
      drawCone(guard.x, guard.y, guard.facing, GUARD.sight, GUARD.halfCone, PALETTE.guardCone, PALETTE.guardConeEdge);
    }
    for (const guard of state.guards) {
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      context.fill();
      // The guard's cap brim points where it looks.
      context.fillStyle = '#7a1f1a';
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.facing) * 8, guard.y + Math.sin(guard.facing) * 8, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(guard.x - 4, guard.y - 4, 2, 0, Math.PI * 2);
      context.arc(guard.x + 4, guard.y - 4, 2, 0, Math.PI * 2);
      context.fill();
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
    'One museum. Three guards. Two cameras. One sapphire.',
    'Move with WASD or arrows. Read the cones before you move.',
    'Tools: 1 Smoke ($15) · 2 EMP ($25) · 3 Disguise ($40).',
    'Grab the Starlight Sapphire, then slip out the green EXIT.',
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
    drawFloor();
    drawGuards(state);
    drawCameras(state);
    drawSolids();
    drawLoot(state);
    drawThief(state);
    drawSmoke(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
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
