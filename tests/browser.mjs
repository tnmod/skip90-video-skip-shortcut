import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { startFixtures } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKIP90_PLAYWRIGHT || 'playwright');
const extensionPath = fileURLToPath(new URL('../', import.meta.url));
const artifacts = process.env.SKIP90_ARTIFACTS && resolve(process.env.SKIP90_ARTIFACTS);
const overlay = '[data-skip90-overlay]';
const storageKeys = ['enabled', 'shortcuts'];
const defaults = singleShortcut('S', 90);
const testTimeout = 5000;
const stableTemp = await realpath(tmpdir());
const profile = await mkdtemp(join(stableTemp, 'skip90-test-'));
const fixtures = await startFixtures();
const results = [];
let browserContext;
let popup;
let page;
let extensionId;

async function launch() {
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: process.env.SKIP90_HEADED !== '1',
    viewport: { width: 1200, height: 675 },
    args: ['--enable-unsafe-extension-debugging'],
    ignoreDefaultArgs: ['--disable-extensions'],
  });
  context.setDefaultTimeout(testTimeout);
  return context;
}

async function loadUnpacked() {
  const session = await browserContext.browser().newBrowserCDPSession();
  try {
    const { id } = await session.send('Extensions.loadUnpacked', { path: extensionPath });
    return id;
  } finally {
    await session.detach();
  }
}

async function check(name, run) {
  try {
    await run();
    console.log(`PASS ${name}`);
    results.push(true);
  } catch (error) {
    console.error(`FAIL ${name}\n${error.stack || error}`);
    results.push(false);
  }
}

function readSettings() {
  return popup.evaluate((keys) => chrome.storage.local.get(keys), storageKeys);
}

function singleShortcut(shortcutKey, skipSeconds, enabled = true) {
  return { enabled, shortcuts: [{ shortcutKey, skipSeconds }] };
}

async function assignKey(key, row = 0) {
  const button = popup.locator('.shortcut-key').nth(row);
  await button.click();
  await button.press(key.toLowerCase());
}

async function setDuration(minutes, seconds, row = 0) {
  await popup.locator('.minutes').nth(row).fill(String(minutes));
  await popup.locator('.seconds').nth(row).fill(String(seconds));
}

async function saveSettings(expected) {
  await popup.locator('#save').click();
  await popup.waitForFunction(async (settings) => {
    const actual = await chrome.storage.local.get(Object.keys(settings));
    return Object.keys(settings).every((key) => JSON.stringify(settings[key]) === JSON.stringify(actual[key]));
  }, expected);
  assert.deepEqual(await readSettings(), expected);
  await popup.locator('#feedback[data-kind="success"]').waitFor();
}

async function openFixture(layout = 'main') {
  await page.bringToFront();
  await page.goto(`${fixtures.url}?layout=${layout}`);
  await page.locator('#fixture-target').focus();
  await page.waitForLoadState('networkidle');
}

async function setTime(frame, selector, seconds) {
  const video = frame.locator(selector);
  await frame.waitForFunction((target) => document.querySelector(target)?.seekable.length > 0, selector);
  await video.evaluate((element, time) => {
    element.pause();
    if (!element.hasAttribute('data-seeks')) {
      element.dataset.seeks = '0';
      element.addEventListener('seeked', () => {
        element.dataset.seeks = String(Number(element.dataset.seeks) + 1);
      });
    }
    element.currentTime = time;
  }, seconds);
  await waitForTime(frame, selector, seconds, 0.05);
}

async function waitForTime(frame, selector, time, tolerance = 0.15) {
  await frame.waitForFunction(({ selector, time, tolerance }) => {
    const video = document.querySelector(selector);
    return video && !video.seeking && Math.abs(video.currentTime - time) <= tolerance;
  }, { selector, time, tolerance });
}

function state(frame, selector = '#primary') {
  return frame.locator(selector).evaluate((video) => ({
    time: video.currentTime,
    paused: video.paused,
    rate: video.playbackRate,
    seeks: Number(video.dataset.seeks),
  }));
}

