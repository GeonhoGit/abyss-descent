'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGame({ savedData, savedRun, sharedStorage, storageError=false, createCanvas, source, random, runSaveEnabled } = {}) {
  const elements = new Map();
  const storage = sharedStorage || new Map();
  if (savedData !== undefined) {
    storage.set('abyss_save_v2', typeof savedData === 'string' ? savedData : JSON.stringify(savedData));
  }
  if (savedRun !== undefined) storage.set('abyss_run_v1', typeof savedRun === 'string' ? savedRun : JSON.stringify(savedRun));

  function eventTarget(target = {}) {
    const listeners = new Map();
    target.addEventListener = (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    };
    target.dispatchEvent = event => {
      event.target ??= target;
      event.currentTarget = target;
      for (const listener of listeners.get(event.type) || []) listener(event);
      return !event.defaultPrevented;
    };
    return target;
  }

  function canvasContext() {
    const noop = () => {};
    const context = {
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      getImageData: (x, y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      measureText: text => ({ width: String(text).length * 6 }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createLinearGradient: () => ({ addColorStop: noop }),
    };
    for (const method of ['arc', 'beginPath', 'bezierCurveTo', 'quadraticCurveTo', 'closePath', 'drawImage', 'ellipse', 'fill',
      'fillRect', 'fillText', 'lineTo', 'moveTo', 'putImageData', 'restore', 'rotate',
      'save', 'scale', 'setTransform', 'stroke', 'strokeRect', 'translate', 'clearRect']) {
      context[method] = noop;
    }
    return context;
  }

  let document;
  function createElement(tagName = 'div') {
    const classes = new Set();
    const canvas = tagName === 'canvas' && createCanvas ? createCanvas(480, 270) : null;
    const element = eventTarget(Object.assign(canvas || {}, {
      tagName: tagName.toUpperCase(), style: {}, children: [], innerHTML: '', textContent: '',
      value: '', disabled: false, width: 480, height: 270,
      classList: {
        add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle(name, force) {
          const add = force === undefined ? !classes.has(name) : force;
          if (add) classes.add(name); else classes.delete(name);
          return add;
        },
      },
      appendChild(child) { this.children.push(child); return child; },
      requestPointerLock() {
        document.pointerLockElement = this;
        dispatch(document, 'pointerlockchange');
      },
      requestFullscreen() { document.fullscreenElement = this; },
    }));
    if (!canvas) {
      const context = canvasContext();
      element.getContext = () => context;
    }
    return element;
  }

  function element(id) {
    if (!elements.has(id)) elements.set(id, createElement(id === 'c' ? 'canvas' : 'div'));
    return elements.get(id);
  }

  document = eventTarget({
    pointerLockElement: null, fullscreenElement: null,
    getElementById: element, createElement,
    exitPointerLock() {
      this.pointerLockElement = null;
      dispatch(document, 'pointerlockchange');
    },
    exitFullscreen() { this.fullscreenElement = null; },
  });
  document.documentElement = createElement('html');
  const window = eventTarget({ innerWidth: 960, innerHeight: 540 });

  function dispatch(target, type, payload = {}) {
    if (typeof target === 'string') target = target === 'document' ? document : target === 'window' ? window : element(target);
    const event = {
      type, defaultPrevented: false, repeat: false,
      preventDefault() { this.defaultPrevented = true; },
      ...payload,
    };
    target.dispatchEvent(event);
    return event;
  }

  // Rendering and audio are browser boundaries; the game script itself is unmodified.
  // AudioContext is deliberately absent, exercising the game's silent-audio fallback.
  const context = vm.createContext({
    console, document, window,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => { if(typeof storageError==='function'?storageError('set',key):storageError)throw Error('Storage unavailable');storage.set(key, String(value)); },
      removeItem: key => { if(typeof storageError==='function'?storageError('remove',key):storageError)throw Error('Storage unavailable');storage.delete(key); },
    },
    performance: { now: () => 1000 },
    requestAnimationFrame() {}, setInterval() {}, setTimeout() {},
  });
  const filename = path.join(__dirname, '..', 'index.html');
  let html = source ?? fs.readFileSync(filename, 'utf8');
  if(runSaveEnabled===false)html=html.replace('const RUN_SAVE_ENABLED=true;','const RUN_SAVE_ENABLED=false;');
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!script) throw new Error('Game inline script not found');
  if (random) vm.runInContext('Math', context).random = random;
  vm.runInContext(script[1], context, { filename, timeout: 5000 });

  return {
    run: code => vm.runInContext(code, context, { timeout: 5000 }),
    dispatch, element, document, window, storage,
  };
}

module.exports = { loadGame };
