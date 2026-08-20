const SUPABASE_URL = 'https://bshkvgdebluhmuxjpbiw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tV6ipeRw37DyNTm2iBl17Q_YmaLScc_';
const STORAGE_BUCKET = 'board-images';
const TEST_BOARD = 'segl-test';
const MAX_THING_BYTES = 25 * 1024 * 1024;

let seglActive = false;
let poki = [];
const initState = browser.storage.local.get(['seglActive', 'pokiItems']).then(saved => {
  seglActive = !!saved.seglActive;
  poki = Array.isArray(saved.pokiItems) ? saved.pokiItems : [];
}).catch(() => {
  seglActive = false;
  poki = [];
});

initState.then(() => syncBadge());

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message?.type) return undefined;

  switch (message.type) {
    case 'segl-status':
      return withState(async () => ({ ok: true, active: seglActive }));
    case 'segl-set-global-active':
      return withState(async () => {
        await setGlobalActive(!!message.active);
        return { ok: true, active: seglActive, count: poki.length };
      });
    case 'segl-toggle-global-active':
      return withState(async () => {
        await setGlobalActive(!seglActive);
        return { ok: true, active: seglActive, count: poki.length };
      });
    case 'segl-image':
      return withState(async () => addImageToPoki(message, sender));
    case 'segl-text':
      return withState(async () => addTextToPoki(message));
    case 'poki-list':
      return withState(async () => ({ ok: true, active: seglActive, count: poki.length, items: publicPoki() }));
    case 'poki-remove':
      return withState(async () => removeFromPoki(message.id));
    case 'poki-clear':
      return withState(async () => clearPoki());
    case 'poki-keep':
      return withState(async () => keepPoki(TEST_BOARD));
    default:
      return undefined;
  }
});

browser.tabs.onRemoved.addListener(async () => {
  await withState(async () => purgeDeadCaptureContexts());
});

async function withState(fn) {
  await initState;
  return fn();
}

async function setGlobalActive(next) {
  seglActive = !!next;
  await persistState();
  await broadcastSeglState();
  await syncBadge();
  await notifyPopup();
}

async function addImageToPoki(message, sender) {
  const candidates = normalizeCandidates(message.candidates);
  const item = {
    id: crypto.randomUUID(),
    type: 'image',
    pageUrl: message.pageUrl || '',
    pageTitle: message.pageTitle || '',
    candidates,
    naturalWidth: Number(message.naturalWidth) || 0,
    naturalHeight: Number(message.naturalHeight) || 0,
    viewportWidth: Number(message.viewportWidth) || 0,
    viewportHeight: Number(message.viewportHeight) || 0,
    rect: normalizeRect(message.rect),
    tabId: sender.tab?.id ?? null,
    windowId: sender.tab?.windowId ?? null,
    createdAt: Date.now()
  };
  poki.push(item);
  await persistState();
  await syncBadge();
  await notifyPopup();
  return { ok: true, gathered: true, id: item.id, count: poki.length };
}

async function addTextToPoki(message) {
  const text = String(message.text || '').trim();
  if (!text) return { ok: false, reason: 'empty text' };
  const item = {
    id: crypto.randomUUID(),
    type: 'text',
    text,
    pageUrl: message.pageUrl || '',
    pageTitle: message.pageTitle || '',
    createdAt: Date.now()
  };
  poki.push(item);
  await persistState();
  await syncBadge();
  await notifyPopup();
  return { ok: true, gathered: true, id: item.id, count: poki.length };
}

async function removeFromPoki(id) {
  const before = poki.length;
  poki = poki.filter(item => item.id !== id);
  if (poki.length !== before) {
    await persistState();
    await syncBadge();
    await notifyPopup();
  }
  return { ok: true, active: seglActive, count: poki.length, items: publicPoki() };
}

async function clearPoki() {
  if (poki.length) {
    poki = [];
    await persistState();
    await syncBadge();
    await notifyPopup();
  }
  return { ok: true, active: seglActive, count: poki.length, items: publicPoki() };
}

async function keepPoki(board) {
  const keptIds = [];
  const failures = [];

  for (const item of [...poki]) {
    try {
      if (item.type === 'text') {
        await keepTextItem(item, board);
      } else if (item.type === 'image') {
        await keepImageItem(item, board);
      }
      keptIds.push(item.id);
    } catch (error) {
      failures.push({ id: item.id, type: item.type, message: error?.message || 'keep failed' });
    }
  }

  if (keptIds.length) {
    poki = poki.filter(item => !keptIds.includes(item.id));
    await persistState();
    await syncBadge();
    await notifyPopup();
  }

  return {
    ok: failures.length === 0,
    kept: keptIds.length,
    remaining: poki.length,
    failures,
    active: seglActive,
    count: poki.length,
    items: publicPoki()
  };
}

