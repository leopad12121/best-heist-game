// Keyboard and pointer input. Held keys give a steering direction; one-shot presses
// (start, pause, use a tool) are queued and taken once by the loop, so a press between
// two frames is never lost and never counted twice. Pointer clicks are queued with
// their client coordinates; the caller turns them into playfield coordinates.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const TOOL_KEYS = { Digit1: 'smoke', Digit2: 'emp', Digit3: 'disguise', Digit4: 'decoy' };

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let toolQueue = [];
  const clicks = [];

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (TOOL_KEYS[event.code]) {
      if (!event.repeat) toolQueue.push(TOOL_KEYS[event.code]);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
  });
  target.addEventListener('pointerdown', (event) => {
    clicks.push({ x: event.clientX, y: event.clientY });
  });

  return {
    /** The steering direction this frame, as { x, y } with each component -1, 0 or 1. */
    direction() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Tool keys pressed since the last call, in order. */
    takeTools() {
      const taken = toolQueue;
      toolQueue = [];
      return taken;
    },
    /** Pointer clicks since the last call, in order. */
    takeClicks() {
      const taken = clicks.splice(0, clicks.length);
      return taken;
    },
  };
}
