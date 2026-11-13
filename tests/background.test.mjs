import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";

const scripts = new Map(await Promise.all(["background.js", "config.js", "media.js"].map(async (filename) =>
  [filename, await readFile(new URL(`../${filename}`, import.meta.url), "utf8")])));
const extensionId = "skip90-test-extension";
const skipRequest = { type: "SKIP_REQUEST", shortcutKey: "S" };

function sender(frameId, documentId = `document-${frameId}`, tabId = 1) {
  return { id: extensionId, tab: { id: tabId }, frameId, documentId, documentLifecycle: "active" };
}

function video(candidateId, properties = {}) {
  return {
    candidateId,
    isFullscreen: false,
    lastInteractionAt: 0,
    isPlaying: false,
    isPaused: true,
    isVisible: true,
    visibleArea: 1_000,
    currentTime: 200,
    duration: 300,
    seekableRanges: [[0, 300]],
    readyState: 4,
    ...properties,
  };
}

function successfulSeek({ requestId, skipSeconds }) {
  return { type: "SEEK_RESULT", requestId, ok: true, skippedSeconds: skipSeconds };
}

function createWorker({ stored = {}, discover, execute = successfulSeek } = {}) {
  let onMessage;
  let onInstalled;
  const settings = { ...stored };
  const broadcasts = [];
  const seeks = [];

  function send(message, source = sender(0)) {
    return new Promise((resolve) => {
      const keepOpen = onMessage(structuredClone(message), source, (reply) => resolve(structuredClone(reply)));
      if (keepOpen !== true) resolve();
    });
  }

  function report(requestId, candidates, source, visibility = {}) {
    return send({ ...visibility, type: "VIDEO_CANDIDATES", requestId, candidates }, source);
  }

  const chrome = {
    runtime: {
      id: extensionId,
      onInstalled: { addListener: (listener) => { onInstalled = listener; } },
      onMessage: { addListener: (listener) => { onMessage = listener; } },
    },
    storage: {
      local: {
        get: async (keys) => Object.fromEntries(keys.filter((key) => key in settings)
          .map((key) => [key, settings[key]])),
        set: async (values) => Object.assign(settings, structuredClone(values)),
      },
    },
    tabs: {
      async sendMessage(tabId, rawMessage, rawTarget) {
        const message = structuredClone(rawMessage);
        if (message.type === "DISCOVER_VIDEOS") {
          broadcasts.push({ tabId, message, target: structuredClone(rawTarget) });
          await discover?.(message, { report, settings, tabId });
          return;
        }
        seeks.push({ tabId, message, target: structuredClone(rawTarget) });
        return execute(message);
      },
    },
  };
  const context = createContext({
    chrome,
    console,
    setTimeout,
    clearTimeout,
    crypto: { randomUUID },
    importScripts(...filenames) {
      for (const filename of filenames) runInContext(scripts.get(filename), context, { filename });
    },
  });
  runInContext(scripts.get("background.js"), context, { filename: "background.js" });

  return {
    send, broadcasts, seeks, settings,
    async install(reason) {
      onInstalled({ reason });
      await setImmediate();
    },
  };
}

test("writes defaults on install and preserves saved values", async () => {
  const fresh = createWorker();
  await fresh.install("install");
  assert.deepEqual(fresh.settings, { enabled: true, shortcuts: [{ shortcutKey: "S", skipSeconds: 90 }] });

  const shortcuts = [{ shortcutKey: "A", skipSeconds: 100 }];
  const existing = createWorker({ stored: { enabled: false, shortcuts } });
  await existing.install("update");
  assert.deepEqual(existing.settings, { enabled: false, shortcuts });
});

