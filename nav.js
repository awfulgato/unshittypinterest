import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const home = document.querySelector('.nav-canvas');
if (!home) throw new Error('storeskja canvas missing');

const type = home.dataset.nav;
const HUSBOND_STORE = 'storeskja-husbond';
let dynamicLids = [];
let zCounter = 100;

const husbondLatin = 'abcdefghijklmnopqrstuvwxyz'.split('');
const husbondGreek = ['α','Β','γ','Δ','ε','ζ','η','Θ','κ','Λ','μ','ν','Π','σ','φ','χ','ψ','Ω'];
const husbondCyrillic = ['а','б','д','ж','к','м','р','у','ф','Я'];
const husbondHebrew = [
  { label: 'ש', board: 'husbond-hebrew-shema' },
  { label: 'ז', board: 'husbond-hebrew-zechariah' },
  { label: 'אדם', board: 'husbond-hebrew-adam' },
  { label: 'ר', board: 'husbond-hebrew-ruach' },
  { label: 'א', board: 'husbond-hebrew-ahava' }
];

const rune = {
  'whaleroad':'ᚹᚺᚨᛚᛖᚱᚨᛟᛞ',
  'gold-tree':'ᚷᛟᛚᛞ-ᛏᚱᛖᛖ',
  'world-candle':'ᚹᛟᚱᛚᛞ-ᚲᚨᚾᛞᛚᛖ',
  'river':'ᚱᛁᚹᛖᚱ',
  'rafn':'ᚱᚨᚠᚾ'
};

function boardLink(label, board, cls = 'husbond-static') {
  const a = document.createElement('a');
  a.className = cls;
  a.textContent = label;
  a.href = `board.html?board=${encodeURIComponent(board)}`;
  a.dataset.board = board;
  return a;
}

if (type === 'husbond') {
  renderLegacyHusbond();
  wireHusbondActions();
  await loadDynamicLids();
} else {
  renderWyf();
}

function renderLegacyHusbond() {
  const families = [
    husbondLatin.map(ch => boardLink(ch, `husbond-${ch}`)),
    Array.from({ length: 12 }, (_, i) => boardLink(String(i + 1), `husbond-${i + 1}`)),
    husbondGreek.map((ch, i) => boardLink(ch, `husbond-greek-${legacyGreekIndex(ch)}`)),
    husbondCyrillic.map((ch, i) => boardLink(ch, `husbond-cyrillic-${legacyCyrillicIndex(ch)}`)),
    husbondHebrew.map(({ label, board }) => boardLink(label, board))
  ];

  const lefts = [7, 21, 35, 49, 63];
  families.forEach((family, familyIndex) => {
    const top = 7;
    const bottom = 8;
    const usable = 100 - top - bottom;
    const step = family.length > 1 ? usable / (family.length - 1) : 0;
    family.forEach((link, i) => {
      link.style.left = `${lefts[familyIndex]}%`;
      link.style.top = `${top + step * i}%`;
      link.style.transform = 'translate(-50%, -50%)';
      home.appendChild(link);
    });
  });

  const chinese = [
    boardLink('道德经', 'husbond-taodejing'),
    boardLink('无为', 'husbond-wuwei')
  ];
  chinese.forEach((link, i) => {
    link.style.left = `${77 + i * 6}%`;
    link.style.top = '9%';
    link.style.writingMode = 'vertical-rl';
    link.style.textOrientation = 'upright';
    link.style.letterSpacing = '.08em';
    home.appendChild(link);
  });

  const cross = boardLink('†', 'husbond-cross');
  cross.style.left = '93%';
  cross.style.top = '12%';
  home.appendChild(cross);
}

function legacyGreekIndex(ch) {
  const original = ['α','Β','γ','Δ','ζ','Θ','κ','Λ','μ','Π','σ','Ω','ε','η','ν','φ','χ','ψ'];
  return original.indexOf(ch);
}

function legacyCyrillicIndex(ch) {
  const original = ['ж','Я','ф','а','б','д','к','м','р','у'];
  return original.indexOf(ch);
}