async function press(key = 's') {
  await page.bringToFront();
  await page.keyboard.press(key);
}

async function seeOverlay(frame, label) {
  await frame.locator(overlay).waitFor({ state: 'visible' });
  assert.equal(await frame.locator(overlay).count(), 1);
  await frame.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  // DevTools exposes closed shadow trees for inspection in the test browser.
  let session;
  try {
    session = await browserContext.newCDPSession(frame);
  } catch (error) {
    if (!String(error).includes('does not have a separate CDP session')) throw error;
    session = await browserContext.newCDPSession(page);
  }
  try {
    const { root } = await session.send('DOM.getDocument', { depth: -1, pierce: true });
    function hasOverlayText(node, expected, insideOverlay = false) {
      const isOverlay = insideOverlay || node.attributes?.includes('data-skip90-overlay');
      return (isOverlay && node.nodeValue.includes(expected)) ||
        [...(node.children || []), ...(node.shadowRoots || []), ...(node.contentDocument ? [node.contentDocument] : [])]
          .some((child) => hasOverlayText(child, expected, isOverlay));
    }
    assert.ok(hasOverlayText(root, label), `Expected a visible overlay containing ${label}`);
    assert.ok(hasOverlayText(root, 'Next'), 'Expected the Next label in the skip overlay');
  } finally {
    await session.detach();
  }
}

async function screenshot(name, target = page) {
  const path = artifacts && join(artifacts, name);
  return target.screenshot(path ? { path } : {});
}

async function verifyOverlayPixels(before, after, box) {
  const badgeRegion = {
    x: box.x + box.width * 0.55,
    y: box.y + box.height * 0.2,
    width: box.width * 0.43,
    height: box.height * 0.6,
  };
  const changes = await page.evaluate(async ({ before, after, box }) => {
    async function crop(base64) {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(box.width);
      canvas.height = Math.ceil(box.height);
      const context = canvas.getContext('2d');
      context.drawImage(image, -Math.floor(box.x), -Math.floor(box.y));
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    }
    const [oldPixels, newPixels] = await Promise.all([crop(before), crop(after)]);
    let newlyBright = 0;
    for (let index = 0; index < oldPixels.length; index += 4) {
      const wasDark = Math.max(oldPixels[index], oldPixels[index + 1], oldPixels[index + 2]) < 180;
      const isBright = Math.min(newPixels[index], newPixels[index + 1], newPixels[index + 2]) > 220;
      if (wasDark && isBright) newlyBright += 1;
    }
    return newlyBright;
  }, { before: before.toString('base64'), after: after.toString('base64'), box: badgeRegion });
  assert.ok(changes > 20, `Expected rendered text on the right side of the video, found ${changes} newly bright pixels`);
}

async function verifyOverlayBounds(frame) {
  await frame.waitForFunction(() => {
    const video = document.querySelector('#primary')?.getBoundingClientRect();
    const host = document.querySelector('[data-skip90-overlay]');
    if (!video || !host) return false;
    const actual = host.getBoundingClientRect();
    const left = Math.max(0, video.left);
    const top = Math.max(0, video.top);
    const right = Math.min(innerWidth, video.right);
    const bottom = Math.min(innerHeight, video.bottom);
    return Math.abs(actual.left - left) < 1 && Math.abs(actual.top - top) < 1 &&
      Math.abs(actual.right - right) < 1 && Math.abs(actual.bottom - bottom) < 1;
  });
}

