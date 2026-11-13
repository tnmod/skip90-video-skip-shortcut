"use strict";

const form = document.getElementById("settings");
const fields = document.getElementById("settings-fields");
const enabled = document.getElementById("enabled");
const currentState = document.getElementById("current-state");
const feedback = document.getElementById("feedback");
const saveButton = document.getElementById("save");
const addButton = document.getElementById("add-shortcut");
const list = document.getElementById("shortcuts");
const emptyList = document.getElementById("empty-list");
const rowTemplate = document.getElementById("shortcut-row");
const rows = [];
const maxShortcuts = 26;

let savedSettings;
let capturing;
let invalidField;
let saving = false;

function setFeedback(message, kind = "") {
  if (feedback.textContent !== message) feedback.textContent = message;
  feedback.dataset.kind = kind;
}

function clearError() {
  invalidField?.removeAttribute("aria-invalid");
  invalidField?.removeAttribute("aria-describedby");
  invalidField = undefined;
}

function readDraft() {
  const shortcuts = [];
  const usedKeys = new Set();
  for (const { minutes, seconds, keyButton, shortcutKey } of rows) {
    const minuteCount = Number(minutes.value);
    const secondCount = Number(seconds.value);
    if (!minutes.validity.valid || !Number.isSafeInteger(minuteCount)) {
      return { field: minutes, message: "Enter a whole number of minutes, 0 or more." };
    }
    if (!seconds.validity.valid || secondCount > 59) {
      return { field: seconds, message: "Enter a whole number of seconds from 0 to 59." };
    }
    const skipSeconds = minuteCount * 60 + secondCount;
    if (skipSeconds === 0) return { field: seconds, message: "Enter a duration of at least 1 second." };
    if (!Skip90Config.isValidDuration(skipSeconds)) {
      return { field: minutes, message: "Enter a shorter skip duration." };
    }
    if (!Skip90Config.isValidShortcut(shortcutKey)) {
      return { field: keyButton, message: "Set a key from A to Z for this duration." };
    }
    if (usedKeys.has(shortcutKey)) {
      return { field: keyButton, message: shortcutKey + " is already assigned to another shortcut." };
    }
    usedKeys.add(shortcutKey);
    shortcuts.push({ shortcutKey, skipSeconds });
  }
  return { settings: { enabled: enabled.checked, shortcuts } };
}

function matchesSaved(settings) {
  return JSON.stringify(settings) === JSON.stringify(savedSettings);
}

function showDraftState() {
  if (!saving && !capturing) {
    setFeedback(matchesSaved(readDraft().settings) ? "" : "Unsaved changes.");
  }
}

function onDraftChange() {
  clearError();
  showDraftState();
}

function showSavedState() {
  currentState.textContent = savedSettings.enabled ? "Shortcuts on" : "Shortcuts off";
  currentState.dataset.enabled = String(savedSettings.enabled);
}

function updateList() {
  emptyList.hidden = rows.length !== 0;
  list.hidden = rows.length === 0;
  addButton.disabled = rows.length >= maxShortcuts;
  for (const [index, row] of rows.entries()) {
    const position = index + 1;
    row.minutes.setAttribute("aria-label", "Minutes for shortcut " + position);
    row.seconds.setAttribute("aria-label", "Seconds for shortcut " + position);
    row.remove.setAttribute("aria-label", "Remove shortcut " + position);
    updateKeyButton(row);
  }
}

function updateKeyButton(row) {
  const position = rows.indexOf(row) + 1;
  const isCapturing = capturing === row;
  row.keyButton.textContent = isCapturing ? "Press key" : row.shortcutKey || "Set key";
  row.keyButton.setAttribute("aria-pressed", String(isCapturing));
  row.keyButton.setAttribute("aria-label", isCapturing ? "Press key A to Z for shortcut " + position :
    (row.shortcutKey ? "Change key " + row.shortcutKey : "Set key") + " for shortcut " + position);
}

