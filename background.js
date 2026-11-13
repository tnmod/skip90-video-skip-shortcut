importScripts("config.js", "media.js");

const DISCOVERY_WINDOW_MS = 220;
const RECENT_INTERACTION_MS = 20_000;
const SEEK_WINDOW_MS = 1_800;
const SEEK_RESPONSE_GRACE_MS = 100;
const STORAGE_TIMEOUT_MS = 1_500;
const TIMED_OUT = Symbol("timed-out");
const settingKeys = Skip90Config.storageKeys;
const requestsByTab = new Map();

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    initializeSettings().catch((error) => console.error("Skip90 could not initialize settings", error));
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object" || !isContentSender(sender)) return;

  const tabId = sender.tab.id;
  if (message.type === "VIDEO_CANDIDATES") {
    collectReport(requestsByTab.get(tabId), message, sender);
    return;
  }

  if (message.type !== "SKIP_REQUEST" || !Skip90Config.isValidShortcut(message.shortcutKey)) return;

  const requestId = crypto.randomUUID();
  if (requestsByTab.has(tabId)) {
    sendResponse(failure(requestId, "busy"));
    return;
  }

  const request = {
    requestId,
    shortcutKey: message.shortcutKey,
    sourceFrameId: sender.frameId,
    sourceDocumentId: sender.documentId,
    reports: new Map(),
    discoveryDeadline: 0,
    skipSeconds: 0,
  };
  requestsByTab.set(tabId, request);
  respondToSkip(tabId, request, sendResponse);
  return true;
});

async function initializeSettings() {
  const stored = await chrome.storage.local.get(settingKeys);
  const normalized = Skip90Config.normalize(stored);
  const missing = Object.fromEntries(Object.keys(Skip90Config.defaults)
    .filter((key) => !Object.hasOwn(stored, key))
    .map((key) => [key, normalized[key]]));
  if (Object.keys(missing).length) await chrome.storage.local.set(missing);
}

function isContentSender(sender) {
  return sender.id === chrome.runtime.id
    && Number.isInteger(sender.tab?.id) && sender.tab.id >= 0
    && Number.isInteger(sender.frameId) && sender.frameId >= 0
    && typeof sender.documentId === "string" && sender.documentId.length > 0
    && (sender.documentLifecycle === undefined || sender.documentLifecycle === "active");
}

async function respondToSkip(tabId, request, sendResponse) {
  let outcome;
  try {
    outcome = await skipInTab(tabId, request);
  } catch (error) {
    console.error("Skip90 could not complete the skip request", error);
    outcome = failure(request.requestId, "request-failed");
  } finally {
    requestsByTab.delete(tabId);
  }
  sendResponse(outcome);
}

async function skipInTab(tabId, request) {
  const { requestId, shortcutKey } = request;
  const settings = await readSettings();
  if (!settings) return failure(requestId, "storage-error");
  const skipSeconds = Skip90Config.durationFor(settings, shortcutKey);
  if (skipSeconds === undefined) return failure(requestId, "settings-changed");

  request.skipSeconds = skipSeconds;
  request.discoveryDeadline = Date.now() + DISCOVERY_WINDOW_MS;
  // Each frame sends a separate report. The broadcast response is not used.
  chrome.tabs.sendMessage(tabId, {
    type: "DISCOVER_VIDEOS",
    requestId,
    shortcutKey,
    skipSeconds: request.skipSeconds,
    deadline: request.discoveryDeadline,
  }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, request.discoveryDeadline - Date.now())));
  request.discoveryDeadline = 0;

  const source = request.reports.get(request.sourceFrameId);
  if (source?.documentId !== request.sourceDocumentId) return failure(requestId, "discovery-timeout");

  const winner = selectCandidate(request.reports, Date.now());
  request.reports.clear();
  if (!winner) return failure(requestId, "no-candidate");

  const latestSettings = await readSettings();
  if (!latestSettings) return failure(requestId, "storage-error");
  if (Skip90Config.durationFor(latestSettings, shortcutKey) !== skipSeconds) {
    return failure(requestId, "settings-changed");
  }

  return executeSeek(tabId, request, winner);
}

async function readSettings() {
  try {
    const stored = await beforeDeadline(chrome.storage.local.get(settingKeys), Date.now() + STORAGE_TIMEOUT_MS);
    return stored === TIMED_OUT ? null : Skip90Config.normalize(stored);
  } catch {
    return null;
  }
}

function collectReport(request, message, sender) {
  if (!request || message.requestId !== request.requestId
      || Date.now() >= request.discoveryDeadline || !Array.isArray(message.candidates)) return;

  const { frameId, documentId } = sender;
  if (request.reports.get(frameId)?.documentId === documentId) return;

  const { framePath = null, hiddenChildIndexes = [] } = message;
  if (framePath !== null && (!Array.isArray(framePath) || (framePath.length === 0) !== (frameId === 0)
      || !framePath.every(isFrameIndex))) return;
  if (!Array.isArray(hiddenChildIndexes) || !hiddenChildIndexes.every(isFrameIndex)) return;

  const candidates = message.candidates.filter((candidate) => isEligibleCandidate(candidate, request.skipSeconds));
  request.reports.set(frameId, { documentId, candidates, framePath, hiddenChildIndexes });
}

