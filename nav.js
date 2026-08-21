import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const home = document.querySelector('.nav-canvas');
if (!home) throw new Error('storeskja canvas missing');

const type = home.dataset.nav;
const HUSBOND_STORE = 'storeskja-husbond';
const HOLD_TO_EDIT_MS = 430;
let lids = [];
let zCounter = 100;
let activeLid = null;
let placingLid = null;
let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

const rune = {
  'whaleroad':'ᚹᚺᚨᛚᛖᚱᚨᛟᛞ',
  'gold-tree':'ᚷᛟᛚᛞ-ᛏᚱᛖᛖ',
  'world-candle':'ᚹᛟᚱᛚᛞ-ᚲᚨᚾᛞᛚᛖ',
  'river':'ᚱᛁᚹᛖᚱ',
  'rafn':'ᚱᚨᚠᚾ'
};

document.addEventListener('pointermove', event => {
  lastPointer = { x: event.clientX, y: event.clientY };
}, { passive: true });

if (type === 'husbond') {
  wireHusbondActions();
  wireCanvasSelection();
  await loadLids();
} else {
  renderWyf();
}

function wireCanvasSelection() {
  document.addEventListener('pointerdown', event => {
    if (placingLid) return;
    if (!event.target.closest('.storeskja-lid') &&
        !event.target.closest('.eskja-confirm') &&
        !event.target.closest('.storeskja-actions')) {
      setActiveLid(null);
    }
  });
}

function wireHusbondActions() {
  const input = document.getElementById('lidFileInput');
  const textButton = document.getElementById('lidTextButton');

  input?.addEventListener('change', async () => {
    const files = [...input.files];
    input.value = '';
    for (const file of files) {
      try {
        const id = await createMediaLid(file);
        await loadLids();
        await beginPlacement(id);
      } catch (error) {
        console.error(error);
        showMessage('could not add lid');
      }
    }
  });

  textButton?.addEventListener('click', async () => {
    const text = window.prompt('');
    if (!String(text || '').trim()) return;
    try {
      const id = await createTextLid(String(text).trim());
      await loadLids();
      await beginPlacement(id);
    } catch (error) {
      console.error(error);
      showMessage('could not add lid');
    }
  });
}

async function loadLids() {
  home.querySelectorAll('.storeskja-lid').forEach(node => node.remove());
  activeLid = null;

  const { data, error } = await supabase
    .from('board_items')
    .select('*')
    .eq('board', HUSBOND_STORE)
    .not('target_board', 'is', null)
    .order('z', { ascending: true });

  if (error) {
    console.error(error);
    showMessage('could not load lids');
    return;
  }

  lids = data || [];
  zCounter = Math.max(100, ...lids.map(item => Number(item.z) || 0));

  for (const item of lids) {
    item.storagePath = item.storage_path;
    if (item.storage_path) {
      const { data: publicUrl } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(item.storage_path);
      item.src = publicUrl.publicUrl;
    }
    renderLid(item);
  }
}

function renderLid(item) {
  const el = document.createElement('div');
  el.className = `storeskja-lid lid-${item.type}`;
  el.dataset.id = item.id;
  el.style.left = `${Number(item.x) || 80}px`;
  el.style.top = `${Number(item.y) || 80}px`;
  el.style.width = `${Math.max(36, Number(item.width) || 160)}px`;
  el.style.height = `${Math.max(28, Number(item.height) || 60)}px`;
  el.style.zIndex = String(item.z || 10);

  let textEditor = null;

  if (item.type === 'note') {
    textEditor = document.createElement('textarea');
    textEditor.className = 'storeskja-lid-text';
    textEditor.value = item.text || '';
    textEditor.readOnly = true;
    textEditor.spellcheck = false;
    textEditor.setAttribute('aria-label', 'lid text');
    el.appendChild(textEditor);
  } else if (item.type === 'audio') {
    const audio = document.createElement('div');
    audio.className = 'storeskja-lid-audio';
    const mark = document.createElement('span');
    mark.className = 'mark';
    mark.textContent = '◌';
    const name = document.createElement('span');
    name.textContent = cleanFilename(item.text || 'recording');
    audio.append(mark, name);
    el.appendChild(audio);
  } else if (item.type === 'video') {
    const video = document.createElement('video');
    video.src = item.src || '';
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'metadata';
    el.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = item.src || '';
    img.alt = '';
    img.draggable = false;
    el.appendChild(img);
  }

  const controls = document.createElement('div');
  controls.className = 'lid-controls';

  if (item.type === 'note') {
    const edit = document.createElement('button');
    edit.className = 'lid-control lid-edit';
    edit.type = 'button';
    edit.textContent = '&';
    edit.title = 'edit text';
    edit.addEventListener('pointerdown', stop);
    edit.addEventListener('click', event => {
      stop(event);
      beginTextEdit(item, el, textEditor);
    });
    controls.appendChild(edit);
  }

  const remove = document.createElement('button');
  remove.className = 'lid-control lid-remove';
  remove.type = 'button';
  remove.textContent = '×';
  remove.title = 'let this eskja go';
  remove.addEventListener('pointerdown', stop);
  remove.addEventListener('click', async event => {
    stop(event);
    const shouldRemove = await confirmLetGo();
    if (shouldRemove) await removeLid(item, el);
  });
  controls.appendChild(remove);
  el.appendChild(controls);

  const resize = document.createElement('div');
  resize.className = 'lid-resize';
  resize.title = 'resize lid';
  resize.addEventListener('pointerdown', event => beginResize(event, item, el));
  el.appendChild(resize);

  el.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (event.target.closest('.lid-control') || event.target.closest('.lid-resize')) return;
    if (textEditor && !textEditor.readOnly) return;
    beginMoveEnterOrSelect(event, item, el);
  });

  if (textEditor) {
    textEditor.addEventListener('pointerdown', event => {
      if (!textEditor.readOnly) event.stopPropagation();
    });
    textEditor.addEventListener('keydown', async event => {
      if (event.key === 'Escape') {
        textEditor.value = item.text || '';
        finishTextEdit(item, el, textEditor, false);
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        await finishTextEdit(item, el, textEditor, true);
      }
    });
    textEditor.addEventListener('blur', async () => {
      if (!textEditor.readOnly) await finishTextEdit(item, el, textEditor, true);
    });
  }

  home.appendChild(el);
}