try {
  if (artifacts) await mkdir(artifacts, { recursive: true });
  browserContext = await launch();
  console.log(`Chrome ${browserContext.browser().version()}`);
  extensionId = await loadUnpacked();
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  page = browserContext.pages()[0];
  popup = await browserContext.newPage();
  // Persistent contexts share viewport defaults, so size the popup test tab explicitly.
  await popup.setViewportSize({ width: 320, height: 460 });
  const popupNetwork = [];
  popup.on('request', (request) => {
    if (/^https?:/.test(request.url())) popupNetwork.push(request.url());
  });
  await popup.goto(popupUrl);
  await popup.locator('#save').waitFor();

  await check('first install defaults, popup fit and local resources', async () => {
    await popup.waitForFunction(async () => (await chrome.storage.local.get('shortcuts')).shortcuts?.[0]?.skipSeconds === 90);
    assert.deepEqual(await readSettings(), defaults);
    assert.equal(await popup.locator('#enabled').isChecked(), true);
    assert.equal(Number(await popup.locator('.minutes').inputValue()), 1);
    assert.equal(Number(await popup.locator('.seconds').inputValue()), 30);
    assert.equal(await popup.locator('.shortcut-key').textContent(), 'S');
    assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth), 320);
    await popup.evaluate(() => document.fonts.ready);
    assert.deepEqual(popupNetwork, []);
    await screenshot('popup.png', popup.locator('main'));
  });

  await check('Chrome opens the configured toolbar popup', async () => {
    await openFixture();
    const session = await browserContext.browser().newBrowserCDPSession();
    try {
      const before = new Set((await session.send('Target.getTargets')).targetInfos.map((target) => target.targetId));
      await popup.evaluate(() => chrome.action.openPopup());
      const { targetInfos } = await session.send('Target.getTargets');
      const target = targetInfos.find(({ targetId, url }) => !before.has(targetId) && url === popupUrl);
      assert.ok(target, 'Chrome did not create a toolbar popup for popup.html');
      await session.send('Target.closeTarget', { targetId: target.targetId });
    } finally {
      await session.detach();
    }
  });

  await check('invalid seconds, zero total, and unassigned keys are rejected', async () => {
    const minutes = popup.locator('.minutes');
    const seconds = popup.locator('.seconds');
    const save = popup.locator('#save');
    await seconds.fill('60');
    await save.click();
    assert.equal(await seconds.getAttribute('aria-invalid'), 'true');
    assert.deepEqual(await readSettings(), defaults);
    await minutes.fill('0');
    await seconds.fill('0');
    await save.click();
    assert.ok(await popup.locator('[aria-invalid="true"]').count() > 0);
    assert.deepEqual(await readSettings(), defaults);
    await setDuration(1, 30);
    await popup.locator('#add-shortcut').click();
    await setDuration(0, 10, 1);
    const shortcut = popup.locator('.shortcut-key').nth(1);
    await shortcut.click();
    await shortcut.press('1');
    await shortcut.press('Escape');
    await save.click();
    assert.equal(await shortcut.getAttribute('aria-invalid'), 'true');
    assert.equal(await shortcut.evaluate((button) => button === document.activeElement), true);
    assert.deepEqual(await readSettings(), defaults);
    await popup.reload();
  });

  await check('90 seconds on a paused video, confirmed overlay, and unchanged playback rate', async () => {
    await openFixture();
    await setTime(page, '#primary', 200);
    await page.locator('#primary').evaluate((video) => { video.playbackRate = 1.25; });
    const before = await state(page);
    const beforeImage = await page.screenshot();
    await press();
    await waitForTime(page, '#primary', 290);
    assert.equal(await page.evaluate(() => fixture.keys.at(-1).prevented), true);
    assert.deepEqual(await state(page), { time: 290, paused: true, rate: 1.25, seeks: before.seeks + 1 });
    await seeOverlay(page, '+1:30');
    await verifyOverlayBounds(page);
    const videoBox = await page.locator(overlay).boundingBox();
    await delay(180);
    await verifyOverlayPixels(beforeImage, await screenshot('skip-overlay.png'), videoBox);
    assert.equal(await page.locator('#primary').evaluate((video) => {
      const { left, top, width, height } = video.getBoundingClientRect();
      return document.elementFromPoint(left + width * 0.75, top + height * 0.5) === video;
    }), true);
    await page.locator('#primary').evaluate((video) => { video.style.translate = '24px 0'; });
    await verifyOverlayBounds(page);
    await page.locator(overlay).waitFor({ state: 'hidden' });
  });

  await check('keyboard navigation, manual 1:40, shortcut A, and live settings update', async () => {
    await openFixture();
    await setTime(page, '#primary', 200);
    await popup.bringToFront();
    await popup.keyboard.press('Tab');
    assert.equal(await popup.evaluate(() => document.activeElement.id), 'enabled');
    await setDuration(1, 40);
    await assignKey('A');
    await saveSettings(singleShortcut('A', 100));
    await press('s');
    await delay(500);
    await waitForTime(page, '#primary', 200, 0.05);
    await press('a');
    await waitForTime(page, '#primary', 300);
    await seeOverlay(page, '+1:40');
  });

  await check('extension disabled takes effect immediately and leaves the key unconsumed', async () => {
    await setTime(page, '#primary', 200);
    await popup.locator('#enabled').uncheck();
    await saveSettings(singleShortcut('A', 100, false));
    await press('a');
    await delay(500);
    await waitForTime(page, '#primary', 200, 0.05);
    assert.equal(await page.evaluate(() => fixture.keys.at(-1).prevented), false);
  });

  await check('1:00 skips exactly 60 seconds and 40 seconds near the end', async () => {
    await popup.locator('#enabled').check();
    await assignKey('S');
    await setDuration(1, 0);
    await saveSettings(singleShortcut('S', 60));
    await openFixture();
    await setTime(page, '#primary', 200);
    await press();
    await waitForTime(page, '#primary', 260);
    await seeOverlay(page, '+1:00');
    await page.locator(overlay).waitFor({ state: 'hidden' });
    await setTime(page, '#primary', 320);
    await press();
    await waitForTime(page, '#primary', 360);
    await seeOverlay(page, '+0:40');
  });

  await check('multiple keys use independent durations, reject duplicates, and can be removed', async () => {
    await openFixture();
    await setTime(page, '#primary', 200);
    await setDuration(0, 10);
    await assignKey('A');
    await popup.locator('#add-shortcut').click();
    await setDuration(0, 20, 1);
    await assignKey('A', 1);
    assert.match(await popup.locator('#feedback').textContent(), /already assigned/);
    await popup.locator('.shortcut-key').nth(1).press('b');
    await popup.locator('#add-shortcut').click();
    await setDuration(0, 30, 2);
    await assignKey('C', 2);
    const shortcuts = [
      { shortcutKey: 'A', skipSeconds: 10 },
      { shortcutKey: 'B', skipSeconds: 20 },
      { shortcutKey: 'C', skipSeconds: 30 },
    ];
    await saveSettings({ enabled: true, shortcuts });
    await screenshot('popup-shortcuts.png', popup.locator('main'));
    for (const [key, target, overlayText] of [['a', 210, '+0:10'], ['b', 230, '+0:20'], ['c', 260, '+0:30']]) {
      await press(key);
      await waitForTime(page, '#primary', target);
      await seeOverlay(page, overlayText);
    }
    await popup.locator('.remove').nth(1).click();
    await saveSettings({ enabled: true, shortcuts: [shortcuts[0], shortcuts[2]] });
    await press('b');
    assert.equal(await page.evaluate(() => fixture.keys.at(-1).prevented), false);
    await waitForTime(page, '#primary', 260, 0.05);
    await popup.locator('.remove').nth(1).click();
    await popup.locator('.remove').click();
    await saveSettings({ enabled: true, shortcuts: [] });
    await popup.reload();
    await popup.locator('#empty-list').waitFor();
    assert.equal(await popup.locator('.shortcut-row').count(), 0);
  });

  await check('the old single shortcut loads and works before saving the new format', async () => {
    await popup.evaluate(async () => {
      await chrome.storage.local.set({ enabled: true, shortcutKey: 'D', skipSeconds: 25 });
      await chrome.storage.local.remove('shortcuts');
    });
    await popup.reload();
    await popup.waitForFunction(() => document.querySelector('.shortcut-key')?.textContent === 'D');
    assert.equal(await popup.locator('.seconds').inputValue(), '25');
    await openFixture();
    await setTime(page, '#primary', 200);
    await press('d');
    await waitForTime(page, '#primary', 225);
    await saveSettings(singleShortcut('D', 25));
  });

  await assignKey('S');
  await setDuration(1, 30);
  await saveSettings(defaults);

  await check('live MediaSource with infinite duration seeks within its DVR range', async () => {
    await openFixture();
    const video = page.locator('#primary');
    await video.evaluate(async (element) => {
      const media = new MediaSource();
      const data = await fetch('sample.webm').then((response) => response.arrayBuffer());
      await new Promise((resolve) => {
        media.addEventListener('sourceopen', resolve, { once: true });
        element.src = URL.createObjectURL(media);
      });
      const source = media.addSourceBuffer('video/webm; codecs="vp9"');
      media.duration = Infinity;
      await new Promise((resolve, reject) => {
        source.addEventListener('updateend', resolve, { once: true });
        source.addEventListener('error', reject, { once: true });
        source.appendBuffer(data);
      });
      media.setLiveSeekableRange(20, 360);
    });
    await setTime(page, '#primary', 200);
    assert.equal(await video.evaluate((element) => element.duration), Infinity);
    await press();
    await waitForTime(page, '#primary', 290);
    await seeOverlay(page, '+1:30');
  });

  for (const [layout, crossOrigin] of [['same', false], ['cross', true], ['srcdoc', false]]) {
    await check(`${layout} iframe receives the shortcut and confirms the seek`, async () => {
      await openFixture(layout);
      const frame = await page.locator('#frame').elementHandle().then((element) => element.contentFrame());
      if (layout !== 'srcdoc') assert.equal(new URL(frame.url()).origin !== new URL(page.url()).origin, crossOrigin);
      await setTime(frame, '#primary', 30);
      if (layout === 'srcdoc') await frame.locator('#primary').focus();
      else await frame.locator('#fixture-target').focus();
      await press();
      await waitForTime(frame, '#primary', 120);
      await seeOverlay(frame, '+1:30');
      assert.equal(await page.locator(overlay).count(), 0);
    });
  }

  await check('invisible and offscreen cross-origin frames are excluded', async () => {
    await openFixture('cross');
    const frameElement = page.locator('#frame');
    const frame = await frameElement.elementHandle().then((element) => element.contentFrame());
    await setTime(frame, '#primary', 30);
    const before = await state(frame);
    for (const [property, value] of [['opacity', '0'], ['visibility', 'hidden'], ['display', 'none'], ['margin-top', '2000px']]) {
      await frameElement.evaluate((element, [property, value]) => {
        element.removeAttribute('style');
        element.style.setProperty(property, value);
      }, [property, value]);
      await press();
      await delay(450);
      assert.deepEqual(await state(frame), before, `${property}: ${value}`);
      assert.equal(await frame.locator(overlay).isVisible(), false, `${property}: ${value}`);
    }
    await frameElement.evaluate((element) => element.removeAttribute('style'));
    await press();
    await waitForTime(frame, '#primary', 120);
    await seeOverlay(frame, '+1:30');
  });

  await check('two playing videos: larger wins, then a recent overlay interaction overrides area', async () => {
    await openFixture('pair');
    await setTime(page, '#primary', 10);
    await setTime(page, '#secondary', 40);
    await page.locator('video').evaluateAll((videos) => Promise.all(videos.map((video) => video.play())));
    const primary = await state(page);
    const secondary = await state(page, '#secondary');
    await press();
    await waitForTime(page, '#primary', primary.time + 90, 1.5);
    assert.equal((await state(page)).seeks, primary.seeks + 1);
    assert.equal((await state(page)).paused, false);
    assert.equal((await state(page, '#secondary')).seeks, secondary.seeks);
    await page.locator('#secondary-player .overlay-control').click();
    const afterInteraction = await state(page, '#secondary');
    await press();
    await waitForTime(page, '#secondary', afterInteraction.time + 90, 1.5);
    assert.equal((await state(page)).seeks, primary.seeks + 1);
    assert.equal((await state(page, '#secondary')).seeks, secondary.seeks + 1);
  });

  await check('fullscreen cross-origin frame wins across all frames and renders its container overlay', async () => {
    await openFixture('frames');
    const same = await page.locator('#same-frame').elementHandle().then((element) => element.contentFrame());
    const cross = await page.locator('#cross-frame').elementHandle().then((element) => element.contentFrame());
    await setTime(page, '#primary', 10);
    await setTime(same, '#primary', 10);
    await setTime(cross, '#primary', 10);
    await same.locator('.overlay-control').click();
    await cross.locator('.container-fullscreen').click();
    await cross.waitForFunction(() => document.fullscreenElement?.id === 'primary-player');
    const before = await page.screenshot();
    await press();
    await waitForTime(cross, '#primary', 100);
    await seeOverlay(cross, '+1:30');
    await verifyOverlayBounds(cross);
    assert.equal(await cross.locator(`#primary-player ${overlay}`).count(), 1);
    const box = await cross.locator(overlay).boundingBox();
    await delay(180);
    await verifyOverlayPixels(before, await screenshot('fullscreen-container.png'), box);
    await waitForTime(page, '#primary', 10, 0.05);
    await waitForTime(same, '#primary', 10, 0.05);
    await cross.evaluate(() => document.exitFullscreen());
  });

  await check('fullscreen video element renders the confirmation over the video', async () => {
    await openFixture();
    await setTime(page, '#primary', 10);
    await page.locator('.video-fullscreen').click();
    await page.waitForFunction(() => document.fullscreenElement?.localName === 'video');
    const before = await page.screenshot();
    await press();
    await waitForTime(page, '#primary', 100);
    await seeOverlay(page, '+1:30');
    await verifyOverlayBounds(page);
    const box = await page.locator(overlay).boundingBox();
    await delay(180);
    await verifyOverlayPixels(before, await screenshot('fullscreen-video.png'), box);
    await page.evaluate(() => document.exitFullscreen());
  });

  await check('typing, shadow inputs, IME, modifiers and repeated keydown are ignored', async () => {
    await openFixture();
    await setTime(page, '#primary', 10);
    for (const selector of ['#text-input', '#textarea', '#select', '#editable', '#textbox', '#shadow-input']) {
      await page.locator(selector).focus();
      await press();
      assert.equal(await page.evaluate(() => fixture.keys.at(-1).prevented), false, selector);
    }
    await page.evaluate(() => fixture.focusClosedInput());
    await press();
    assert.equal(await page.evaluate(() => fixture.keys.at(-1).prevented), false, 'closed shadow input');
    await page.locator('#fixture-target').focus();
    for (const key of ['Control+s', 'Alt+s', 'Meta+s', 'Shift+s']) {
      await press(key);
      assert.equal(await page.evaluate(() => fixture.keys.at(-1).prevented), false, key);
    }
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 's', bubbles: true, cancelable: true, composed: true,
    })));
    assert.equal(await page.evaluate(() => fixture.keys.at(-1).prevented), false, 'untrusted key');
    const cdp = await browserContext.newCDPSession(page);
    try {
      await page.locator('#text-input').focus();
      await cdp.send('Input.imeSetComposition', { text: 's', selectionStart: 1, selectionEnd: 1 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 's', code: 'KeyS', windowsVirtualKeyCode: 83 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 's', code: 'KeyS', windowsVirtualKeyCode: 83 });
      assert.equal(await page.evaluate(() => fixture.keys.at(-1).isComposing), true);
      assert.equal(await page.evaluate(() => fixture.keys.at(-1).prevented), false);
      await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
      await page.locator('#fixture-target').focus();
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 's', code: 'KeyS', windowsVirtualKeyCode: 229 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 's', code: 'KeyS', windowsVirtualKeyCode: 229 });
      assert.equal(await page.evaluate(() => fixture.keys.at(-1).keyCode), 229);
      assert.equal(await page.evaluate(() => fixture.keys.at(-1).prevented), false);
    } finally {
      await cdp.detach();
    }
    await delay(500);
    await waitForTime(page, '#primary', 10, 0.05);
    const before = await state(page);
    await page.keyboard.down('s');
    await page.keyboard.down('s');
    await page.keyboard.up('s');
    assert.equal(await page.evaluate(() => fixture.keys.at(-1).repeat), true);
    assert.equal(await page.evaluate(() => fixture.keys.at(-1).prevented), false);
    await waitForTime(page, '#primary', 100);
    await delay(350);
    assert.equal((await state(page)).seeks, before.seeks + 1);
  });

  await check('rapid distinct shortcut presses share the tab lock', async () => {
    await openFixture();
    await setTime(page, '#primary', 10);
    const before = await state(page);
    await page.keyboard.press('s');
    await page.keyboard.press('s');
    await page.keyboard.press('s');
    await waitForTime(page, '#primary', 100);
    await delay(300);
    assert.equal((await state(page)).seeks, before.seeks + 1);
  });

  await check('hidden video and video without metadata do not seek or show an overlay', async () => {
    await openFixture('pair');
    await setTime(page, '#primary', 10);
    await setTime(page, '#secondary', 10);
    await page.locator('#primary').evaluate((video) => { video.style.visibility = 'hidden'; });
    await page.locator('#secondary').evaluate((video) => {
      video.removeAttribute('src');
      video.load();
    });
    await press();
    await delay(500);
    assert.equal(await page.locator('#secondary').evaluate((video) => video.seekable.length), 0);
    await waitForTime(page, '#primary', 10, 0.05);
    assert.equal(await page.locator(overlay).isVisible(), false);
  });

  await check('player replacement during discovery ignores the old video and handles the next press', async () => {
    await openFixture();
    await setTime(page, '#primary', 10);
    await page.evaluate(() => {
      window.addEventListener('keydown', () => {
        setTimeout(() => { window.removedVideo = fixture.replaceVideo('primary'); }, 120);
      }, { once: true });
    });
    await press();
    await delay(500);
    assert.equal(await page.evaluate(() => removedVideo.currentTime), 10);
    assert.equal(await page.locator(overlay).isVisible(), false);
    await setTime(page, '#primary', 20);
    await press();
    await waitForTime(page, '#primary', 110);
    await seeOverlay(page, '+1:30');
  });

  await check('a resource change during seeking produces no confirmation overlay', async () => {
    await openFixture();
    await setTime(page, '#primary', 10);
    await page.locator('#primary').evaluate((video) => {
      video.addEventListener('seeking', () => {
        video.dataset.interrupted = 'true';
        video.removeAttribute('src');
        video.load();
      }, { once: true });
    });
    await press();
    await page.locator('#primary[data-interrupted="true"]').waitFor();
    await delay(500);
    assert.equal(await page.locator(overlay).isVisible(), false);
  });

  await check('local settings persist after Chrome restart and DevTools reattachment', async () => {
    await setDuration(2, 0);
    await popup.locator('#add-shortcut').click();
    await setDuration(0, 10, 1);
    await assignKey('A', 1);
    const saved = { enabled: true, shortcuts: [
      { shortcutKey: 'S', skipSeconds: 120 },
      { shortcutKey: 'A', skipSeconds: 10 },
    ] };
    await saveSettings(saved);
    await browserContext.close();
    browserContext = await launch();
    // Chrome clears DevTools-loaded extension registrations at startup. Local
    // storage must still be present after reattaching the same unpacked build.
    assert.equal(await loadUnpacked(), extensionId);
    popup = await browserContext.newPage();
    await popup.goto(popupUrl);
    assert.deepEqual(await readSettings(), saved);
    assert.equal(Number(await popup.locator('.minutes').first().inputValue()), 2);
    assert.deepEqual(await popup.locator('.shortcut-key').allTextContents(), ['S', 'A']);
  });
} finally {
  await browserContext?.close();
  await fixtures.close();
  const resolvedProfile = await realpath(profile);
  if (dirname(resolvedProfile) === stableTemp && basename(resolvedProfile).startsWith('skip90-test-')) {
    await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  }
}

console.log(`${results.filter(Boolean).length}/${results.length} browser checks passed`);
if (results.includes(false)) process.exitCode = 1;