function isFrameIndex(index) {
  return Number.isSafeInteger(index) && index >= 0;
}

function isEligibleCandidate(candidate, skipSeconds) {
  if (!candidate || typeof candidate !== "object") return false;
  const {
    candidateId, isFullscreen, lastInteractionAt, isPlaying, isPaused, isVisible, visibleArea,
    currentTime, duration, seekableRanges, readyState,
  } = candidate;

  if (typeof candidateId !== "string" || !candidateId
      || typeof isFullscreen !== "boolean" || typeof isPlaying !== "boolean" || typeof isPaused !== "boolean"
      || !Number.isFinite(lastInteractionAt) || lastInteractionAt < 0
      || isVisible !== true || !Number.isFinite(visibleArea) || visibleArea <= 0
      || !Number.isFinite(currentTime) || (duration !== null && (!Number.isFinite(duration) || duration <= 0))
      || !Number.isInteger(readyState) || readyState < 1 || readyState > 4
      || !Array.isArray(seekableRanges) || !seekableRanges.every(isValidRange)) return false;

  return Skip90Media.getForwardTarget(currentTime, duration ?? Infinity, seekableRanges, skipSeconds) !== null;
}

function isValidRange(range) {
  return Array.isArray(range) && range.length === 2
    && Number.isFinite(range[0]) && Number.isFinite(range[1]) && range[1] >= range[0];
}

function selectCandidate(reports, now) {
  const hiddenPaths = new Set();
  for (const { framePath, hiddenChildIndexes } of reports.values()) {
    if (!framePath) continue;
    const parentPath = ["", ...framePath].join("/");
    for (const index of hiddenChildIndexes) hiddenPaths.add(`${parentPath}/${index}`);
  }

  const candidates = [];
  for (const [frameId, { documentId, candidates: frameCandidates, framePath }] of reports) {
    if (hasHiddenAncestor(framePath, hiddenPaths)) continue;
    for (const candidate of frameCandidates) candidates.push({ ...candidate, frameId, documentId });
  }
  candidates.sort((left, right) =>
    Number(right.isFullscreen) - Number(left.isFullscreen)
    || recentInteraction(right, now) - recentInteraction(left, now)
    || Number(right.isPlaying) - Number(left.isPlaying)
    || right.visibleArea - left.visibleArea
    || left.frameId - right.frameId);
  return candidates[0];
}

function hasHiddenAncestor(framePath, hiddenPaths) {
  let path = "";
  for (const index of framePath ?? []) {
    path += `/${index}`;
    if (hiddenPaths.has(path)) return true;
  }
  return false;
}

function recentInteraction(candidate, now) {
  const timestamp = candidate.lastInteractionAt;
  return timestamp <= now && now - timestamp <= RECENT_INTERACTION_MS ? timestamp : 0;
}

async function executeSeek(tabId, request, winner) {
  const { requestId, shortcutKey, skipSeconds } = request;
  const deadline = Date.now() + SEEK_WINDOW_MS;
  let result;
  try {
    // A failed or missing reply can follow an actual seek, so never dispatch a replacement command.
    result = await beforeDeadline(chrome.tabs.sendMessage(tabId, {
      type: "EXECUTE_SEEK",
      requestId,
      candidateId: winner.candidateId,
      shortcutKey,
      skipSeconds,
      deadline,
    }, { documentId: winner.documentId }), deadline + SEEK_RESPONSE_GRACE_MS);
  } catch {
    return failure(requestId, "frame-unavailable");
  }

  if (result === TIMED_OUT) return failure(requestId, "seek-timeout");
  if (result?.type === "SEEK_RESULT" && result.requestId === requestId) {
    if (result.ok === true && Number.isFinite(result.skippedSeconds) && result.skippedSeconds > 0) {
      return { type: "SEEK_RESULT", requestId, ok: true, skippedSeconds: result.skippedSeconds };
    }
    if (result.ok === false && typeof result.reason === "string" && result.reason) {
      return failure(requestId, result.reason);
    }
  }
  return failure(requestId, "invalid-result");
}

async function beforeDeadline(promise, deadline) {
  let timer;
  try {
    const timeout = new Promise((resolve) => {
      timer = setTimeout(resolve, Math.max(0, deadline - Date.now()), TIMED_OUT);
    });
    const result = await Promise.race([promise, timeout]);
    return Date.now() > deadline ? TIMED_OUT : result;
  } finally {
    clearTimeout(timer);
  }
}

function failure(requestId, reason) {
  return { type: "SKIP_FAILED", requestId, reason };
}