async function keepTextItem(item, board) {
  const slot = placementSlot();
  const row = {
    id: crypto.randomUUID(),
    board,
    type: 'note',
    src: /^https?:/i.test(item.pageUrl || '') ? item.pageUrl : null,
    storage_path: null,
    text: item.text,
    x: slot.x,
    y: slot.y,
    width: 360,
    height: Math.max(110, Math.min(360, 80 + Math.ceil(String(item.text || '').length / 45) * 22)),
    grayscale: 0,
    z: zNow()
  };
  await insertBoardRow(row);
}

async function keepImageItem(item, board) {
  let acquired = null;
  for (const candidate of normalizeCandidates(item.candidates)) {
    try {
      acquired = await retrieveImage(candidate.url);
      acquired.sourceUrl = candidate.url;
      break;
    } catch (_) {}
  }

  if (!acquired) {
    acquired = await captureStoredImage(item);
  }

  if (!acquired?.blob || acquired.blob.size === 0 || acquired.blob.size > MAX_THING_BYTES) {
    throw new Error('unharvestable');
  }

  const measured = await measureBlob(acquired.blob).catch(() => null);
  const width = measured?.width || acquired.width || item.naturalWidth || item.rect?.width || 300;
  const height = measured?.height || acquired.height || item.naturalHeight || item.rect?.height || 200;
  const filename = acquired.filename || filenameFromUrl(acquired.sourceUrl, acquired.blob.type);

  await persistImage({
    blob: acquired.blob,
    filename,
    mime: acquired.blob.type || 'image/png',
    width,
    height,
    sourceUrl: acquired.sourceUrl || '',
    pageUrl: item.pageUrl || '',
    board,
    acquisition: acquired.method
  });
}

async function broadcastSeglState() {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map(tab => tab?.id ? browser.tabs.sendMessage(tab.id, { type: 'segl-set-active', active: seglActive }).catch(() => {}) : Promise.resolve()));
}

async function notifyPopup() {
  await browser.runtime.sendMessage({ type: 'poki-changed', active: seglActive, count: poki.length }).catch(() => {});
}

async function persistState() {
  await browser.storage.local.set({ seglActive, pokiItems: poki });
}

function publicPoki() {
  return poki.map(item => item.type === 'text'
    ? { id: item.id, type: 'text', text: item.text, pageUrl: item.pageUrl, pageTitle: item.pageTitle, createdAt: item.createdAt }
    : { id: item.id, type: 'image', pageUrl: item.pageUrl, pageTitle: item.pageTitle, naturalWidth: item.naturalWidth, naturalHeight: item.naturalHeight, candidateCount: Array.isArray(item.candidates) ? item.candidates.length : 0, createdAt: item.createdAt }
  );
}

async function syncBadge() {
  const text = poki.length ? String(Math.min(poki.length, 99)) : '';
  await browser.browserAction.setBadgeBackgroundColor({ color: seglActive ? '#e00000' : '#4a4a4a' }).catch(() => {});
  await browser.browserAction.setBadgeText({ text }).catch(() => {});
  const title = seglActive
    ? (poki.length ? `Eskja · Segl on · Poki ${poki.length}` : 'Eskja · Segl on · Poki empty')
    : (poki.length ? `Eskja · Segl off · Poki ${poki.length}` : 'Eskja · Segl off · Poki empty');
  await browser.browserAction.setTitle({ title }).catch(() => {});
}

function normalizeCandidates(rawCandidates) {
  const unique = new Map();
  for (const raw of Array.isArray(rawCandidates) ? rawCandidates : []) {
    if (!raw?.url || !/^https?:/i.test(raw.url)) continue;
    const candidate = {
      url: raw.url,
      declaredWidth: Number(raw.declaredWidth) || 0,
      density: Number(raw.density) || 0,
      priority: Number(raw.priority) || 0,
      source: raw.source || 'unknown'
    };
    const old = unique.get(candidate.url);
    if (!old || candidateScore(candidate) > candidateScore(old)) unique.set(candidate.url, candidate);
  }
  return [...unique.values()].sort((a, b) => candidateScore(b) - candidateScore(a));
}

function candidateScore(candidate) {
  return (candidate.priority || 0) * 1000000000 + (candidate.declaredWidth || 0) * 1000 + (candidate.density || 0);
}

function normalizeRect(rect) {
  if (!rect || typeof rect !== 'object') return null;
  return {
    left: Math.max(0, Number(rect.left) || 0),
    top: Math.max(0, Number(rect.top) || 0),
    width: Math.max(1, Number(rect.width) || 1),
    height: Math.max(1, Number(rect.height) || 1)
  };
}

async function purgeDeadCaptureContexts() {
  let changed = false;
  for (const item of poki) {
    if (item.type !== 'image' || !item.tabId) continue;
    try {
      await browser.tabs.get(item.tabId);
    } catch (_) {
      item.tabId = null;
      item.windowId = null;
      changed = true;
    }
  }
  if (changed) {
    await persistState();
    await notifyPopup();
  }
}