function stopCapture() {
  if (!capturing) return;
  const row = capturing;
  capturing = undefined;
  updateKeyButton(row);
  showDraftState();
}

function captureKey(event, row) {
  if (capturing !== row || event.key === "Tab" ||
      event.altKey || event.ctrlKey || event.metaKey) return;

  event.preventDefault();
  if (event.key === "Escape") {
    stopCapture();
    return;
  }
  const key = Skip90Config.keyFromEvent(event);
  if (!key) return;
  if (rows.some((other) => other !== row && other.shortcutKey === key)) {
    setFeedback(key + " is already assigned. Press a different key.", "error");
    return;
  }
  row.shortcutKey = key;
  stopCapture();
  onDraftChange();
}

function addShortcut({ shortcutKey = "", skipSeconds = 0 } = {}) {
  const element = rowTemplate.content.firstElementChild.cloneNode(true);
  const row = {
    element, shortcutKey,
    minutes: element.querySelector(".minutes"),
    seconds: element.querySelector(".seconds"),
    keyButton: element.querySelector(".shortcut-key"),
    remove: element.querySelector(".remove"),
  };
  row.minutes.value = String(Math.floor(skipSeconds / 60));
  row.seconds.value = String(skipSeconds % 60).padStart(2, "0");
  row.keyButton.addEventListener("click", () => {
    if (capturing === row) {
      stopCapture();
      return;
    }
    stopCapture();
    clearError();
    capturing = row;
    row.keyButton.focus();
    updateKeyButton(row);
    setFeedback("Press a letter from A to Z. Esc cancels.");
  });
  row.keyButton.addEventListener("keydown", (event) => captureKey(event, row));
  row.keyButton.addEventListener("blur", () => {
    if (capturing === row) stopCapture();
  });
  row.remove.addEventListener("click", () => {
    const index = rows.indexOf(row);
    rows.splice(index, 1);
    element.remove();
    updateList();
    onDraftChange();
    (rows[index]?.minutes ?? rows.at(-1)?.minutes ?? addButton).focus();
  });
  list.append(element);
  rows.push(row);
  return row;
}

addButton.addEventListener("click", () => {
  const row = addShortcut();
  updateList();
  onDraftChange();
  row.seconds.focus();
  row.seconds.select();
});

form.addEventListener("input", onDraftChange);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!savedSettings || saving) return;
  stopCapture();
  clearError();
  const draft = readDraft();
  if (!draft.settings) {
    setFeedback(draft.message, "error");
    invalidField = draft.field;
    invalidField.setAttribute("aria-invalid", "true");
    invalidField.setAttribute("aria-describedby", feedback.id);
    invalidField.focus();
    return;
  }

  saving = true;
  saveButton.setAttribute("aria-disabled", "true");
  saveButton.textContent = "Saving…";
  setFeedback("");
  try {
    await chrome.storage.local.set(draft.settings);
    savedSettings = draft.settings;
    showSavedState();
    setFeedback(matchesSaved(readDraft().settings) ? "Settings saved." :
      "Settings saved. New edits are unsaved.", "success");
  } catch {
    setFeedback("Couldn’t save settings. Try again.", "error");
  } finally {
    saving = false;
    saveButton.removeAttribute("aria-disabled");
    saveButton.textContent = "Save settings";
  }
});

async function loadSettings() {
  try {
    savedSettings = Skip90Config.normalize(await chrome.storage.local.get(Skip90Config.storageKeys));
    enabled.checked = savedSettings.enabled;
    for (const shortcut of savedSettings.shortcuts) addShortcut(shortcut);
    updateList();
    showSavedState();
    fields.disabled = false;
    enabled.disabled = false;
  } catch {
    currentState.textContent = "Settings unavailable";
    setFeedback("Couldn’t load settings. Reopen Skip90 to retry.", "error");
  }
}

void loadSettings();
