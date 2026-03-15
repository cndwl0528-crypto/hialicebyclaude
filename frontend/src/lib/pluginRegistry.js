/**
 * pluginRegistry.js — HiAlice Session Plugin System
 *
 * Provides a lightweight, framework-agnostic plugin registry that allows
 * external modules to hook into session lifecycle events without coupling
 * directly to SessionContext internals.
 *
 * Design principles:
 *  - Pure module: no React dependency, importable from any context
 *  - Immutable patterns: registered plugin objects are never mutated
 *  - Error isolation: a crash in one plugin handler never affects others
 *  - Fire-and-forget: hook emission is synchronous but exceptions are swallowed
 *
 * Lifecycle hooks available to plugins:
 *  - onSessionStart(sessionData)
 *      Called once when the session is fully initialised.
 *      sessionData: { bookId, bookTitle, studentLevel, studentAge, stages }
 *
 *  - onStageAdvance(fromStage, toStage, context)
 *      Called each time the student advances to a new stage.
 *      fromStage / toStage: display-name strings (e.g. "Think Deeper")
 *      context: { turn, messages }
 *
 *  - onTurnComplete(stage, turn, studentMessage, aliceResponse)
 *      Called after Alice's reply is received and rendered.
 *      stage: current display-name string
 *      turn: 0-indexed turn number within the stage
 *      studentMessage / aliceResponse: plain strings
 *
 *  - onVocabDetected(word, context)
 *      Called when a vocabulary word is spotted in an AI response.
 *      word: the matched word string
 *      context: { definition, example }
 *
 *  - onSessionEnd(sessionData, scores)
 *      Called when the session completes (all stages finished or skipped).
 *      sessionData: { bookId, totalTurns, duration }
 *      scores: stageScores object
 *
 *  - onAchievementUnlocked(achievement)
 *      Called when the backend returns a new badge or achievement.
 *      achievement: raw achievement object from API response
 *
 * Plugin shape:
 *  {
 *    onSessionStart?: (sessionData) => void,
 *    onStageAdvance?: (fromStage, toStage, context) => void,
 *    onTurnComplete?: (stage, turn, studentMessage, aliceResponse) => void,
 *    onVocabDetected?: (word, context) => void,
 *    onSessionEnd?: (sessionData, scores) => void,
 *    onAchievementUnlocked?: (achievement) => void,
 *    slots?: Record<string, React.ComponentType>,  // optional UI slots
 *  }
 *
 * PluginSlot (React component — exported separately):
 *  <PluginSlot name="afterStageProgress" context={sessionData} />
 *  Renders every plugin's slot component for the given slot name.
 *  If no plugin provides the named slot, renders nothing.
 */

// ── Valid hook names ────────────────────────────────────────────────────────
const VALID_HOOKS = [
  'onSessionStart',
  'onStageAdvance',
  'onTurnComplete',
  'onVocabDetected',
  'onSessionEnd',
  'onAchievementUnlocked',
];

// ── Internal registry state ────────────────────────────────────────────────
// _plugins  : Map<name, plugin>           — registered plugin objects (frozen)
// _hooks    : Record<hookName, handler[]> — sorted arrays of handler functions
//
// Both are module-level singletons. clearAllPlugins() resets them for tests.
let _plugins = new Map();
let _hooks = Object.fromEntries(VALID_HOOKS.map((h) => [h, []]));

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * registerPlugin
 * Registers a plugin under the given name.
 * The plugin object must implement at least one recognised lifecycle hook.
 *
 * @param {string} name    - Unique identifier for this plugin
 * @param {object} plugin  - Plugin definition object (see shape above)
 * @returns {() => void}   - Unregister function; call it to remove the plugin
 * @throws {Error}         - If name is not a non-empty string
 * @throws {Error}         - If plugin contains no recognised lifecycle hooks
 */
export function registerPlugin(name, plugin) {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('[pluginRegistry] registerPlugin: name must be a non-empty string');
  }

  if (!plugin || typeof plugin !== 'object') {
    throw new Error(`[pluginRegistry] registerPlugin: plugin "${name}" must be an object`);
  }

  const hasHook = VALID_HOOKS.some((h) => typeof plugin[h] === 'function');
  if (!hasHook) {
    throw new Error(
      `[pluginRegistry] registerPlugin: plugin "${name}" must implement at least one of: ${VALID_HOOKS.join(', ')}`
    );
  }

  if (_plugins.has(name)) {
    console.warn(`[pluginRegistry] Plugin "${name}" is already registered — replacing it.`);
    unregisterPlugin(name);
  }

  // Freeze a shallow copy so callers cannot mutate the stored plugin object
  const frozenPlugin = Object.freeze({ ...plugin });
  _plugins = new Map([..._plugins, [name, frozenPlugin]]);

  // Register each hook handler into the corresponding array (immutable update)
  const nextHooks = { ..._hooks };
  for (const hookName of VALID_HOOKS) {
    if (typeof frozenPlugin[hookName] === 'function') {
      // Tag the handler with the plugin name so we can remove it later
      const tagged = Object.assign(frozenPlugin[hookName].bind(frozenPlugin), { __pluginName: name });
      nextHooks[hookName] = [...nextHooks[hookName], tagged];
    }
  }
  _hooks = nextHooks;

  return () => unregisterPlugin(name);
}