function wireHusbondActions() {
  const input = document.getElementById('lidFileInput');
  const textButton = document.getElementById('lidTextButton');

  input?.addEventListener('change', async () => {
    const files = [...input.files];
    input.value = '';
    for (const file of files) {
      try {
        await createMediaLid(file);
      } catch (error) {
        console.error(error);
        showMessage('could not add lid');
      }
    }
    await loadDynamicLids();
  });

  textButton?.addEventListener('click', async () => {
    const text = window.prompt('');
    if (!String(text || '').trim()) return;
    try {
      await createTextLid(String(text).trim());
      await loadDynamicLids();
    } catch (error) {
      console.error(error);
      showMessage('could not add lid');
    }
  });
}

async function loadDynamicLids() {
  home.querySelectorAll('.storeskja-lid').forEach(node => node.remove());

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

  dynamicLids = data || [];
  zCounter = Math.max(100, ...dynamicLids.map(item => Number(item.z) || 0));

  for (const item of dynamicLids) {
    item.storagePath = item.storage_path;
    if (item.storage_path) {
      const { data: publicUrl } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(item.storage_path);
      item.src = publicUrl.publicUrl;
    }
    renderDynamicLid(item);
  }
}

function renderDynamicLid(item) {
  const el = document.createElement('div');
  el.className = 'storeskja-lid';
  el.dataset.id = item.id;
  el.style.left = `${Number(item.x) || 80}px`;
  el.style.top = `${Number(item.y) || 80}px`;
  el.style.width = `${Math.max(36, Number(item.width) || 160)}px`;
  el.style.height = `${Math.max(28, Number(item.height) || 60)}px`;
  el.style.zIndex = String(item.z || 10);

  if (item.type === 'note') {
    const text = document.createElement('div');
    text.className = 'storeskja-lid-text';
    text.textContent = item.text || '';
    el.appendChild(text);
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

  const remove = document.createElement('button');
  remove.className = 'lid-remove';
  remove.type = 'button';
  remove.textContent = '×';
  remove.title = 'remove lid';
  remove.addEventListener('pointerdown', event => event.stopPropagation());
  remove.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    await removeLid(item, el);
  });
  el.appendChild(remove);

  let moved = false;
  el.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target === remove) return;
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = Number(item.x) || 80;
    const originY = Number(item.y) || 80;
    moved = false;

    item.z = ++zCounter;
    el.style.zIndex = String(item.z);
    el.setPointerCapture(event.pointerId);

    const onMove = moveEvent => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) > 4) moved = true;
      if (!moved) return;
      item.x = Math.max(0, originX + dx);
      item.y = Math.max(0, originY + dy);
      el.style.left = `${item.x}px`;
      el.style.top = `${item.y}px`;
    };

    const onUp = async upEvent => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);

      if (moved) {
        await saveLidPosition(item);
      } else if (item.target_board) {
        window.location.href = `board.html?board=${encodeURIComponent(item.target_board)}`;
      }
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });

  home.appendChild(el);
}

async function saveLidPosition(item) {
  const { error } = await supabase
    .from('board_items')
    .update({ x: item.x, y: item.y, z: item.z })
    .eq('id', item.id)
    .eq('board', HUSBOND_STORE);
  if (error) console.error(error);
}

async function removeLid(item, el) {
  try {
    if (item.storagePath) {
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([item.storagePath]);
      if (storageError) throw storageError;
    }
    const { error } = await supabase
      .from('board_items')
      .delete()
      .eq('id', item.id)
      .eq('board', HUSBOND_STORE);
    if (error) throw error;
    dynamicLids = dynamicLids.filter(candidate => candidate.id !== item.id);
    el.remove();
  } catch (error) {
    console.error(error);
    showMessage('could not remove lid');
  }
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
  const type = isAudio ? 'audio' : isVideo ? 'video' : 'image';

  const { error } = await supabase.from('board_items').insert({
    id,
    board: HUSBOND_STORE,
    target_board: target,
    type,
    src: null,
    storage_path: storagePath,
    text: file.name || type,
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
}

function nextLidSlot() {
  const count = dynamicLids.length;
  const col = count % 4;
  const row = Math.floor(count / 4) % 5;
  return { x: 120 + col * 180, y: 90 + row * 125 };
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
