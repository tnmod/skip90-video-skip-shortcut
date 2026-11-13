const playerList = document.querySelector('#players');
const playerTemplate = document.querySelector('#player-template');
const layout = new URLSearchParams(location.search).get('layout') || 'main';

const keys = [];
window.addEventListener('keydown', (event) => {
  keys.push({
    key: event.key,
    repeat: event.repeat,
    isComposing: event.isComposing,
    keyCode: event.keyCode,
    prevented: event.defaultPrevented,
  });
});

function makeVideo(id) {
  const video = playerTemplate.content.querySelector('video').cloneNode(true);
  video.id = id;
  video.dataset.seeks = '0';
  video.addEventListener('seeked', () => {
    video.dataset.seeks = String(Number(video.dataset.seeks) + 1);
  });
  return video;
}

function addPlayer(id, size = '') {
  const player = playerTemplate.content.querySelector('.player').cloneNode(true);
  player.id = `${id}-player`;
  if (size) player.classList.add(size);
  player.querySelector('video').replaceWith(makeVideo(id));
  player.querySelector('.container-fullscreen').addEventListener('click', () => player.requestFullscreen());
  player.querySelector('.video-fullscreen').addEventListener('click', () => player.querySelector('video').requestFullscreen());
  playerList.append(player);
}

function addFrame(id, kind) {
  const frame = document.createElement('iframe');
  frame.id = id;
  frame.title = `${kind} video frame`;
  frame.allowFullscreen = true;
  if (kind === 'srcdoc') {
    frame.srcdoc = `<!doctype html><html lang="en"><title>Srcdoc video</title>
      <video id="primary" width="352" height="198" src="sample.webm" preload="auto" controls muted playsinline></video></html>`;
  } else {
    const url = new URL('?layout=child', location.href);
    if (kind === 'cross-origin') url.hostname = location.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1';
    frame.src = url;
  }
  playerList.append(frame);
}

const shadowEditor = document.querySelector('#shadow-editor').attachShadow({ mode: 'open' });
const shadowInput = document.createElement('input');
shadowInput.id = 'shadow-input';
shadowInput.setAttribute('aria-label', 'Shadow input');
shadowEditor.append(shadowInput);
const closedShadow = document.querySelector('#closed-shadow-editor').attachShadow({ mode: 'closed' });
const closedInput = document.createElement('input');
closedInput.setAttribute('aria-label', 'Closed shadow input');
closedShadow.append(closedInput);

if (layout === 'child') {
  document.body.classList.add('child');
  addPlayer('primary');
} else if (layout === 'same' || layout === 'cross') {
  addFrame('frame', layout === 'same' ? 'same-origin' : 'cross-origin');
} else if (layout === 'srcdoc') {
  addFrame('frame', 'srcdoc');
} else if (layout === 'frames') {
  addPlayer('primary', 'small');
  addFrame('same-frame', 'same-origin');
  addFrame('cross-frame', 'cross-origin');
} else {
  addPlayer('primary');
  if (layout === 'pair') addPlayer('secondary', 'small');
}

window.fixture = {
  keys,
  focusClosedInput() {
    closedInput.focus();
  },
  replaceVideo(id) {
    const current = document.getElementById(id);
    current.replaceWith(makeVideo(id));
    return current;
  },
};