function beginMoveEnterOrSelect(event, item, el) {
  event.preventDefault();

  const startX = event.clientX;
  const startY = event.clientY;
  const originX = Number(item.x) || 80;
  const originY = Number(item.y) || 80;
  let moved = false;
  let held = false;
  let cancelled = false;

  item.z = ++zCounter;
  el.style.zIndex = String(item.z);
  el.setPointerCapture(event.pointerId);

  const holdTimer = window.setTimeout(() => {
    if (moved || cancelled) return;
    held = true;
    el.classList.add('held');
    setActiveLid(el);
  }, HOLD_TO_EDIT_MS);

  const onMove = moveEvent => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;

    if (!moved && Math.hypot(dx, dy) > 5) {
      moved = true;
      window.clearTimeout(holdTimer);
      el.classList.remove('held');
      el.classList.add('moving');
      setActiveLid(null);
    }

    if (!moved) return;
    item.x = Math.max(0, originX + dx);
    item.y = Math.max(0, originY + dy);
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
  };

  const cleanup = () => {
    window.clearTimeout(holdTimer);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onCancel);
    el.classList.remove('moving', 'held');
  };

  const onUp = async () => {
    cleanup();
    if (moved) {
      await saveLidGeometry(item);
    } else if (held) {
      setActiveLid(el);
    } else if (item.target_board) {
      window.location.href = `board.html?board=${encodeURIComponent(item.target_board)}`;
    }
  };

  const onCancel = () => {
    cancelled = true;
    cleanup();
  };

  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
}

async function beginPlacement(itemId) {
  const item = lids.find(candidate => candidate.id === itemId);
  const el = item ? home.querySelector(`.storeskja-lid[data-id="${CSS.escape(itemId)}"]`) : null;
  if (!item || !el) return;

  setActiveLid(null);
  item.z = ++zCounter;
  el.style.zIndex = String(item.z);
  el.classList.add('placing');
  document.body.classList.add('placing-lid');
  placingLid = { item, el };

  const moveTo = (clientX, clientY) => {
    const width = Math.max(36, Number(item.width) || el.offsetWidth || 100);
    const height = Math.max(28, Number(item.height) || el.offsetHeight || 50);
    item.x = Math.max(0, clientX - width / 2);
    item.y = Math.max(0, clientY - height / 2);
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
  };

  moveTo(lastPointer.x, lastPointer.y);

  return new Promise(resolve => {
    const onMove = event => {
      lastPointer = { x: event.clientX, y: event.clientY };
      moveTo(event.clientX, event.clientY);
    };

    const cleanup = () => {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerdown', onPlace, true);
      document.removeEventListener('keydown', onKey, true);
      el.classList.remove('placing');
      document.body.classList.remove('placing-lid');
      placingLid = null;
    };

    const finish = async () => {
      cleanup();
      await saveLidGeometry(item);
      resolve();
    };

    const onPlace = event => {
      if (event.button !== 0) return;
      if (event.target.closest('.storeskja-actions')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      moveTo(event.clientX, event.clientY);
      finish();
    };

    const onKey = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      finish();
    };

    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerdown', onPlace, true);
    document.addEventListener('keydown', onKey, true);
  });
}

