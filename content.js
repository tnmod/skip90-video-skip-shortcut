(() => {
  const interactionWindow = 20_000;
  const discoveryRetention = 3_000;
  const seekTolerance = 0.25;
  const overlayLifetime = 1_250;
  const interactions = new WeakMap();
  const configKeys = Skip90Config.storageKeys;
  const initialChanges = {};
  let storedSettings;
  let settings;
  let discovery;
  let discoveryTimer;
  let dismissOverlay;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const patch = {};
    for (const key of configKeys) {
      if (Object.hasOwn(changes, key)) patch[key] = changes[key].newValue;
    }
    if (settings) {
      Object.assign(storedSettings, patch);
      settings = Skip90Config.normalize(storedSettings);
    } else {
      Object.assign(initialChanges, patch);
      void loadSettings();
    }
  });

  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get(configKeys);
      if (!settings) {
        storedSettings = { ...stored, ...initialChanges };
        settings = Skip90Config.normalize(storedSettings);
      }
    } catch {
      // Keep shortcuts inactive until a storage read succeeds.
    }
  }

  void loadSettings();

  async function sendToWorker(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch {
      // A frame can outlive an extension reload or lose its messaging context.
      return undefined;
    }
  }

  function getShadowRoot(element) {
    return element.shadowRoot ?? (element instanceof HTMLElement ? chrome.dom?.openOrClosedShadowRoot(element) : null);
  }

  function isEditable(element) {
    return element instanceof Element && (element.isContentEditable ||
      element.matches('input, textarea, select, [role~="textbox"]'));
  }

  function inEditor(event) {
    if (document.designMode === "on" || event.composedPath().some(isEditable)) return true;

    // Closed shadow roots hide their inner target from composedPath().
    let focused = document.activeElement;
    while (focused) {
      if (isEditable(focused) || focused.closest('[role~="textbox"]')) return true;
      focused = getShadowRoot(focused)?.activeElement;
    }
    return false;
  }

  window.addEventListener("keydown", (event) => {
    if (!settings?.enabled || !event.isTrusted) return;
    const shortcutKey = Skip90Config.keyFromEvent(event);
    if (!shortcutKey || Skip90Config.durationFor(settings, shortcutKey) === undefined || inEditor(event)) {
      return;
    }

    event.preventDefault();
    void sendToWorker({ type: "SKIP_REQUEST", shortcutKey });
  }, { capture: true });

  function* findMediaElements() {
    const roots = [document];
    for (const root of roots) {
      const elements = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      for (let element = elements.nextNode(); element; element = elements.nextNode()) {
        if (element instanceof HTMLVideoElement || element instanceof HTMLIFrameElement ||
            element instanceof HTMLFrameElement) yield element;
        if (element.shadowRoot) roots.push(element.shadowRoot);
      }
    }
  }

  function getChildIndex(parent, child) {
    for (let index = 0; index < parent.length; index++) {
      if (parent[index] === child) return index;
    }
    return -1;
  }

  function getFramePath() {
    // Indexed WindowProxy access and identity are available across origins.
    // Only the embedding document reads the iframe element's CSS.
    const path = [];
    try {
      for (let child = window; child !== window.top; child = child.parent) {
        if (!child.parent || child.parent === child) return null;
        const index = getChildIndex(child.parent, child);
        if (index < 0) return null;
        path.push(index);
      }
      return path.reverse();
    } catch {
      return null;
    }
  }

  function composedContains(ancestor, element) {
    for (let node = element; node; node = node.assignedSlot ?? node.parentElement ?? node.getRootNode().host) {
      if (node === ancestor) return true;
    }
    return false;
  }

  function getFullscreenElement() {
    let element = document.fullscreenElement;
    let nested = element && getShadowRoot(element)?.fullscreenElement;
    while (nested && nested !== element) {
      element = nested;
      nested = getShadowRoot(element)?.fullscreenElement;
    }
    return element;
  }

  function getVisibleBox(element) {
    if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) {
      return null;
    }
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 ? box : null;
  }

  function canRender(video, fullscreen) {
    if (!video.isConnected || video.ownerDocument !== document || document.hidden ||
        (fullscreen && !composedContains(fullscreen, video))) {
      return false;
    }
    const box = getVisibleBox(video);
    if (!box || box.right <= 0 || box.bottom <= 0 || box.left >= innerWidth || box.top >= innerHeight) {
      return false;
    }

    // IntersectionObserver measures clipping across frames. Also check CSS visibility
    // on any embedding element reachable through the same-origin policy.
    for (let frame = window.frameElement; frame; frame = frame.ownerDocument.defaultView?.frameElement) {
      if (!getVisibleBox(frame)) return false;
    }
    return true;
  }

  function rememberInteraction(event) {
    if (!settings?.enabled || !event.isTrusted ||
        (event.type === "pointerdown" ? event.button !== 0 : event.detail !== 0)) {
      return;
    }
    const path = event.composedPath().filter((node) => node instanceof Element);
    const directVideo = path.find((node) => node instanceof HTMLVideoElement);
    if (directVideo) {
      interactions.set(directVideo, Date.now());
      return;
    }

    // Player buttons often overlay the video or sit immediately beside it.
    const targetBox = event.type === "click" ? path[0]?.getBoundingClientRect() : null;
    const x = targetBox ? targetBox.left + targetBox.width / 2 : event.clientX;
    const y = targetBox ? targetBox.top + targetBox.height / 2 : event.clientY;
    let best;
    for (const video of findMediaElements()) {
      if (!(video instanceof HTMLVideoElement)) continue;
      const box = getVisibleBox(video);
      if (!box) continue;
      const distance = Math.hypot(Math.max(box.left - x, x - box.right, 0),
        Math.max(box.top - y, y - box.bottom, 0));
      if (distance > 32) continue;

      const parentIndex = path.findIndex((node) => node !== document.body &&
        node !== document.documentElement && composedContains(node, video));
      if (distance > 0 && parentIndex === -1) continue;
      const proximity = parentIndex === -1 ? Infinity : parentIndex;
      const area = box.width * box.height;
      if (!best || distance < best.distance || (distance === best.distance &&
          (proximity < best.proximity || (proximity === best.proximity && area < best.area)))) {
        best = { video, distance, proximity, area };
      }
    }
    if (best) interactions.set(best.video, Date.now());
  }

  window.addEventListener("pointerdown", rememberInteraction, { capture: true, passive: true });
  window.addEventListener("click", rememberInteraction, { capture: true, passive: true });

  function sampleVisibleAreas(videos, deadline) {
    const areas = new Map();
    if (videos.length === 0) return Promise.resolve(areas);

    return new Promise((resolve) => {
      const observer = new IntersectionObserver((entries) => {
        for (const { target, isIntersecting, intersectionRect } of entries) {
          areas.set(target, isIntersecting ? intersectionRect.width * intersectionRect.height : 0);
        }
        if (areas.size === videos.length) finish();
      });
      const timer = setTimeout(finish, Math.max(0, deadline - Date.now() - 25));

      function finish() {
        observer.disconnect();
        clearTimeout(timer);
        resolve(areas);
      }

      for (const video of videos) observer.observe(video);
    });
  }

  function readMediaState(video, skipSeconds) {
    const { currentTime, duration, readyState, paused, ended, seeking, seekable } = video;
    if (readyState < HTMLMediaElement.HAVE_METADATA || seeking) return null;

    const seekableRanges = [];
    for (let index = 0; index < seekable.length; index++) {
      seekableRanges.push([seekable.start(index), seekable.end(index)]);
    }
    const targetTime = Skip90Media.getForwardTarget(currentTime, duration, seekableRanges, skipSeconds);
    if (targetTime === null) return null;

    return { currentTime, duration, readyState, paused, ended, seekableRanges, targetTime };
  }

  function isSameResource({ video, currentSrc, srcAttribute, srcObject }) {
    return video.isConnected && video.ownerDocument === document && video.currentSrc === currentSrc &&
      video.getAttribute("src") === srcAttribute && video.srcObject === srcObject;
  }

  async function discoverVideos({ requestId, shortcutKey, skipSeconds, deadline }) {
    const session = { requestId, shortcutKey, skipSeconds, videos: new Map() };
    clearTimeout(discoveryTimer);
    discovery = session;
    discoveryTimer = setTimeout(() => { discovery = undefined; }, discoveryRetention);

    const candidates = [];
    const framePath = getFramePath();
    const hiddenChildIndexes = [];
    if (!document.hidden) {
      const includeVideos = Skip90Config.durationFor(settings, shortcutKey) === skipSeconds;
      const fullscreen = getFullscreenElement();
      const eligibleVideos = [];
      for (const element of findMediaElements()) {
        if (element instanceof HTMLVideoElement) {
          if (includeVideos && element.readyState >= HTMLMediaElement.HAVE_METADATA &&
              !element.seeking && canRender(element, fullscreen)) eligibleVideos.push(element);
        } else if (framePath && element.contentWindow &&
            ((fullscreen && !composedContains(fullscreen, element)) || !getVisibleBox(element))) {
          const index = getChildIndex(window, element.contentWindow);
          if (index >= 0) hiddenChildIndexes.push(index);
        }
      }
      const visibleAreas = await sampleVisibleAreas(eligibleVideos, deadline);
      const recent = Date.now() - interactionWindow;
      for (const [video, visibleArea] of visibleAreas) {
        if (!(visibleArea > 0) || !video.isConnected) continue;
        const media = readMediaState(video, skipSeconds);
        if (!media) continue;

        const candidateId = String(candidates.length);
        session.videos.set(candidateId, {
          video, currentSrc: video.currentSrc, srcAttribute: video.getAttribute("src"), srcObject: video.srcObject,
        });
        const interaction = interactions.get(video) ?? 0;
        candidates.push({
          candidateId,
          isFullscreen: Boolean(fullscreen && composedContains(fullscreen, video)),
          lastInteractionAt: interaction >= recent ? interaction : 0,
          isPlaying: !media.paused && !media.ended,
          isPaused: media.paused,
          isVisible: true,
          visibleArea,
          currentTime: media.currentTime,
          duration: Number.isFinite(media.duration) ? media.duration : null,
          seekableRanges: media.seekableRanges,
          readyState: media.readyState,
        });
      }
    }

    if (discovery === session && Date.now() < deadline) {
      await sendToWorker({ type: "VIDEO_CANDIDATES", requestId, framePath, hiddenChildIndexes, candidates });
    }
  }

  function waitForSeek(candidate, targetTime, initialTime, deadline) {
    const { video } = candidate;
    return new Promise((resolve) => {
      const controller = new AbortController();
      const options = { signal: controller.signal };
      const timeout = setTimeout(() => finish(null), Math.max(0, deadline - Date.now()));
      let started = false;

      function finish(skippedSeconds) {
        clearTimeout(timeout);
        controller.abort();
        resolve(skippedSeconds);
      }

      video.addEventListener("seeking", (event) => {
        if (event.isTrusted) started = true;
      }, options);
      video.addEventListener("seeked", (event) => {
        if (!event.isTrusted || !started || video.seeking) return;
        const actualTime = video.currentTime;
        const confirmed = Date.now() < deadline && isSameResource(candidate) &&
          actualTime > initialTime && Math.abs(actualTime - targetTime) <= seekTolerance;
        finish(confirmed ? actualTime - initialTime : null);
      }, options);
      for (const type of ["emptied", "error", "loadstart"]) {
        video.addEventListener(type, (event) => {
          if (event.isTrusted) finish(null);
        }, options);
      }

      try {
        if (Date.now() >= deadline) return finish(null);
        video.currentTime = targetTime;
      } catch {
        finish(null);
      }
    });
  }

  function formatDuration(seconds) {
    if (seconds < 0.005) return "+<0:00.01";
    if (seconds < 0.995) return `+0:${seconds.toFixed(2).padStart(5, "0")}`;
    const rounded = Math.round(seconds);
    return `+${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
  }

  function showOverlay(candidate, skippedSeconds) {
    dismissOverlay?.();
    const { video } = candidate;

    const fullscreen = getFullscreenElement();
    const canUseContainer = fullscreen instanceof HTMLElement && !(fullscreen instanceof HTMLMediaElement) &&
      fullscreen.getRootNode() === document && !getShadowRoot(fullscreen);
    const parent = canUseContainer ? fullscreen : document.body ?? document.documentElement;
    const host = document.createElement("div");
    host.setAttribute("data-skip90-overlay", "");
    host.setAttribute("popover", "manual");
    host.style.setProperty("--skip90-lifetime", `${overlayLifetime}ms`);
    const canAnnounce = typeof host.ariaNotify === "function";
    if (!canAnnounce) host.setAttribute("role", "status");
    const root = host.attachShadow({ mode: "closed" });
    const surface = document.createElement("div");
    surface.setAttribute("part", "surface");
    const scrim = document.createElement("div");
    scrim.setAttribute("part", "scrim");
    scrim.setAttribute("aria-hidden", "true");
    const indicator = document.createElement("div");
    indicator.setAttribute("part", "indicator");
    const arrow = document.createElement("span");
    arrow.setAttribute("part", "arrow");
    arrow.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.setAttribute("part", "label");
    label.setAttribute("aria-hidden", "true");
    label.textContent = "Next";
    const duration = document.createElement("span");
    duration.setAttribute("part", "duration");
    indicator.append(arrow, label, duration);
    surface.append(scrim, indicator);
    root.append(surface);

    let frame;
    let timer;
    let lastBounds;

    function dismiss() {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      host.remove();
      dismissOverlay = undefined;
    }

    function updateBounds() {
      if (!isSameResource(candidate)) return false;
      const { left, top, right, bottom } = video.getBoundingClientRect();
      const x = Math.max(0, left);
      const y = Math.max(0, top);
      const width = Math.min(window.innerWidth, right) - x;
      const height = Math.min(window.innerHeight, bottom) - y;
      if (width <= 0 || height <= 0) return false;
      const bounds = `${x}/${y}/${width}/${height}`;
      if (bounds !== lastBounds) {
        host.style.setProperty("--skip90-left", `${x}px`);
        host.style.setProperty("--skip90-top", `${y}px`);
        host.style.setProperty("--skip90-width", `${width}px`);
        host.style.setProperty("--skip90-height", `${height}px`);
        lastBounds = bounds;
      }
      return true;
    }

    if (!updateBounds()) return;
    parent.append(host);

    try {
      host.showPopover();
    } catch {
      host.removeAttribute("popover");
    }

    const message = formatDuration(skippedSeconds);
    function followVideo() {
      if (!host.isConnected || !updateBounds()) {
        dismiss();
        return;
      }
      if (!duration.textContent) {
        duration.textContent = message;
        if (canAnnounce) host.ariaNotify(`Skipped forward ${message}`);
      }
      frame = requestAnimationFrame(followVideo);
    }

    dismissOverlay = dismiss;
    frame = requestAnimationFrame(followVideo);
    timer = setTimeout(dismiss, overlayLifetime);
  }

  async function executeSeek({ requestId, candidateId, shortcutKey, skipSeconds, deadline }) {
    const result = { type: "SEEK_RESULT", requestId };
    if (discovery?.requestId !== requestId || discovery.shortcutKey !== shortcutKey ||
        discovery.skipSeconds !== skipSeconds) {
      return { ...result, ok: false, reason: "discovery-expired" };
    }

    const candidate = discovery.videos.get(candidateId);
    clearTimeout(discoveryTimer);
    discovery = undefined;
    if (!candidate || !isSameResource(candidate) || !canRender(candidate.video, getFullscreenElement())) {
      return { ...result, ok: false, reason: "candidate-unavailable" };
    }
    if (Skip90Config.durationFor(settings, shortcutKey) !== skipSeconds) {
      return { ...result, ok: false, reason: "settings-changed" };
    }

    const media = readMediaState(candidate.video, skipSeconds);
    if (!media) return { ...result, ok: false, reason: "no-forward-target" };

    const skippedSeconds = await waitForSeek(candidate, media.targetTime, media.currentTime, deadline);
    if (skippedSeconds === null) return { ...result, ok: false, reason: "seek-unconfirmed" };

    showOverlay(candidate, skippedSeconds);
    return { ...result, ok: true, skippedSeconds };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || sender.tab || !message ||
        typeof message.requestId !== "string" || !message.requestId ||
        !Skip90Config.isValidShortcut(message.shortcutKey) ||
        !Skip90Config.isValidDuration(message.skipSeconds) ||
        !Number.isSafeInteger(message.deadline) || message.deadline <= Date.now()) {
      return undefined;
    }
    if (message.type === "DISCOVER_VIDEOS") {
      void discoverVideos(message).catch(() => {});
      return undefined;
    }
    if (message.type === "EXECUTE_SEEK" && typeof message.candidateId === "string" && message.candidateId) {
      void (async () => {
        try {
          sendResponse(await executeSeek(message));
        } catch {
          sendResponse({ type: "SEEK_RESULT", requestId: message.requestId, ok: false, reason: "seek-error" });
        }
      })();
      return true;
    }
    return undefined;
  });
})();