test("ranks across frames by fullscreen, recent interaction, playback, and visible area", async (t) => {
  const cases = [
    ["fullscreen", { isFullscreen: true }, { lastInteractionAt: Date.now() }, "second"],
    ["recent interaction", { lastInteractionAt: Date.now() }, {}, "second"],
    ["playback", { isPlaying: true, isPaused: false }, {}, "second"],
    ["visible area", {}, {}, "first"],
  ];

  for (const [priority, second, first, expected] of cases) {
    await t.test(priority, async () => {
      const worker = createWorker({
        discover({ requestId }, { report }) {
          report(requestId, [video("first", { visibleArea: 8_000, ...first })], sender(0));
          report(requestId, [video("second", second)], sender(1));
        },
      });

      const result = await worker.send(skipRequest);
      assert.equal(result.type, "SEEK_RESULT");
      assert.equal(result.skippedSeconds, 90);
      assert.equal(worker.broadcasts[0].target, undefined);
      assert.equal(worker.seeks.length, 1);
      assert.equal(worker.seeks[0].message.candidateId, expected);
      assert.equal(worker.seeks[0].message.requestId, result.requestId);
      assert.equal(worker.seeks[0].target.documentId, expected === "first" ? "document-0" : "document-1");
    });
  }
});

test("ignores invalid, stale, duplicate, and cross-tab reports", async () => {
  const worker = createWorker({
    discover({ requestId }, { report }) {
      const preferred = video("invalid", { isFullscreen: true });
      report(requestId, [preferred], { ...sender(0), id: "different-extension" });
      report(requestId, [preferred], { ...sender(0), frameId: -1 });
      report(requestId, [preferred], { ...sender(0), documentId: undefined });
      report(requestId, [preferred], { ...sender(0), documentLifecycle: "cached" });
      report(requestId, [preferred], sender(0, "document-0", 2));
      report("previous-request", [preferred], sender(0));
      report(requestId, [video("main")], sender(0));
      report(requestId, [preferred], sender(0));
      report(requestId, [video("malformed", { isFullscreen: true, seekableRanges: [[300, 0]] })], sender(1));
      report(requestId, [video("no-forward-time", { isFullscreen: true, seekableRanges: [[0, 200]] })], sender(2));
    },
  });

  assert.equal(await worker.send(skipRequest, { ...sender(0), tab: undefined }), undefined);
  assert.equal(await worker.send({ type: "SKIP_REQUEST", shortcutKey: "?" }), undefined);
  assert.equal(worker.broadcasts.length, 0);
  assert.equal((await worker.send(skipRequest)).type, "SEEK_RESULT");
  assert.equal(worker.seeks.length, 1);
  assert.equal(worker.seeks[0].message.candidateId, "main");
});

test("excludes hidden frame branches using CSS visibility reports from ancestors", async () => {
  const worker = createWorker({
    discover({ requestId }, { report }) {
      const preferred = (id) => [video(id, { isFullscreen: true })];
      report(requestId, [], sender(0), { framePath: [], hiddenChildIndexes: [0] });
      report(requestId, preferred("hidden-child"), sender(1), { framePath: [0] });
      report(requestId, preferred("hidden-descendant"), sender(2), { framePath: [0, 1] });
      report(requestId, [], sender(3), { framePath: [1], hiddenChildIndexes: [0] });
      report(requestId, preferred("nested-hidden-child"), sender(4), { framePath: [1, 0] });
      report(requestId, [video("visible")], sender(5), { framePath: [1, 1] });
      report(requestId, preferred("invalid-root"), sender(6), { framePath: [], hiddenChildIndexes: [1] });
      report(requestId, preferred("invalid-index"), sender(7), { framePath: [2, -1] });
      report(requestId, preferred("invalid-child-index"), sender(8), { framePath: [3], hiddenChildIndexes: ["0"] });
    },
  });

  assert.equal((await worker.send(skipRequest)).type, "SEEK_RESULT");
  assert.equal(worker.seeks.length, 1);
  assert.equal(worker.seeks[0].message.candidateId, "visible");
  assert.equal(worker.seeks[0].target.documentId, "document-5");
});

test("accepts an unbounded duration and a finite forward seek point", async () => {
  const worker = createWorker({
    discover({ requestId }, { report }) {
      report(requestId, [video("live", { duration: null, seekableRanges: [[225, 225]] })], sender(0));
    },
  });
  assert.equal((await worker.send(skipRequest)).type, "SEEK_RESULT");
  assert.equal(worker.seeks[0].message.candidateId, "live");
});

