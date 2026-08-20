const SUPABASE_URL = 'https://bshkvgdebluhmuxjpbiw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tV6ipeRw37DyNTm2iBl17Q_YmaLScc_';
const STORAGE_BUCKET = 'board-images';
const TEST_BOARD = 'segl-test';
const MAX_THING_BYTES = 25 * 1024 * 1024;

const activeTabs = new Set();

browser.browserAction.onClicked.addListener(async tab => {
  if (!tab?.id) return;
  const next = !activeTabs.has(tab.id);
  if (next) activeTabs.add(tab.id);
  else activeTabs.delete(tab.id);
  await syncBadge(tab.id, next);
  try {
    await browser.tabs.sendMessage(tab.id, { type: 'segl-set-active', active: next });
  } catch (error) {
    console.warn('Segl could not reach this page', error);
  }
});

browser.tabs.onRemoved.addListener(tabId => activeTabs.delete(tabId));

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message?.type) return undefined;

  switch (message.type) {
    case 'segl-status':
      return Promise.resolve({ active: !!sender.tab?.id && activeTabs.has(sender.tab.id) });
    case 'segl-image':
      return gatherAndKeepImage(message, sender);
    case 'segl-text':
      return gatherAndKeepText(message);
    default:
      return undefined;
  }
});

async function syncBadge(tabId, active) {
  try {
    await browser.browserAction.setBadgeBackgroundColor({ tabId, color: '#e00000' });
    await browser.browserAction.setBadgeText({ tabId, text: active ? 'ON' : '' });
    await browser.browserAction.setTitle({ tabId, title: active ? 'Segl is on — click to turn off' : 'Turn Segl on' });
  } catch (error) {
    console.warn('Segl badge update failed', error);
  }
}

async function gatherAndKeepImage(message, sender) {
  const candidates = normalizeCandidates(message.candidates);
  let acquired = null;
  const failures = [];

  for (const candidate of candidates) {
    try {
      acquired = await retrieveImage(candidate.url);
      acquired.sourceUrl = candidate.url;
      acquired.candidate = candidate;
      break;
    } catch (error) {
      failures.push({ url: candidate.url, error: error?.message || String(error) });
    }
  }

  if (!acquired) {
    try {
      acquired = await captureRenderedImage(sender.tab, message);
      acquired.sourceUrl = candidates[0]?.url || '';
    } catch (captureError) {
      console.warn('Segl could not gather image', { failures, captureError });
      return { ok: false, reason: 'unharvestable' };
    }
  }

  if (!acquired.blob || acquired.blob.size === 0 || acquired.blob.size > MAX_THING_BYTES) {
    return { ok: false, reason: 'unharvestable' };
  }

  try {
    const measured = await measureBlob(acquired.blob).catch(() => null);
    const width = measured?.width || acquired.width || message.naturalWidth || message.rect?.width || 300;
    const height = measured?.height || acquired.height || message.naturalHeight || message.rect?.height || 200;
    const filename = acquired.filename || filenameFromUrl(acquired.sourceUrl, acquired.blob.type);
    const kept = await persistImage({
      blob: acquired.blob,
      filename,
      mime: acquired.blob.type || 'image/png',
      width,
      height,
      sourceUrl: acquired.sourceUrl || '',
      pageUrl: message.pageUrl || '',
      acquisition: acquired.method
    });
    return { ok: true, board: TEST_BOARD, acquisition: acquired.method, sourceUrl: acquired.sourceUrl || '', ...kept };
  } catch (error) {
    console.error('Segl image keep failed', error);
    return { ok: false, reason: error?.message || 'keep failed' };
  }
}

async function gatherAndKeepText(message) {
  const text = String(message.text || '').trim();
  if (!text) return { ok: false, reason: 'empty text' };

  const slot = placementSlot();
  const row = {
    id: crypto.randomUUID(),
    board: TEST_BOARD,
    type: 'note',
    src: /^https?:/i.test(message.pageUrl || '') ? message.pageUrl : null,
    storage_path: null,
    text,
    x: slot.x,
    y: slot.y,
    width: 360,
    height: Math.max(110, Math.min(360, 80 + Math.ceil(text.length / 45) * 22)),
    grayscale: 0,
    z: zNow()
  };

  try {
    await insertBoardRow(row);
    return { ok: true, board: TEST_BOARD, id: row.id, kind: 'text' };
  } catch (error) {
    console.error('Segl text keep failed', error);
    return { ok: false, reason: error?.message || 'keep failed' };
  }
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

async function retrieveImage(url) {
  if (!/^https?:/i.test(url)) throw new Error('Image has no retrievable URL');

  const response = await fetch(url, {
    credentials: 'include',
    cache: 'force-cache'
  });
  if (!response.ok) throw new Error(`Image request failed (${response.status})`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Resource is not an image');
  if (blob.size > MAX_THING_BYTES) throw new Error('Image is too large');

  return {
    blob,
    method: 'resource',
    filename: filenameFromResponse(response, url, blob.type)
  };
}

async function captureRenderedImage(tab, message) {
  if (!tab || !tab.windowId || !message.rect) throw new Error('No visible image to capture');

  const screenshot = await browser.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const image = await loadImage(screenshot);
  const viewportWidth = Math.max(1, Number(message.viewportWidth) || image.naturalWidth);
  const viewportHeight = Math.max(1, Number(message.viewportHeight) || image.naturalHeight);
  const scaleX = image.naturalWidth / viewportWidth;
  const scaleY = image.naturalHeight / viewportHeight;
  const rect = message.rect;

  const sx = Math.max(0, Math.round(rect.left * scaleX));
  const sy = Math.max(0, Math.round(rect.top * scaleY));
  const sw = Math.max(1, Math.min(image.naturalWidth - sx, Math.round(rect.width * scaleX)));
  const sh = Math.max(1, Math.min(image.naturalHeight - sy, Math.round(rect.height * scaleY)));
  if (sw < 2 || sh < 2) throw new Error('Image is outside the visible viewport');

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await canvasToBlob(canvas, 'image/png');

  return {
    blob,
    method: 'visual-capture',
    filename: `segl-${Date.now()}.png`,
    width: sw,
    height: sh
  };
}

async function persistImage(item) {
  const id = crypto.randomUUID();
  const ext = extensionFor(item.filename, item.mime);
  const storagePath = `${TEST_BOARD}/${id}.${ext}`;
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
    board: TEST_BOARD,
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

  return { id, kind: 'image', storagePath };
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
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
}

function placementSlot() {
  const slot = Math.floor(Date.now() / 700) % 12;
  return {
    x: 30 + (slot % 4) * 42,
    y: 30 + Math.floor(slot / 4) * 42
  };
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
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg'
  };
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
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not capture image')), type);
  });
}