function beginResize(event, item, el) {
  event.preventDefault();
  event.stopPropagation();
  setActiveLid(el);

  const startX = event.clientX;
  const startY = event.clientY;
  const startWidth = Math.max(36, Number(item.width) || el.offsetWidth || 100);
  const startHeight = Math.max(28, Number(item.height) || el.offsetHeight || 50);
  const ratio = startWidth / Math.max(1, startHeight);
  const preserveRatio = item.type === 'image' || item.type === 'video';
  const minWidth = item.type === 'note' ? 36 : 70;
  const minHeight = item.type === 'note' ? 28 : 40;

  const handle = event.currentTarget;
  handle.setPointerCapture(event.pointerId);

  const onMove = moveEvent => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    let width = Math.max(minWidth, startWidth + dx);
    let height;

    if (preserveRatio) {
      const byWidth = width / ratio;
      const byHeight = Math.max(minHeight, startHeight + dy);
      if (Math.abs(dx) >= Math.abs(dy)) {
        height = Math.max(minHeight, byWidth);
      } else {
        height = byHeight;
        width = Math.max(minWidth, height * ratio);
      }
    } else {
      height = Math.max(minHeight, startHeight + dy);
    }

    item.width = width;
    item.height = height;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
  };

  const onUp = async () => {
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onUp);
    await saveLidGeometry(item);
  };

  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);
}

function beginTextEdit(item, el, editor) {
  setActiveLid(el);
  editor.readOnly = false;
  el.classList.add('editing');
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);
}

async function finishTextEdit(item, el, editor, save) {
  if (editor.readOnly) return;
  const next = editor.value.trim();

  if (save && next) {
    const { error } = await supabase
      .from('board_items')
      .update({ text: next })
      .eq('id', item.id)
      .eq('board', HUSBOND_STORE);
    if (error) {
      console.error(error);
      editor.value = item.text || '';
      showMessage('could not change lid');
    } else {
      item.text = next;
    }
  } else {
    editor.value = item.text || '';
  }

  editor.readOnly = true;
  el.classList.remove('editing');
}

function setActiveLid(el) {
  if (activeLid && activeLid !== el) activeLid.classList.remove('selected');
  activeLid = el;
  if (activeLid) activeLid.classList.add('selected');
}

async function saveLidGeometry(item) {
  const { error } = await supabase
    .from('board_items')
    .update({ x: item.x, y: item.y, width: item.width, height: item.height, z: item.z })
    .eq('id', item.id)
    .eq('board', HUSBOND_STORE);
  if (error) {
    console.error(error);
    showMessage('could not place lid');
  }
}

async function removeLid(item, el) {
  try {
    const { error } = await supabase
      .from('board_items')
      .delete()
      .eq('id', item.id)
      .eq('board', HUSBOND_STORE);
    if (error) throw error;

    if (item.storagePath) {
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([item.storagePath]);
      if (storageError) console.warn(storageError);
    }

    lids = lids.filter(candidate => candidate.id !== item.id);
    if (activeLid === el) activeLid = null;
    el.remove();
  } catch (error) {
    console.error(error);
    showMessage('could not let it go');
  }
}

function confirmLetGo() {
  return new Promise(resolve => {
    document.querySelector('.eskja-confirm')?.remove();

    const shade = document.createElement('div');
    shade.className = 'eskja-confirm';

    const panel = document.createElement('div');
    panel.className = 'eskja-confirm-panel';

    const question = document.createElement('div');
    question.className = 'eskja-confirm-question';
    question.textContent = 'let this eskja go?';

    const actions = document.createElement('div');
    actions.className = 'eskja-confirm-actions';

    const keep = document.createElement('button');
    keep.type = 'button';
    keep.textContent = 'keep';

    const letGo = document.createElement('button');
    letGo.type = 'button';
    letGo.textContent = 'let go';

    const escape = event => {
      if (event.key === 'Escape') finish(false);
    };

    const finish = value => {
      document.removeEventListener('keydown', escape);
      shade.remove();
      resolve(value);
    };

    keep.addEventListener('click', () => finish(false));
    letGo.addEventListener('click', () => finish(true));
    shade.addEventListener('pointerdown', event => {
      if (event.target === shade) finish(false);
    });
    document.addEventListener('keydown', escape);

    actions.append(keep, letGo);
    panel.append(question, actions);
    shade.appendChild(panel);
    document.body.appendChild(shade);
    keep.focus();
  });
}

async function createTextLid(text) {
  const id = crypto.randomUUID();
  const target = makeTargetBoard();
  const slot = nextLidSlot();
  const width = Math.min(280, Math.max(80, text.length * 11));
  const height = Math.max(42, Math.min(150, 34 + Math.ceil(text.length / 24) * 24));

  const { error } = await supabase.from('board_items').insert({
    id,
    board: HUSBOND_STORE,
    target_board: target,
    type: 'note',
    src: null,
    storage_path: null,
    text,
    x: slot.x,
    y: slot.y,
    width,
    height,
    grayscale: 0,
    z: ++zCounter
  });
  if (error) throw error;
  return id;
}