test("drops requests when the original document does not report or is replaced", async (t) => {
  for (const sourceReplaced of [false, true]) {
    await t.test(sourceReplaced ? "replacement document" : "missing original report", async () => {
      const worker = createWorker({
        discover({ requestId }, { report }) {
          report(requestId, [video("other-frame")], sender(1));
          if (sourceReplaced) {
            report(requestId, [], sender(0));
            report(requestId, [video("replacement")], sender(0, "new-document"));
          }
        },
      });
      assert.equal((await worker.send(skipRequest)).reason, "discovery-timeout");
      assert.equal(worker.seeks.length, 0);
    });
  }
});

test("reads settings again before dispatch and drops a stale gesture", async () => {
  const worker = createWorker({
    discover({ requestId }, { report, settings }) {
      report(requestId, [video("main")], sender(0));
      settings.shortcuts = [{ shortcutKey: "B", skipSeconds: 90 }];
    },
  });
  assert.equal((await worker.send(skipRequest)).reason, "settings-changed");
  assert.equal(worker.seeks.length, 0);

  const result = await worker.send({ ...skipRequest, shortcutKey: "B" });
  assert.equal(result.skippedSeconds, 90);
  assert.equal(worker.seeks.length, 1);
});

test("locks a tab through seek confirmation while another tab can skip", async () => {
  const confirmation = Promise.withResolvers();
  const dispatched = Promise.withResolvers();
  let dispatchCount = 0;
  const worker = createWorker({
    discover({ requestId }, { report, tabId }) {
      report(requestId, [video("main")], sender(0, `tab-${tabId}`, tabId));
    },
    async execute(message) {
      dispatchCount++;
      if (dispatchCount === 1) {
        dispatched.resolve();
        await confirmation.promise;
      }
      return successfulSeek(message);
    },
  });

  const first = worker.send(skipRequest, sender(0, "tab-1", 1));
  assert.equal((await worker.send(skipRequest, sender(0, "tab-1", 1))).reason, "busy");
  await dispatched.promise;
  assert.equal((await worker.send(skipRequest, sender(0, "tab-1", 1))).reason, "busy");
  assert.equal((await worker.send(skipRequest, sender(0, "tab-2", 2))).type, "SEEK_RESULT");
  confirmation.resolve();
  assert.equal((await first).type, "SEEK_RESULT");
  assert.deepEqual(worker.seeks.map(({ tabId }) => tabId), [1, 2]);
});

test("fails an invalid seek reply or unreachable winner without trying a second candidate", async (t) => {
  const cases = [
    ["invalid-result", () => ({ type: "SEEK_RESULT", requestId: "other-request", ok: true, skippedSeconds: 90 })],
    ["frame-unavailable", () => { throw new Error("Document navigated"); }],
  ];
  for (const [reason, execute] of cases) {
    await t.test(reason, async () => {
      const worker = createWorker({
        discover({ requestId }, { report }) {
          report(requestId, [video("fallback")], sender(0));
          report(requestId, [video("winner", { isFullscreen: true })], sender(1));
        },
        execute,
      });
      assert.equal((await worker.send(skipRequest)).reason, reason);
      assert.equal(worker.seeks.length, 1);
      assert.equal(worker.seeks[0].message.candidateId, "winner");
    });
  }
});

test("times out a missing seek reply and releases the tab lock without a second dispatch", async () => {
  let timedOut = false;
  const worker = createWorker({
    discover({ requestId }, { report }) {
      report(requestId, [video("main"), video("fallback")], sender(0));
    },
    execute(message) {
      return timedOut ? successfulSeek(message) : new Promise(() => {});
    },
  });
  assert.equal((await worker.send(skipRequest)).reason, "seek-timeout");
  assert.equal(worker.seeks.length, 1);
  timedOut = true;
  assert.equal((await worker.send(skipRequest)).type, "SEEK_RESULT");
  assert.equal(worker.seeks.length, 2);
});
