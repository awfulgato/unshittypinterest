const SUPABASE_URL = 'https://bshkvgdebluhmuxjpbiw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tV6ipeRw37DyNTm2iBl17Q_YmaLScc_';
const STORAGE_BUCKET = 'board-images';
const MAX_THING_BYTES = 25 * 1024 * 1024;

let bag = [];

browser.browserAction.onClicked.addListener(async () => {
  try { await browser.sidebarAction.open(); } catch (error) { console.error(error); }
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || !message.type) return undefined;

  switch (message.type) {
    case 'harvest-image':
      return harvestImage(message, sender);
    case 'bag-list':
      return Promise.resolve(publicBag());
    case 'bag-remove':
      bag = bag.filter(item => item.id !== message.id);
      return Promise.resolve(publicBag());
    case 'bag-clear':
      bag = [];
      return Promise.resolve(publicBag());
    case 'keep':
      return keepBag(message.board === 'wyf' ? 'wyf' : 'husbond');
    default:
      return undefined;
  }
});

function publicBag() {
  return bag.map(({ blob, ...item }) => item);
}

async function harvestImage(message, sender) {
  const id = crypto.randomUUID();
  const sourceUrl = message.src || '';
  let acquired;

  try {
    acquired = await retrieveImage(sourceUrl, message.pageUrl);
  } catch (directError) {
    try {
      acquired = await captureRenderedImage(sender.tab, message);
    } catch (captureError) {
      console.warn('Eskja could not gather image', { directError, captureError });
      return { ok: false, reason: 'unharvestable' };
    }
  }

  if (!acquired.blob || acquired.blob.size === 0 || acquired.blob.size > MAX_THING_BYTES) {
    return { ok: false, reason: 'unharvestable' };
  }

  const dataUrl = await blobToDataUrl(acquired.blob);
  const item = {
    id,
    blob: acquired.blob,
    preview: dataUrl,
    sourceUrl,
    pageUrl: message.pageUrl || '',
    acquisition: acquired.method,
    mime: acquired.blob.type || 'image/png',
    filename: acquired.filename || filenameFromUrl(sourceUrl, acquired.blob.type),
    width: acquired.width || message.naturalWidth || message.rect?.width || 300,
    height: acquired.height || message.naturalHeight || message.rect?.height || 200,
    gatheredAt: Date.now()
  };

  bag.push(item);
  return { ok: true, item: publicBag().find(entry => entry.id === id), count: bag.length };
}

async function retrieveImage(url, pageUrl) {
  if (!/^https?:/i.test(url)) throw new Error('Image has no retrievable URL');

  const response = await fetch(url, {
    credentials: 'include',
    cache: 'force-cache',
    referrer: /^https?:/i.test(pageUrl || '') ? pageUrl : undefined
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
    filename: `eskja-${Date.now()}.png`,
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

async function keepBag(board) {
  if (!bag.length) return { ok: true, kept: 0, remaining: 0 };

  const pending = [...bag];
  const keptIds = [];
  const failures = [];

  for (let index = 0; index < pending.length; index += 1) {
    const item = pending[index];
    try {
      await keepOne(item, board, index);
      keptIds.push(item.id);
    } catch (error) {
      console.error('Eskja keep failed', error);
      failures.push({ id: item.id, message: error?.message || 'keep failed' });
    }
  }

  bag = bag.filter(item => !keptIds.includes(item.id));
  return { ok: failures.length === 0, kept: keptIds.length, remaining: bag.length, failures };
}

async function keepOne(item, board, index) {
  const id = crypto.randomUUID();
  const ext = extensionFor(item.filename, item.mime);
  const storagePath = `${board}/${id}.${ext}`;
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

  const maxWidth = 500;
  const sourceWidth = Math.max(1, Number(item.width) || 300);
  const sourceHeight = Math.max(1, Number(item.height) || 200);
  const width = Math.min(sourceWidth, maxWidth);
  const height = width * sourceHeight / sourceWidth;
  const offset = 20 + (index % 8) * 18;

  const row = {
    id,
    board,
    type: 'image',
    src: null,
    storage_path: storagePath,
    text: '',
    x: offset,
    y: offset,
    width,
    height,
    grayscale: 0,
    z: Date.now() % 2147483647
  };

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
  if (!insert.ok) throw new Error(`Board insert failed (${insert.status})`);
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
  return `eskja-${Date.now()}.${extensionFor('', mime)}`;
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

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
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