async function retrieveImage(url) {
  if (!/^https?:/i.test(url)) throw new Error('Image has no retrievable URL');
  const response = await fetch(url, { credentials: 'include', cache: 'force-cache' });
  if (!response.ok) throw new Error(`Image request failed (${response.status})`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Resource is not an image');
  if (blob.size > MAX_THING_BYTES) throw new Error('Image is too large');
  return { blob, method: 'resource', filename: filenameFromResponse(response, url, blob.type) };
}

async function captureStoredImage(item) {
  if (!item?.windowId || !item?.tabId || !item?.rect) throw new Error('capture fallback unavailable');
  let tab;
  try {
    tab = await browser.tabs.get(item.tabId);
  } catch (_) {
    throw new Error('capture fallback unavailable');
  }
  if (!tab.active || tab.windowId !== item.windowId) throw new Error('capture fallback unavailable');

  const screenshot = await browser.tabs.captureVisibleTab(item.windowId, { format: 'png' });
  const image = await loadImage(screenshot);
  const viewportWidth = Math.max(1, Number(item.viewportWidth) || image.naturalWidth);
  const viewportHeight = Math.max(1, Number(item.viewportHeight) || image.naturalHeight);
  const scaleX = image.naturalWidth / viewportWidth;
  const scaleY = image.naturalHeight / viewportHeight;
  const rect = item.rect;
  const sx = Math.max(0, Math.round(rect.left * scaleX));
  const sy = Math.max(0, Math.round(rect.top * scaleY));
  const sw = Math.max(1, Math.min(image.naturalWidth - sx, Math.round(rect.width * scaleX)));
  const sh = Math.max(1, Math.min(image.naturalHeight - sy, Math.round(rect.height * scaleY)));
  if (sw < 2 || sh < 2) throw new Error('image is outside visible viewport');

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await canvasToBlob(canvas, 'image/png');
  return { blob, method: 'visual-capture', filename: `segl-${Date.now()}.png`, width: sw, height: sh, sourceUrl: item.candidates?.[0]?.url || '' };
}

async function persistImage(item) {
  const id = crypto.randomUUID();
  const ext = extensionFor(item.filename, item.mime);
  const storagePath = `${item.board}/${id}.${ext}`;
  const objectUrl = `${SUPABASE_URL}/storage/v1/object/${encodePath(STORAGE_BUCKET)}/${encodePath(storagePath)}`;

  const upload = await fetch(objectUrl, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': item.mime || 'application/octet-stream',
      'x-upsert': 'false'
    },
    body: item.blob
  });
  if (!upload.ok) throw new Error(`Storage upload failed (${upload.status})`);

  const slot = placementSlot();
  const maxWidth = 500;
  const sourceWidth = Math.max(1, Number(item.width) || 300);
  const sourceHeight = Math.max(1, Number(item.height) || 200);
  const width = Math.min(sourceWidth, maxWidth);
  const height = width * sourceHeight / sourceWidth;

  const row = {
    id,
    board: item.board,
    type: 'image',
    src: /^https?:/i.test(item.sourceUrl || '') ? item.sourceUrl : null,
    storage_path: storagePath,
    text: '',
    x: slot.x,
    y: slot.y,
    width,
    height,
    grayscale: 0,
    z: zNow()
  };

  try {
    await insertBoardRow(row);
  } catch (error) {
    await deleteStorageObject(storagePath).catch(() => {});
    throw error;
  }
}

async function insertBoardRow(row) {
  const insert = await fetch(`${SUPABASE_URL}/rest/v1/board_items`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(row)
  });
  if (!insert.ok) {
    const detail = await insert.text().catch(() => '');
    throw new Error(`Board insert failed (${insert.status})${detail ? `: ${detail}` : ''}`);
  }
}

async function deleteStorageObject(storagePath) {
  const objectUrl = `${SUPABASE_URL}/storage/v1/object/${encodePath(STORAGE_BUCKET)}/${encodePath(storagePath)}`;
  await fetch(objectUrl, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
}

function placementSlot() {
  const slot = Math.floor(Date.now() / 700) % 12;
  return { x: 30 + (slot % 4) * 42, y: 30 + Math.floor(slot / 4) * 42 };
}

function zNow() {
  return Date.now() % 2147483647;
}

function filenameFromResponse(response, url, mime) {
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
  if (match) {
    try { return decodeURIComponent(match[1].replace(/"/g, '').trim()); }
    catch (_) { return match[1].replace(/"/g, '').trim(); }
  }
  return filenameFromUrl(url, mime);
}

function filenameFromUrl(url, mime) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').filter(Boolean).pop();
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return last;
  } catch (_) {}
  return `segl-${Date.now()}.${extensionFor('', mime)}`;
}

function extensionFor(filename, mime) {
  const match = String(filename || '').match(/\.([a-z0-9]{2,5})$/i);
  if (match) return match[1].toLowerCase().replace('jpeg', 'jpg');
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg' };
  return map[mime] || 'png';
}

function encodePath(path) {
  return String(path).split('/').map(encodeURIComponent).join('/');
}

function measureBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const result = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    image.onerror = error => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('could not capture image')), type);
  });
}
