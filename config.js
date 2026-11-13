const Skip90Config = (() => {
  const defaultShortcut = Object.freeze({ shortcutKey: "S", skipSeconds: 90 });
  const defaults = Object.freeze({ enabled: true, shortcuts: Object.freeze([defaultShortcut]) });
  const storageKeys = Object.freeze(["enabled", "shortcuts", "shortcutKey", "skipSeconds"]);

  function isValidDuration(value) {
    return Number.isSafeInteger(value) && value > 0;
  }

  function isValidShortcut(value) {
    return typeof value === "string" && /^[A-Z]$/.test(value);
  }

  function normalize(values = {}) {
    const shortcuts = [];
    if (Array.isArray(values.shortcuts)) {
      const usedKeys = new Set();
      for (const shortcut of values.shortcuts) {
        if (!isValidShortcut(shortcut?.shortcutKey) || !isValidDuration(shortcut.skipSeconds) ||
            usedKeys.has(shortcut.shortcutKey)) continue;
        shortcuts.push({ shortcutKey: shortcut.shortcutKey, skipSeconds: shortcut.skipSeconds });
        usedKeys.add(shortcut.shortcutKey);
      }
    } else {
      shortcuts.push({
        shortcutKey: isValidShortcut(values.shortcutKey) ? values.shortcutKey : defaultShortcut.shortcutKey,
        skipSeconds: isValidDuration(values.skipSeconds) ? values.skipSeconds : defaultShortcut.skipSeconds,
      });
    }
    return {
      enabled: typeof values.enabled === "boolean" ? values.enabled : defaults.enabled,
      shortcuts,
    };
  }

  function durationFor(settings, shortcutKey) {
    if (!settings?.enabled) return undefined;
    return settings.shortcuts.find((shortcut) => shortcut.shortcutKey === shortcutKey)?.skipSeconds;
  }

  function keyFromEvent(event) {
    if (event.repeat || event.isComposing || event.keyCode === 229 ||
        event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
        !/^[a-z]$/i.test(event.key)) return undefined;
    return event.key.toUpperCase();
  }

  return Object.freeze({ defaults, storageKeys, isValidDuration, isValidShortcut, normalize, durationFor, keyFromEvent });
})();