async function createMediaLid(file) {
  const isImage = file.type.startsWith('image/');
  const isAudio = file.type.startsWith('audio/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isAudio && !isVideo) throw new Error('unsupported lid type');

  const id = crypto.randomUUID();
  const target = makeTargetBoard();
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const storagePath = `${HUSBOND_STORE}/${id}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (uploadError) throw uploadError;

  let width = 180;
  let height = 52;
  const objectUrl = URL.createObjectURL(file);
  try {
    if (isImage) {
      const size = await imageSize(objectUrl);
      width = Math.min(260, Math.max(90, size.width));
      height = width * size.height / Math.max(1, size.width);
    } else if (isVideo) {
      const size = await videoSize(objectUrl);
      width = Math.min(280, Math.max(120, size.width || 220));
      height = width * (size.height || 124) / Math.max(1, size.width || 220);
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const slot = nextLidSlot();
  const itemType = isAudio ? 'audio' : isVideo ? 'video' : 'image';

  const { error } = await supabase.from('board_items').insert({
    id,
    board: HUSBOND_STORE,
    target_board: target,
    type: itemType,
    src: null,
    storage_path: storagePath,
    text: file.name || itemType,
    x: slot.x,
    y: slot.y,
    width,
    height,
    grayscale: 0,
    z: ++zCounter
  });

  if (error) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    throw error;
  }
  return id;
}

function nextLidSlot() {
  const count = lids.length;
  const col = count % 4;
  const row = Math.floor(count / 4) % 5;
  return { x: 1180 + col * 145, y: 300 + row * 105 };
}

function makeTargetBoard() {
  return `husbond-${crypto.randomUUID()}`.toLowerCase();
}

function imageSize(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = src;
  });
}

function videoSize(src) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
    video.onerror = reject;
    video.src = src;
  });
}

function cleanFilename(value) {
  return String(value).replace(/\.[^.]+$/, '') || 'recording';
}

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
}

function showMessage(text) {
  let message = document.querySelector('.storeskja-message');
  if (!message) {
    message = document.createElement('div');
    message.className = 'storeskja-message';
    document.body.appendChild(message);
  }
  message.textContent = text;
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => { message.textContent = ''; }, 2200);
}

function renderWyf() {
  const alphabet = document.createElement('div');
  alphabet.className = 'wyf-section wyf-alphabet';
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(ch => alphabet.appendChild(wyfLink(ch, `wyf-letter-${ch}`, 'wyf-link')));
  home.appendChild(alphabet);

  const numbers = document.createElement('div');
  numbers.className = 'wyf-section wyf-numbers';
  for (let i = 1; i <= 41; i++) numbers.appendChild(wyfLink(String(i), `wyf-number-${i}`, 'wyf-link numeral'));
  home.appendChild(numbers);

  const cyr = document.createElement('div');
  cyr.className = 'wyf-section wyf-cyrillic';
  ['б','Д','й'].forEach((ch, i) => {
    const a = wyfLink(ch, `wyf-cyrillic-${i}`, 'nav-link cyrillic');
    const fixed = [[18, 36], [31, 39], [45, 35]];
    a.style.left = `${fixed[i][0]}%`;
    a.style.top = `${fixed[i][1]}%`;
    cyr.appendChild(a);
  });
  home.appendChild(cyr);

  const runes = document.createElement('div');
  runes.className = 'wyf-section wyf-runes';
  Object.values(rune).forEach((glyphs, i) => {
    const a = wyfLink(glyphs, `wyf-rune-${i}`, 'rune-link');
    const fixed = [[11, 49], [29, 53], [48, 47], [67, 52], [84, 48]];
    a.style.left = `${fixed[i][0]}%`;
    a.style.top = `${fixed[i][1]}%`;
    runes.appendChild(a);
  });
  home.appendChild(runes);

  const handwriting = document.createElement('div');
  handwriting.className = 'wyf-section wyf-handwriting';
  ['passerby blue','guest','fivecoat','jane','bramble'].forEach((text, i) => {
    handwriting.appendChild(wyfLink(text, `wyf-hand-${i}`, text === 'passerby blue' ? 'hand-link passerby-blue' : 'hand-link'));
  });
  home.appendChild(handwriting);

  home.appendChild(wyfLink('%', 'shared', 'wyf-shared'));
}

function wyfLink(label, board, cls) {
  const a = document.createElement('a');
  a.className = cls;
  a.textContent = label;
  a.href = `board.html?board=${encodeURIComponent(board)}`;
  return a;
}
