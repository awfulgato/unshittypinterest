import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(() => {
  const params = new URLSearchParams(location.search);
  const boardParam = params.get('board');
  const boardName = /^[a-z0-9_-]{1,80}$/i.test(boardParam || '') ? boardParam.toLowerCase() : 'husbond';

  const board = document.getElementById('board');
  const input = document.getElementById('fileInput');

  let state = { items: [] };
  let zCounter = 0;
  let saveQueue = Promise.resolve();

  async function load() {
    try {
      if (!SUPABASE_URL || SUPABASE_URL.includes('PASTE_') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('PASTE_')) {
        throw new Error('Supabase configuration is missing.');
      }

      const { data, error } = await supabase
        .from('board_items')
        .select('*')
        .eq('board', boardName)
        .order('z', { ascending: true });

      if (error) throw error;

      const items = data || [];

      for (const item of items) {
        if (item.storage_path) {
          const { data: publicUrl } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(item.storage_path);
          item.src = publicUrl.publicUrl;
        }
      }

      items.forEach(item => {
        item.storagePath = item.storage_path;
        item.cutoutPath = item.cutout_path;
        item.cutoutEnabled = !!item.cutout_enabled;
      });

      state = { items };
      zCounter = Math.max(0, ...state.items.map(item => item.z || 0));
      renderAll();
    } catch (error) {
      console.error(error);
      board.innerHTML = '';
      const message = document.createElement('div');
      message.className = 'board-error';
      message.textContent = 'Could not load the board. Refresh and try again.';
      document.body.appendChild(message);
    }
  }

  function saveItem(item) {
    saveQueue = saveQueue.then(async () => {
      const { error } = await supabase
        .from('board_items')
        .update({
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          grayscale: item.grayscale || 0,
          cutout_path: item.cutoutPath || null,
          cutout_enabled: !!item.cutoutEnabled,
          text: item.text || '',
          z: item.z || 1
        })
        .eq('id', item.id)
        .eq('board', boardName);
      if (error) throw error;
    }).catch(error => console.error(error));

    return saveQueue;
  }

  async function addItem(data) {
    const item = {
      id: data.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      board: boardName,
      type: data.type || 'image',
      src: data.src || null,
      storage_path: data.storagePath || null,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      grayscale: 0,
      cutout_path: data.cutoutPath || null,
      cutout_enabled: !!data.cutoutEnabled,
      text: data.text || '',
      z: ++zCounter
    };

    const { data: saved, error } = await supabase
      .from('board_items')
      .insert(item)
      .select('*')
      .single();

    if (error) throw error;

    if (saved.storage_path && !saved.src) {
      const { data: publicUrl } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(saved.storage_path);
      saved.src = publicUrl.publicUrl;
    }

    saved.storagePath = saved.storage_path;
    saved.cutoutPath = saved.cutout_path;
    saved.cutoutEnabled = !!saved.cutout_enabled;
    state.items.push(saved);
    renderItem(saved);
    expandBoard();
  }

  function renderAll() {
    board.innerHTML = '';
    state.items.forEach(renderItem);
    expandBoard();
  }

  const audibleMedia = new Set();
  let backgroundSegmenterPromise = null;

  function stopOtherMedia(except) {
    for (const media of audibleMedia) {
      if (media !== except && !media.paused) media.pause();
    }
  }

  async function getBackgroundSegmenter() {
    if (!backgroundSegmenterPromise) {
      backgroundSegmenterPromise = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm')
        .then(({ pipeline }) => pipeline('background-removal', 'Xenova/modnet', { dtype: 'fp32' }))
        .catch(error => {
          backgroundSegmenterPromise = null;
          throw error;
        });
    }
    return backgroundSegmenterPromise;
  }

  async function createCutoutBlob(src) {
    const segmenter = await getBackgroundSegmenter();
    const output = await segmenter(src);
    if (!output?.[0]?.toBlob) throw new Error('Background-removal model returned no image.');
    return output[0].toBlob();
  }

  function makePlayGlyph() {
    return '<span class="media-rings"><span class="media-ring ring-a"></span><span class="media-ring ring-b"></span><span class="media-symbol">▷</span></span>';
  }

  function makePauseGlyph() {
    return '<span class="media-rings"><span class="media-ring ring-a"></span><span class="media-ring ring-b"></span><span class="media-symbol isa">ᛁ</span></span>';
  }

  function renderItem(item) {
    const isNote = item.type === 'note';
    const isAudio = item.type === 'audio';
    const isVideo = item.type === 'video';
    const isImage = !isNote && !isAudio && !isVideo;

    const el = document.createElement('div');
    el.className = isNote
      ? 'note-item object-item'
      : isAudio
        ? 'audio-item media-item'
        : isVideo
          ? 'video-item media-item'
          : 'image-item';
    el.dataset.id = item.id;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    el.style.width = `${item.width}px`;
    if (isNote || isAudio) el.style.height = `${item.height || (isAudio ? 62 : 120)}px`;
    el.style.zIndex = item.z || 1;

    let img = null;
    let textArea = null;
    let media = null;
    let video = null;

    if (isNote) {
      textArea = document.createElement('textarea');
      textArea.className = 'note-text';
      textArea.value = item.text || '';
      textArea.spellcheck = false;
      textArea.addEventListener('input', () => {
        item.text = textArea.value;
        saveItem(item);
        expandBoard();
      });
      el.appendChild(textArea);
    } else if (isAudio) {
      media = document.createElement('audio');
      media.src = item.src;
      media.preload = 'metadata';
      audibleMedia.add(media);

      const shell = document.createElement('div');
      shell.className = 'audio-shell';
      const play = document.createElement('button');
      play.className = 'media-play';
      play.type = 'button';
      play.innerHTML = makePlayGlyph();
      shell.append(play);
      el.append(shell, media);

      const sync = () => {
        play.innerHTML = media.paused ? makePlayGlyph() : makePauseGlyph();
        shell.classList.toggle('playing', !media.paused);
      };

      play.addEventListener('click', event => {
        event.stopPropagation();
        if (media.paused) {
          stopOtherMedia(media);
          media.play().catch(error => console.error(error));
        } else {
          media.pause();
        }
      });
      media.addEventListener('play', sync);
      media.addEventListener('pause', sync);
      media.addEventListener('ended', sync);
      sync();
    } else if (isVideo) {
      media = video = document.createElement('video');
      video.src = item.src;
      video.preload = 'metadata';
      video.playsInline = true;
      audibleMedia.add(video);
      el.appendChild(video);

      const bar = document.createElement('div');
      bar.className = 'video-controls';
      const play = document.createElement('button');
      play.className = 'media-play video-play';
      play.type = 'button';
      play.innerHTML = makePlayGlyph();
      const track = document.createElement('input');
      track.className = 'video-track';
      track.type = 'range';
      track.min = '0';
      track.max = '1000';
      track.value = '0';
      bar.append(play, track);
      el.appendChild(bar);

      const sync = () => {
        play.innerHTML = video.paused ? makePlayGlyph() : makePauseGlyph();
        el.classList.toggle('playing', !video.paused);
      };

      play.addEventListener('click', event => {
        event.stopPropagation();
        if (video.paused) {
          stopOtherMedia(video);
          video.play().catch(error => console.error(error));
        } else {
          video.pause();
        }
      });
      video.addEventListener('timeupdate', () => {
        if (video.duration) track.value = String(Math.round(video.currentTime / video.duration * 1000));
      });
      track.addEventListener('input', event => {
        event.stopPropagation();
        if (video.duration) video.currentTime = Number(track.value) / 1000 * video.duration;
      });
      video.addEventListener('play', sync);
      video.addEventListener('pause', sync);
      video.addEventListener('ended', sync);
      sync();
    } else {
      img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.src = item.src;
      img.alt = '';
      img.draggable = false;
      el.appendChild(img);
    }

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    const controls = document.createElement('div');
    controls.className = 'image-controls';
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'control delete-control';
    deleteButton.textContent = '×';
    deleteButton.title = 'delete';

    let grayWrap = null;
    let grayInput = null;
    let cutoutButton = null;

    if (isImage || isVideo) {
      grayWrap = document.createElement('div');
      grayWrap.className = 'gray-wrap';
      const grayButton = document.createElement('button');
      grayButton.type = 'button';
      grayButton.className = 'control gray-button';
      grayButton.textContent = '○';
      grayButton.title = 'saturation';
      const slider = document.createElement('div');
      slider.className = 'gray-slider';
      grayInput = document.createElement('input');
      grayInput.type = 'range';
      grayInput.min = '0';
      grayInput.max = '100';
      grayInput.value = String(item.grayscale || 0);
      slider.append(grayInput);
      grayWrap.append(grayButton, slider);
      controls.append(grayWrap);

      grayButton.addEventListener('click', event => {
        event.stopPropagation();
        grayWrap.classList.toggle('open');
      });
      grayInput.addEventListener('input', event => {
        event.stopPropagation();
        item.grayscale = Number(grayInput.value);
        applySaturation();
        saveItem(item);
      });
    }

    controls.append(deleteButton);

    if (isImage) {
      cutoutButton = document.createElement('button');
      cutoutButton.type = 'button';
      cutoutButton.className = 'control cutout-button';
      cutoutButton.title = 'remove background';
      cutoutButton.innerHTML = '<span class="stone rear"></span><span class="stone front"></span>';
      controls.append(cutoutButton);

      const refreshCutout = async () => {
        cutoutButton.classList.toggle('active', !!item.cutoutEnabled);
        if (item.cutoutEnabled && item.cutoutPath) {
          const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(item.cutoutPath);
          img.src = data.publicUrl;
        } else {
          img.src = item.src;
        }
      };

      cutoutButton.addEventListener('click', async event => {
        event.stopPropagation();
        try {
          cutoutButton.classList.add('working');
          if (!item.cutoutPath) {
            const blob = await createCutoutBlob(item.src);
            const path = `${boardName}/${item.id}-cutout.png`;
            const { error } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(path, blob, { contentType: 'image/png', upsert: true });
            if (error) throw error;
            item.cutoutPath = path;
          }
          item.cutoutEnabled = !item.cutoutEnabled;
          await refreshCutout();
          await saveItem(item);
        } catch (error) {
          console.error('Background removal failed', error);
          alert('Background removal failed. Try again.');
        } finally {
          cutoutButton.classList.remove('working');
        }
      });

      refreshCutout();
    }

    el.append(handle, controls);
    board.appendChild(el);
    applySaturation();

    function applySaturation() {
      const grayscale = item.grayscale || 0;
      if (img) img.style.filter = `grayscale(${grayscale}%)`;
      if (video) video.style.filter = `grayscale(${grayscale}%)`;
    }

    const interactiveTarget = event =>
      event.target === handle ||
      event.target === textArea ||
      (grayWrap && grayWrap.contains(event.target)) ||
      event.target === deleteButton ||
      (cutoutButton && cutoutButton.contains(event.target)) ||
      event.target.closest?.('.media-play,.video-track');

    el.addEventListener('pointerdown', event => {
      if (interactiveTarget(event)) return;
      event.preventDefault();
      select(el);
      item.z = ++zCounter;
      el.style.zIndex = item.z;

      const startX = event.clientX;
      const startY = event.clientY;
      const originalX = item.x;
      const originalY = item.y;
      el.setPointerCapture(event.pointerId);
      el.classList.add('dragging');

      const move = moveEvent => {
        item.x = originalX + moveEvent.clientX - startX;
        item.y = originalY + moveEvent.clientY - startY;
        el.style.left = `${item.x}px`;
        el.style.top = `${item.y}px`;
        expandBoard();
      };

      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.classList.remove('dragging');
        saveItem(item);
      };

      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });

    handle.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      select(el);

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = item.width;
      const startHeight = item.height || 120;
      const ratio = startHeight / startWidth;
      handle.setPointerCapture(event.pointerId);

      const move = moveEvent => {
        if (isNote || isAudio) {
          item.width = Math.max(80, startWidth + moveEvent.clientX - startX);
          item.height = Math.max(48, startHeight + moveEvent.clientY - startY);
          el.style.width = `${item.width}px`;
          el.style.height = `${item.height}px`;
        } else {
          item.width = Math.max(80, startWidth + moveEvent.clientX - startX);
          item.height = item.width * ratio;
          el.style.width = `${item.width}px`;
        }
        expandBoard();
      };

      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        saveItem(item);
      };

      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });

    deleteButton.addEventListener('click', async event => {
      event.stopPropagation();
      try {
        if (media) {
          media.pause();
          audibleMedia.delete(media);
        }
        const paths = [item.storagePath, item.cutoutPath].filter(Boolean);
        if (paths.length) {
          const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
          if (error) throw error;
        }
        const { error } = await supabase
          .from('board_items')
          .delete()
          .eq('id', item.id)
          .eq('board', boardName);
        if (error) throw error;
        state.items = state.items.filter(current => current.id !== item.id);
        el.remove();
        expandBoard();
      } catch (error) {
        console.error(error);
        alert('That item could not be deleted. Nothing was removed.');
      }
    });

    controls.addEventListener('pointerdown', event => event.stopPropagation());
  }

  function select(el) {
    document.querySelectorAll('.image-item.selected, .note-item.selected, .media-item.selected')
      .forEach(node => node.classList.remove('selected'));
    el.classList.add('selected');
  }

  board.addEventListener('pointerdown', event => {
    if (event.target === board) {
      document.querySelectorAll('.image-item.selected, .note-item.selected, .media-item.selected')
        .forEach(node => node.classList.remove('selected'));
    }
  });

  const noteButton = document.getElementById('noteButton');
  if (noteButton) {
    noteButton.addEventListener('click', async () => {
      const width = 220;
      const height = 120;
      const offset = 24 + (state.items.length % 8) * 18;
      try {
        await addItem({ type: 'note', text: '', width, height, x: offset, y: offset });
        const newest = state.items[state.items.length - 1];
        const text = document.querySelector(`[data-id="${CSS.escape(newest.id)}"] .note-text`);
        if (text) {
          text.focus();
          text.select();
        }
      } catch (error) {
        console.error(error);
        alert(error?.message ? `That note could not be added.\n\n${error.message}` : 'That note could not be added.');
      }
    });
  }

  input.addEventListener('change', async () => {
    for (const file of [...input.files]) {
      try {
        await uploadThing(file);
      } catch (error) {
        console.error(error);
        alert(error?.message ? `That thing could not be uploaded.\n\n${error.message}` : 'That thing could not be uploaded.');
      }
    }
    input.value = '';
  });

  async function uploadThing(file) {
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isAudio && !isVideo) throw new Error('Unsupported file type.');

    const type = isAudio ? 'audio' : isVideo ? 'video' : 'image';
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const ext = (file.name.split('.').pop() || 'bin')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'bin';
    const storagePath = `${boardName}/${id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    let width = 300;
    let height = 62;
    const objectUrl = URL.createObjectURL(file);

    try {
      if (isImage) {
        const size = await imageSize(objectUrl);
        const maxWidth = Math.min(500, window.innerWidth * 0.45);
        width = Math.min(size.width, maxWidth);
        height = width * size.height / size.width;
      } else if (isVideo) {
        const size = await videoSize(objectUrl);
        const maxWidth = Math.min(520, window.innerWidth * 0.55);
        width = Math.min(size.width || 420, maxWidth);
        height = width * (size.height || 236) / (size.width || 420);
      } else {
        width = Math.min(260, window.innerWidth * 0.55);
        height = 62;
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }

    const offset = 20 + (state.items.length % 8) * 18;
    try {
      await addItem({ id, type, storagePath, width, height, x: offset, y: offset });
    } catch (error) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw error;
    }
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

  function imageSize(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
      image.src = src;
    });
  }

  function expandBoard() {
    let requiredHeight = window.innerHeight;
    for (const item of state.items) {
      requiredHeight = Math.max(requiredHeight, item.y + item.height + 80);
    }
    board.style.minHeight = `${Math.ceil(requiredHeight)}px`;
  }

  load();
})();