/**
 * unregisterPlugin
 * Removes a plugin and all of its hook handlers from the registry.
 * Safe to call even if the plugin was never registered.
 *
 * @param {string} name - Plugin name to remove
 */
export function unregisterPlugin(name) {
  if (!_plugins.has(name)) return;

  // Remove from plugin map (immutable)
  const nextPlugins = new Map(_plugins);
  nextPlugins.delete(name);
  _plugins = nextPlugins;

  // Remove all handlers belonging to this plugin (immutable)
  const nextHooks = { ..._hooks };
  for (const hookName of VALID_HOOKS) {
    nextHooks[hookName] = _hooks[hookName].filter((fn) => fn.__pluginName !== name);
  }
  _hooks = nextHooks;
}

/**
 * emitHook
 * Invokes every registered handler for the named hook, passing the provided
 * arguments. Each handler is wrapped in an individual try/catch so a crash
 * in one plugin never propagates to the caller or to other plugins.
 *
 * This function is intentionally synchronous. Plugin handlers should NOT
 * perform async work that needs to block the session — use fire-and-forget
 * promises internally if needed.
 *
 * @param {string}    hookName - One of the VALID_HOOKS names
 * @param {...*}      args     - Arguments forwarded to each handler
 */
export function emitHook(hookName, ...args) {
  if (!VALID_HOOKS.includes(hookName)) {
    console.warn(`[pluginRegistry] emitHook: unknown hook "${hookName}" — skipping`);
    return;
  }

  const handlers = _hooks[hookName];
  if (!handlers || handlers.length === 0) return;

  for (const handler of handlers) {
    try {
      handler(...args);
    } catch (err) {
      console.warn(
        `[pluginRegistry] Plugin "${handler.__pluginName}" threw in "${hookName}":`,
        err
      );
    }
  }
}

/**
 * getRegisteredPlugins
 * Returns an array of registered plugin names (in insertion order).
 *
 * @returns {string[]}
 */
export function getRegisteredPlugins() {
  return [..._plugins.keys()];
}

/**
 * clearAllPlugins
 * Resets the registry to an empty state.
 * Intended for use in test suites; avoid calling in production code.
 */
export function clearAllPlugins() {
  _plugins = new Map();
  _hooks = Object.fromEntries(VALID_HOOKS.map((h) => [h, []]));
}

// ── PluginSlot React component ─────────────────────────────────────────────
// Imported lazily so the file remains usable in non-React contexts without
// bundling React as a hard dependency of pure-utility consumers.
//
// The component is defined here (same file) but uses a local React import
// so it is tree-shaken by bundlers that do not reference it.
import React from 'react';

/**
 * PluginSlotErrorBoundary
 * Catches errors from individual plugin slot renderers so one broken plugin
 * component cannot crash the parent page.
 */
class PluginSlotErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.warn(
      `[pluginRegistry] PluginSlot "${this.props.slotName}" crashed in plugin "${this.props.pluginName}":`,
      error,
      info
    );
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/**
 * PluginSlot
 * Renders UI contributed by plugins for the given named slot.
 *
 * Usage:
 *   <PluginSlot name="afterStageProgress" context={sessionData} />
 *
 * Plugins provide slot components via:
 *   plugin.slots = { afterStageProgress: MyComponent }
 *
 * Each slot component receives the `context` prop passed to PluginSlot.
 * Slot components are rendered in plugin insertion order.
 * If no plugin provides the named slot, nothing is rendered.
 *
 * @param {{ name: string, context?: * }} props
 */
export function PluginSlot({ name, context }) {
  const slotRenderers = [];

  for (const [pluginName, plugin] of _plugins.entries()) {
    const SlotComponent = plugin.slots?.[name];
    if (typeof SlotComponent !== 'function' && typeof SlotComponent !== 'object') continue;

    slotRenderers.push(
      React.createElement(
        PluginSlotErrorBoundary,
        { key: pluginName, slotName: name, pluginName },
        React.createElement(SlotComponent, { context })
      )
    );
  }

  if (slotRenderers.length === 0) return null;

  return React.createElement(React.Fragment, null, ...slotRenderers);
}

// ── Default export (convenience object) ────────────────────────────────────
export default {
  registerPlugin,
  unregisterPlugin,
  emitHook,
  getRegisteredPlugins,
  clearAllPlugins,
};
