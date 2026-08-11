import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(() => {
  // Legacy URL/data vocabulary remains until the storeskja/eskja migration is complete.
  const params = new URLSearchParams(location.search);
  const legacyBoardParam = params.get('board');
  const legacyBoardName = /^[a-z0-9_-]{1,80}$/i.test(legacyBoardParam || '')
    ? legacyBoardParam.toLowerCase()
    : 'husbond';

  const eskja = document.getElementById('board');
  const input = document.getElementById('fileInput');
  let state = { things: [] };
  let zCounter = 0;
  let saveQueue = Promise.resolve();
  let activeAudibleElement = null;
  let backgroundModelPromise = null;

  async function ensureSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.session;
  }

  async function signedUrl(path) {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60 * 60);
    if (error) throw error;
    return data.signedUrl;
  }

  function normalizeThing(row) {
    row.storagePath = row.storage_path;
    row.cutoutStoragePath = row.cutout_storage_path;
    row.backgroundRemoved = !!row.background_removed;
    row.mimeType = row.mime_type || '';
    return row;
  }

  async function load() {
    try {
      if (!SUPABASE_URL || SUPABASE_URL.includes('PASTE_') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('PASTE_')) {
        throw new Error('Supabase configuration is missing.');
      }
      await ensureSession();

      const { data, error } = await supabase
        .from('board_items')
        .select('*')
        .eq('board', legacyBoardName)
        .order('z', { ascending: true });
      if (error) throw error;

      const things = data || [];
      for (const thing of things) {
        normalizeThing(thing);
        if (thing.storagePath) thing.src = await signedUrl(thing.storagePath);
        if (thing.cutoutStoragePath) thing.cutoutSrc = await signedUrl(thing.cutoutStoragePath);
      }

      state = { things };
      zCounter = Math.max(0, ...things.map(thing => thing.z || 0));
      renderAll();
    } catch (error) {
      console.error(error);
      eskja.innerHTML = '';
      const message = document.createElement('div');
      message.className = 'board-error';
      message.textContent = 'Could not load the eskja. Refresh and try again.';
      document.body.appendChild(message);
    }
  }

  function saveThing(thing) {
    saveQueue = saveQueue.then(async () => {
      const { error } = await supabase
        .from('board_items')
        .update({
          x: thing.x,
          y: thing.y,
          width: thing.width,
          height: thing.height,
          grayscale: thing.grayscale || 0,
          text: thing.text || '',
          z: thing.z || 1,
          mime_type: thing.mimeType || null,
          cutout_storage_path: thing.cutoutStoragePath || null,
          background_removed: !!thing.backgroundRemoved
        })
        .eq('id', thing.id)
        .eq('board', legacyBoardName);
      if (error) throw error;
    }).catch(error => console.error(error));
    return saveQueue;
  }

  async function addThing(data) {
    const thing = {
      id: data.id || crypto.randomUUID(),
      board: legacyBoardName,
      type: data.type || 'image',
      src: null,
      storage_path: data.storagePath || null,
      cutout_storage_path: null,
      background_removed: false,
      mime_type: data.mimeType || null,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      grayscale: 0,
      aged: false,
      age_seed: null,
      text: data.text || '',
      z: ++zCounter
    };

    const { data: saved, error } = await supabase.from('board_items').insert(thing).select('*').single();
    if (error) throw error;
    normalizeThing(saved);
    if (saved.storagePath) saved.src = await signedUrl(saved.storagePath);
    state.things.push(saved);
    renderThing(saved);
    expandEskja();
  }

  function renderAll() {
    eskja.innerHTML = '';
    state.things.forEach(renderThing);
    expandEskja();
  }

  function renderThing(thing) {
    const type = ['image', 'note', 'audio', 'video'].includes(thing.type) ? thing.type : 'image';
    const el = document.createElement('div');
    el.className = `${type}-item thing-item`;
    el.dataset.id = thing.id;
    el.style.left = `${thing.x}px`;
    el.style.top = `${thing.y}px`;
    el.style.width = `${thing.width}px`;
    el.style.height = `${thing.height}px`;
    el.style.zIndex = thing.z || 1;

    let media = null;
    let textArea = null;

    if (type === 'note') {
      textArea = document.createElement('textarea');
      textArea.className = 'note-text';
      textArea.value = thing.text || '';
      textArea.placeholder = '';
      textArea.spellcheck = false;
      textArea.addEventListener('input', () => {
        thing.text = textArea.value;
        saveThing(thing);
        expandEskja();
      });
      el.appendChild(textArea);
    } else if (type === 'image') {
      media = document.createElement('img');
      media.alt = '';
      media.draggable = false;
      media.src = thing.backgroundRemoved && thing.cutoutSrc ? thing.cutoutSrc : thing.src;
      media.addEventListener('load', applySaturation, { once: true });
      el.appendChild(media);
    } else if (type === 'audio') {
      media = document.createElement('audio');
      media.src = thing.src;
      media.preload = 'metadata';
      media.hidden = true;
      el.appendChild(media);
      el.appendChild(makeAudioTransport(media, thing, el));
    } else if (type === 'video') {
      media = document.createElement('video');
      media.src = thing.src;
      media.preload = 'metadata';
      media.playsInline = true;
      media.controls = false;
      media.draggable = false;
      media.addEventListener('loadedmetadata', applySaturation, { once: true });
      el.appendChild(media);
      el.appendChild(makeVideoTransport(media, thing, el));
    }

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    el.appendChild(handle);

    const controls = document.createElement('div');
    controls.className = 'image-controls';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'control delete-control';
    deleteButton.textContent = '×';
    deleteButton.title = 'delete';
    deleteButton.setAttribute('aria-label', 'delete');
    controls.appendChild(deleteButton);

    let grayWrap = null;
    if (type === 'image' || type === 'video') {
      grayWrap = makeSaturationControl();
      controls.appendChild(grayWrap.wrap);
    }

    let cutoutButton = null;
    if (type === 'image' && isStaticImage(thing)) {
      cutoutButton = makeCutoutButton();
      controls.appendChild(cutoutButton);
    }

    el.appendChild(controls);
    eskja.appendChild(el);
    applySaturation();

    function applySaturation() {
      if (!media || (type !== 'image' && type !== 'video')) return;
      media.style.filter = `grayscale(${thing.grayscale || 0}%)`;
    }

    function makeSaturationControl() {
      const wrap = document.createElement('div');
      wrap.className = 'gray-wrap';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'control gray-button';
      button.textContent = '○';
      button.title = 'saturation';
      const slider = document.createElement('div');
      slider.className = 'gray-slider';
      const range = document.createElement('input');
      range.type = 'range';
      range.min = '0';
      range.max = '100';
      range.value = String(thing.grayscale || 0);
      range.setAttribute('aria-label', 'Saturation reduction');
      slider.appendChild(range);
      wrap.append(button, slider);
      button.addEventListener('click', event => {
        event.stopPropagation();
        wrap.classList.toggle('open');
      });
      range.addEventListener('input', event => {
        event.stopPropagation();
        thing.grayscale = Number(range.value);
        applySaturation();
        saveThing(thing);
      });
      return { wrap, range };
    }

    function makeCutoutButton() {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'control cutout-button';
      button.title = thing.backgroundRemoved ? 'restore background' : 'remove background';
      button.setAttribute('aria-label', button.title);
      button.innerHTML = `
        <svg viewBox="0 0 22 20" aria-hidden="true">
          <path d="M3.5 3.3 8 1.9l4.2 2.3 1.2 4.5-2.4 3.8-4.6.7-3.3-2.8-.7-4.3Z"
                fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>
          <path d="m10.8 8.1 4-1.1 3.8 2.1 1 4-2.2 3.4-4 .6-3-2.4-.6-3.5Z" fill="currentColor"/>
        </svg>`;
      button.classList.toggle('active', !!thing.backgroundRemoved);
      button.addEventListener('click', async event => {
        event.stopPropagation();
        if (button.classList.contains('working')) return;
        button.classList.add('working');
        try {
          if (thing.backgroundRemoved) {
            thing.backgroundRemoved = false;
            media.src = thing.src;
          } else {
            if (!thing.cutoutSrc) await buildAndStoreCutout(thing);
            thing.backgroundRemoved = true;
            media.src = thing.cutoutSrc;
          }
          applySaturation();
          button.classList.toggle('active', !!thing.backgroundRemoved);
          button.title = thing.backgroundRemoved ? 'restore background' : 'remove background';
          button.setAttribute('aria-label', button.title);
          await saveThing(thing);
        } catch (error) {
          console.error(error);
          alert(error?.message ? `The background could not be removed.\n\n${error.message}` : 'The background could not be removed.');
        } finally {
          button.classList.remove('working');
        }
      });
      return button;
    }

    el.addEventListener('pointerdown', event => {
      if (event.target === handle ||
          event.target === textArea ||
          event.target.closest('button') ||
          event.target.closest('.gray-slider') ||
          event.target.closest('.video-timeline')) return;

      event.preventDefault();
      select(el);
      thing.z = ++zCounter;
      el.style.zIndex = thing.z;
      el.classList.add('dragging');

      const startX = event.clientX;
      const startY = event.clientY;
      const originalX = thing.x;
      const originalY = thing.y;
      el.setPointerCapture(event.pointerId);

      const move = e => {
        thing.x = originalX + e.clientX - startX;
        thing.y = originalY + e.clientY - startY;
        el.style.left = `${thing.x}px`;
        el.style.top = `${thing.y}px`;
        expandEskja();
      };
      const up = () => {
        el.classList.remove('dragging');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        saveThing(thing);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });

    handle.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      select(el);
      thing.z = ++zCounter;
      el.style.zIndex = thing.z;
      const startX = event.clientX;
      const startWidth = thing.width;
      const ratio = (thing.height || el.offsetHeight || 1) / Math.max(1, thing.width);
      handle.setPointerCapture(event.pointerId);
      const move = e => {
        const newWidth = Math.max(type === 'audio' ? 64 : 40, startWidth + e.clientX - startX);
        thing.width = newWidth;
        thing.height = newWidth * ratio;
        el.style.width = `${thing.width}px`;
        el.style.height = `${thing.height}px`;
        expandEskja();
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        saveThing(thing);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });

    deleteButton.addEventListener('click', async event => {
      event.stopPropagation();
      try {
        if (activeAudibleElement === media) activeAudibleElement = null;
        const paths = [thing.storagePath, thing.cutoutStoragePath].filter(Boolean);
        if (paths.length) {
          const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
          if (storageError) throw storageError;
        }
        const { error } = await supabase.from('board_items').delete().eq('id', thing.id).eq('board', legacyBoardName);
        if (error) throw error;
        state.things = state.things.filter(x => x.id !== thing.id);
        el.remove();
        expandEskja();
      } catch (error) {
        console.error(error);
        alert('The thing could not be deleted. Nothing was removed.');
      }
    });

    controls.addEventListener('pointerdown', event => event.stopPropagation());
  }

  function makeTransportButton(media, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `transport-button ${className}`.trim();
    button.setAttribute('aria-label', 'play');
    button.innerHTML = `
      <span class="source-ring ring-a"></span>
      <span class="source-ring ring-b"></span>
      <span class="transport-mark play-mark"></span>`;

    const setState = playing => {
      const mark = button.querySelector('.transport-mark');
      mark.className = `transport-mark ${playing ? 'isa-mark' : 'play-mark'}`;
      button.setAttribute('aria-label', playing ? 'pause' : 'play');
      button.title = playing ? 'pause' : 'play';
    };
    setState(false);
    media.addEventListener('play', () => setState(true));
    media.addEventListener('pause', () => setState(false));
    media.addEventListener('ended', () => setState(false));
    return { button, setState };
  }

  function makeAudioTransport(audio, thing, thingEl) {
    const body = document.createElement('div');
    body.className = 'audio-body';
    const { button } = makeTransportButton(audio, 'audio-transport-button');
    body.appendChild(button);
    let rippleTimer = null;

    const stopRippleLoop = () => {
      clearTimeout(rippleTimer);
      rippleTimer = null;
      body.querySelectorAll('.sound-ripple').forEach(node => node.remove());
    };

    const emitRipple = () => {
      if (audio.paused) return;
      const ring = document.createElement('span');
      const shape = 1 + Math.floor(Math.random() * 6);
      ring.className = `sound-ripple ripple-shape-${shape}`;
      body.appendChild(ring);
      ring.addEventListener('animationend', () => ring.remove(), { once: true });
      rippleTimer = setTimeout(emitRipple, 1700 + Math.random() * 600);
    };

    button.addEventListener('click', async event => {
      event.stopPropagation();
      select(thingEl);
      if (audio.paused) {
        claimVoice(audio);
        await audio.play();
      } else {
        audio.pause();
      }
    });
    audio.addEventListener('play', () => {
      stopRippleLoop();
      emitRipple();
    });
    audio.addEventListener('pause', stopRippleLoop);
    audio.addEventListener('ended', stopRippleLoop);
    return body;
  }

  function makeVideoTransport(video, thing, thingEl) {
    const transport = document.createElement('div');
    transport.className = 'video-transport';
    const { button } = makeTransportButton(video, 'video-transport-button');
    const timeline = document.createElement('div');
    timeline.className = 'video-timeline';
    timeline.setAttribute('aria-label', 'video position');
    const ripple = document.createElement('span');
    ripple.className = 'video-ripple ripple-shape-3';
    timeline.appendChild(ripple);
    transport.append(button, timeline);

    const updateTimeline = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const pct = Math.max(0, Math.min(100, (video.currentTime / duration) * 100));
      ripple.style.left = `${pct}%`;
    };
    video.addEventListener('timeupdate', updateTimeline);
    video.addEventListener('loadedmetadata', updateTimeline);

    button.addEventListener('click', async event => {
      event.stopPropagation();
      select(thingEl);
      if (video.paused) {
        claimVoice(video);
        await video.play();
      } else {
        video.pause();
      }
    });

    timeline.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      select(thingEl);
      const seek = e => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        const rect = timeline.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        video.currentTime = pct * video.duration;
        updateTimeline();
      };
      seek(event);
      timeline.setPointerCapture(event.pointerId);
      timeline.addEventListener('pointermove', seek);
      timeline.addEventListener('pointerup', () => timeline.removeEventListener('pointermove', seek), { once: true });
    });

    return transport;
  }

  function claimVoice(media) {
    if (activeAudibleElement && activeAudibleElement !== media && !activeAudibleElement.paused) {
      activeAudibleElement.pause();
    }
    activeAudibleElement = media;
  }

  function select(el) {
    document.querySelectorAll('.thing-item.selected').forEach(node => node.classList.remove('selected'));
    el.classList.add('selected');
  }

  eskja.addEventListener('pointerdown', event => {
    if (event.target === eskja) {
      document.querySelectorAll('.thing-item.selected').forEach(node => node.classList.remove('selected'));
    }
  });

  const noteButton = document.getElementById('noteButton');
  noteButton?.addEventListener('click', async () => {
    const offset = 24 + (state.things.length % 8) * 18;
    try {
      await addThing({ type: 'note', text: '', width: 220, height: 120, x: offset, y: offset });
      const newest = state.things[state.things.length - 1];
      const field = document.querySelector(`[data-id="${CSS.escape(newest.id)}"] .note-text`);
      if (field) { field.focus(); field.select(); }
    } catch (error) {
      console.error(error);
      alert(error?.message ? `That text could not be added.\n\n${error.message}` : 'That text could not be added.');
    }
  });

  input.addEventListener('change', async () => {
    for (const file of [...input.files]) {
      try {
        await uploadThing(file);
      } catch (error) {
        console.error(error);
        alert(error?.message ? `That thing could not be added.\n\n${error.message}` : 'That thing could not be added.');
      }
    }
    input.value = '';
  });

  async function uploadThing(file) {
    const type = thingTypeForFile(file);
    if (!type) throw new Error('Eskja does not know how to keep this file yet.');

    const id = crypto.randomUUID();
    const ext = (file.name.split('.').pop() || fallbackExtension(type)).toLowerCase().replace(/[^a-z0-9]/g, '') || fallbackExtension(type);
    const storagePath = `${legacyBoardName}/${id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (uploadError) throw uploadError;

    const offset = 20 + (state.things.length % 8) * 18;
    let width;
    let height;
    const objectUrl = URL.createObjectURL(file);
    try {
      if (type === 'image') {
        const size = await imageSize(objectUrl);
        const maxWidth = Math.min(500, window.innerWidth * 0.45);
        width = Math.min(size.width, maxWidth);
        height = width * size.height / size.width;
      } else if (type === 'video') {
        const size = await videoSize(objectUrl);
        const maxWidth = Math.min(520, window.innerWidth * 0.48);
        width = Math.min(size.width || 480, maxWidth);
        height = width * (size.height || 270) / Math.max(1, size.width || 480);
      } else {
        width = 92;
        height = 58;
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }

    try {
      await addThing({ id, type, storagePath, mimeType: file.type, width, height, x: offset, y: offset });
    } catch (error) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw error;
    }
  }

  function thingTypeForFile(file) {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    return null;
  }

  function fallbackExtension(type) {
    return type === 'audio' ? 'mp3' : type === 'video' ? 'mp4' : 'jpg';
  }

  function isStaticImage(thing) {
    if (thing.mimeType) return thing.mimeType.startsWith('image/') && thing.mimeType !== 'image/gif';
    return !/\.gif(?:$|\?)/i.test(thing.storagePath || thing.src || '');
  }

  async function buildAndStoreCutout(thing) {
    const blob = await removeBackgroundLocally(thing.src);
    const path = `${legacyBoardName}/${thing.id}-cutout.png`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, { contentType: 'image/png', upsert: true });
    if (error) throw error;
    thing.cutoutStoragePath = path;
    thing.cutoutSrc = await signedUrl(path);
  }

  async function getBackgroundModel() {
    if (!backgroundModelPromise) {
      backgroundModelPromise = (async () => {
        const lib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1');
        const modelId = 'Ko033/isnet-general-use-onnx';
        const model = await lib.AutoModel.from_pretrained(modelId, { dtype: 'q8' });
        const processor = await lib.AutoProcessor.from_pretrained(modelId);
        return { ...lib, model, processor };
      })();
    }
    return backgroundModelPromise;
  }

  async function removeBackgroundLocally(src) {
    const { model, processor, RawImage } = await getBackgroundModel();
    const raw = await RawImage.fromURL(src);
    const { pixel_values } = await processor(raw);
    const { output_image } = await model({ input_image: pixel_values });
    const mask = await RawImage
      .fromTensor(output_image[0].sigmoid().mul(255).to('uint8'))
      .resize(raw.width, raw.height);

    const sourceBlob = await fetch(src).then(response => {
      if (!response.ok) throw new Error('Could not read the original image.');
      return response.blob();
    });
    const bitmap = await createImageBitmap(sourceBlob);
    const canvas = document.createElement('canvas');
    canvas.width = raw.width;
    canvas.height = raw.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, raw.width, raw.height);
    bitmap.close?.();

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const alpha = mask.data;
    const channels = Math.max(1, Math.round(alpha.length / (canvas.width * canvas.height)));
    for (let i = 0; i < canvas.width * canvas.height; i++) {
      const matte = alpha[i * channels] ?? alpha[i] ?? 255;
      pixels.data[i * 4 + 3] = Math.round((pixels.data[i * 4 + 3] * matte) / 255);
    }
    ctx.putImageData(pixels, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the cutout image.')), 'image/png');
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

  function videoSize(src) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = reject;
      video.src = src;
    });
  }

  function expandEskja() {
    let requiredHeight = window.innerHeight;
    for (const thing of state.things) {
      requiredHeight = Math.max(requiredHeight, thing.y + thing.height + 80);
    }
    eskja.style.minHeight = `${Math.ceil(requiredHeight)}px`;
  }

  load();
})();
