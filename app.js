import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(() => {
  const params = new URLSearchParams(location.search);
  const boardParam = params.get("board");
  const boardName = /^[a-z0-9_-]{1,80}$/i.test(boardParam || "") ? boardParam.toLowerCase() : "husbond";

  const board = document.getElementById("board");
  const input = document.getElementById("fileInput");
  const addImageButton = document.querySelector('.add-action input[type="file"]')?.closest('label');

  let state = { items: [] };
  let zCounter = 0;
  let saveQueue = Promise.resolve();

  async function ensureSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.session;
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
        .eq('board', boardName)
        .order('z', { ascending: true });

      if (error) throw error;

      const items = data || [];

      // Generate fresh signed URLs every time the board opens. The stored
      // original is the Supabase Storage object, not a temporary URL.
      for (const item of items) {
        if (item.storage_path) {
          const { data: signed, error: signError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(item.storage_path, 60 * 60);
          if (signError) throw signError;
          item.src = signed.signedUrl;
        }
      }

      items.forEach(item => { item.storagePath = item.storage_path; item.ageSeed = item.age_seed; });
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
          x: item.x, y: item.y, width: item.width, height: item.height,
          grayscale: item.grayscale || 0,
          aged: !!item.aged,
          age_seed: item.ageSeed ?? null,
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
      aged: false,
      age_seed: null,
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
      const { data: signed, error: signError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(saved.storage_path, 60 * 60);
      if (signError) throw signError;
      saved.src = signed.signedUrl;
    }

    // Normalize Supabase snake_case to the names used by the renderer.
    saved.storagePath = saved.storage_path;
    saved.ageSeed = saved.age_seed;
    state.items.push(saved);
    renderItem(saved);
    expandBoard();
  }

  function renderAll() {
    board.innerHTML = "";
    state.items.forEach(renderItem);
    expandBoard();
  }

  function renderItem(item) {
    const el = document.createElement("div");
    el.className = item.type === "note" ? "note-item" : "image-item";
    if (item.type === "note") el.classList.add("object-item");
    el.dataset.id = item.id;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    el.style.width = `${item.width}px`;
    if (item.type === "note") el.style.height = `${item.height || 120}px`;
    el.style.zIndex = item.z || 1;

    let img = null;
    let textArea = null;
    if (item.type === "note") {
      textArea = document.createElement("textarea");
      textArea.className = "note-text";
      textArea.value = item.text || "";
      textArea.placeholder = "";
      textArea.spellcheck = false;
      textArea.addEventListener("input", () => {
        item.text = textArea.value;
        saveItem(item);
        expandBoard();
      });
    } else {
      img = document.createElement("img");
      img.src = item.src;
      img.alt = "";
      img.draggable = false;
    }

    const handle = document.createElement("div");
    handle.className = "resize-handle";

    const controls = document.createElement("div");
    controls.className = "image-controls";

    const grayWrap = document.createElement("div");
    grayWrap.className = "gray-wrap";

    const grayButton = document.createElement("button");
    grayButton.type = "button";
    grayButton.className = "control gray-button";
    grayButton.textContent = "○";
    grayButton.title = "saturation";

    const slider = document.createElement("div");
    slider.className = "gray-slider";

    const grayInput = document.createElement("input");
    grayInput.type = "range";
    grayInput.min = "0";
    grayInput.max = "100";
    grayInput.value = String(item.grayscale || 0);
    grayInput.setAttribute("aria-label", "Saturation reduction");

    slider.appendChild(grayInput);
    grayWrap.append(grayButton, slider);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "control delete-control";
    deleteButton.textContent = "×";
    deleteButton.title = "delete";

    const ageButton = document.createElement("button");
    ageButton.type = "button";
    ageButton.className = "control age-button";
    ageButton.title = "age photograph";
    ageButton.setAttribute("aria-label", "Age photograph");
    ageButton.innerHTML = `
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5.2 3.2h9.5M5.4 16.8h9.4M7.1 3.5l5.8 6.2-5.8 6.1M12.9 3.5L7.1 9.7l5.8 6.1"
          fill="none" stroke="currentColor" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    controls.append(grayWrap, deleteButton, ageButton);
    if (textArea) el.append(textArea, handle, controls); else el.append(img, handle, controls);
    board.appendChild(el);

    // The image starts as the original. If already aged, generate the same
    // deterministic aged variation from its saved seed.
    if (img) {
      img.addEventListener("load", async () => {
        if (item.aged && item.ageSeed != null) {
          await applyAging(item, img);
        } else {
          applySaturation();
        }
      }, { once: true });
    }

    applySaturation();

    function applySaturation() {
      const g = item.grayscale || 0;
      if (img) img.style.filter = `grayscale(${g}%)`;
      if (textArea) textArea.style.filter = item.aged ? `grayscale(${g}%) sepia(22%) contrast(96%)` : `grayscale(${g}%)`;
    }

    function bringForward() {
      select(el);
      item.z = ++zCounter;
      el.style.zIndex = item.z;
    }

    function beginObjectDrag(event) {
      event.preventDefault();
      bringForward();

      const startX = event.clientX;
      const startY = event.clientY;
      const originalX = item.x;
      const originalY = item.y;

      el.classList.add("dragging");
      el.setPointerCapture(event.pointerId);

      const move = e => {
        item.x = originalX + e.clientX - startX;
        item.y = originalY + e.clientY - startY;
        el.style.left = `${item.x}px`;
        el.style.top = `${item.y}px`;
        expandBoard();
      };

      const up = () => {
        el.classList.remove("dragging");
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        saveItem(item);
      };

      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
    }

    el.addEventListener("pointerdown", event => {
      if (event.target === handle ||
          event.target === textArea ||
          grayWrap.contains(event.target) ||
          event.target === deleteButton ||
          ageButton.contains(event.target)) return;

      beginObjectDrag(event);
    });

    if (textArea) {
      textArea.addEventListener("pointerdown", event => {
        if (event.button !== undefined && event.button !== 0) return;

        event.stopPropagation();
        bringForward();

        const startX = event.clientX;
        const startY = event.clientY;
        const originalX = item.x;
        const originalY = item.y;
        let dragging = false;

        const move = e => {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;

          if (!dragging && Math.hypot(dx, dy) >= 5) {
            dragging = true;
            textArea.blur();
            el.classList.add("dragging");
          }

          if (!dragging) return;

          e.preventDefault();
          item.x = originalX + dx;
          item.y = originalY + dy;
          el.style.left = `${item.x}px`;
          el.style.top = `${item.y}px`;
          expandBoard();
        };

        const up = () => {
          window.removeEventListener("pointermove", move, true);
          window.removeEventListener("pointerup", up, true);

          if (dragging) {
            el.classList.remove("dragging");
            saveItem(item);
          }
        };

        window.addEventListener("pointermove", move, true);
        window.addEventListener("pointerup", up, true);
      });
    }

    handle.addEventListener("pointerdown", event => {
      event.preventDefault();
      event.stopPropagation();
      bringForward();

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = item.width;
      const startHeight = item.height || el.getBoundingClientRect().height || 120;
      const ratio = startHeight / startWidth;

      handle.setPointerCapture(event.pointerId);

      const move = e => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (item.type === "note") {
          item.width = Math.max(80, startWidth + dx);
          item.height = Math.max(48, startHeight + dy);
          el.style.width = `${item.width}px`;
          el.style.height = `${item.height}px`;
        } else {
          item.width = Math.max(40, startWidth + dx);
          item.height = item.width * ratio;
          el.style.width = `${item.width}px`;
        }

        expandBoard();
      };

      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        saveItem(item);
      };

      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });

    grayButton.addEventListener("click", event => {
      event.stopPropagation();
      grayWrap.classList.toggle("open");
    });

    grayInput.addEventListener("input", event => {
      event.stopPropagation();
      // 0 at the top = full original saturation.
      // 100 at the bottom = completely grayscale.
      item.grayscale = Number(grayInput.value);
      applySaturation();
      saveItem(item);
    });

    deleteButton.addEventListener("click", async event => {
      event.stopPropagation();
      try {
        if (item.storagePath) {
          const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([item.storagePath]);
          if (storageError) throw storageError;
        }
        const { error } = await supabase.from('board_items').delete().eq('id', item.id).eq('board', boardName);
        if (error) throw error;
        state.items = state.items.filter(x => x.id !== item.id);
        el.remove();
        expandBoard();
      } catch (error) {
        console.error(error);
        alert("The image could not be deleted. Nothing was removed.");
      }
    });

    ageButton.addEventListener("click", async event => {
      event.stopPropagation();

      // True two-state toggle:
      // first click = generate one random aging recipe from the pristine source;
      // second click = remove the aging treatment and restore the uploaded image.
      // The independent saturation setting is preserved.
      ageButton.classList.add("working");

      if (item.aged) {
        item.aged = false;
        item.ageSeed = null;
        if (img) img.src = item.src;
        applySaturation();
      } else {
        item.aged = true;
        item.ageSeed = makeSeed();
        if (img) await applyAging(item, img);
        else applySaturation();
      }

      ageButton.classList.remove("working");
      updateAgeButton();
      saveItem(item);
    });

    function updateAgeButton() {
      ageButton.title = item.aged ? "restore original" : "age photograph";
      ageButton.setAttribute("aria-label", item.aged ? "Restore original photograph" : "Age photograph");
      ageButton.classList.toggle("aged", !!item.aged);
    }

    updateAgeButton();

    controls.addEventListener("pointerdown", event => {
      event.stopPropagation();
    });
  }

  function clearSelection() {
    document.querySelectorAll(".image-item.selected, .note-item.selected")
      .forEach(node => node.classList.remove("selected"));
  }

  function select(el) {
    clearSelection();
    el.classList.add("selected");
  }

  board.addEventListener("pointerdown", event => {
    if (event.target === board) clearSelection();
  });

  document.addEventListener("pointerdown", event => {
    if (!event.target.closest(".image-item, .note-item, .board-actions, .home-icon")) {
      clearSelection();
    }
  }, true);

  const noteButton = document.getElementById("noteButton");
  if (noteButton) {
    noteButton.addEventListener("click", async () => {
      const width = 220;
      const height = 120;
      const offset = 24 + (state.items.length % 8) * 18;
      try {
        await addItem({ type: "note", text: "", width, height, x: offset, y: offset });
        const newest = state.items[state.items.length - 1];
        const el = document.querySelector(`[data-id="${CSS.escape(newest.id)}"] .note-text`);
        if (el) { el.focus(); el.select(); }
      } catch (error) {
        console.error(error);
        alert(error?.message ? `That note could not be added.\n\n${error.message}` : 'That note could not be added.');
      }
    });
  }

  input.addEventListener("change", async () => {
    for (const file of [...input.files]) {
      if (!file.type.startsWith("image/")) continue;

      try {
        await uploadImage(file);
      } catch (error) {
        console.error(error);
        alert(error?.message ? `That image could not be uploaded.\n\n${error.message}` : 'That image could not be uploaded.');
      }
    }
    input.value = "";
  });

  async function uploadImage(file) {
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const storagePath = `${boardName}/${id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const objectUrl = URL.createObjectURL(file);
    const size = await imageSize(objectUrl);
    URL.revokeObjectURL(objectUrl);

    const maxWidth = Math.min(500, window.innerWidth * 0.45);
    const width = Math.min(size.width, maxWidth);
    const height = width * size.height / size.width;
    const offset = 20 + (state.items.length % 8) * 18;

    try {
      await addItem({ id, storagePath, width, height, x: offset, y: offset });
    } catch (error) {
      // If the metadata insert fails, remove the just-uploaded object so there is no orphan.
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw error;
    }
  }

  function expandBoard() {
    let requiredHeight = window.innerHeight;
    for (const item of state.items) {
      requiredHeight = Math.max(requiredHeight, item.y + item.height + 80);
    }
    board.style.minHeight = `${Math.ceil(requiredHeight)}px`;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
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

  function makeSeed() {
    if (crypto.getRandomValues) {
      const a = new Uint32Array(2);
      crypto.getRandomValues(a);
      return (a[0] ^ a[1]) >>> 0;
    }
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }

  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s += 0x6D2B79F5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  async function applyAging(item, img) {
    if (!img.complete || !img.naturalWidth) {
      await new Promise(resolve => img.addEventListener("load", resolve, { once: true }));
    }

    // Always build from the pristine uploaded source. Fetching it as a Blob
    // keeps the canvas origin-clean so the randomized aging pass can safely
    // read pixels and export the result even though Storage is on Supabase.
    const response = await fetch(item.src, { mode: "cors" });
    if (!response.ok) throw new Error(`Could not load the original photograph (${response.status}).`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      const source = new Image();
      source.src = objectUrl;
      if (!source.complete || !source.naturalWidth) {
        await new Promise((resolve, reject) => {
          source.addEventListener("load", resolve, { once: true });
          source.addEventListener("error", reject, { once: true });
        });
      }

      const agedUrl = buildAgedImage(source, item.ageSeed);
      img.src = agedUrl;
      img.style.filter = `grayscale(${item.grayscale || 0}%)`;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function buildAgedImage(img, seed) {
    const maxDim = 1800;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);

    const rand = seeded(seed);
    const q = (a, b) => a + (b - a) * rand();

    // Layer 1: one coherent photographic character.
    const styles = [
      {
        name: "film-noir",
        saturation: [0.03, 0.12],
        contrast: [1.12, 1.30],
        exposure: [-0.06, 0.01],
        warmth: [-0.01, 0.025],
        softness: [0.00, 0.018],
        grain: [0.035, 0.085],
        vignette: [0.06, 0.16]
      },
      {
        name: "brownie-camera",
        saturation: [0.60, 0.86],
        contrast: [0.84, 0.98],
        exposure: [-0.02, 0.05],
        warmth: [0.045, 0.12],
        softness: [0.018, 0.045],
        grain: [0.045, 0.10],
        vignette: [0.08, 0.22]
      },
      {
        name: "tintype",
        saturation: [0.00, 0.06],
        contrast: [1.02, 1.22],
        exposure: [-0.08, 0.00],
        warmth: [-0.015, 0.02],
        softness: [0.00, 0.012],
        grain: [0.045, 0.095],
        vignette: [0.10, 0.24]
      },
      {
        name: "silver-plate",
        saturation: [0.00, 0.05],
        contrast: [0.95, 1.15],
        exposure: [-0.02, 0.06],
        warmth: [-0.02, 0.012],
        softness: [0.005, 0.02],
        grain: [0.025, 0.065],
        vignette: [0.04, 0.14]
      },
      {
        name: "hollywood-glamour",
        saturation: [0.65, 0.90],
        contrast: [0.82, 0.97],
        exposure: [0.00, 0.08],
        warmth: [0.025, 0.075],
        softness: [0.035, 0.075],
        grain: [0.018, 0.045],
        vignette: [0.025, 0.10]
      },
      {
        name: "faded-color-print",
        saturation: [0.48, 0.76],
        contrast: [0.76, 0.94],
        exposure: [-0.015, 0.045],
        warmth: [0.035, 0.10],
        softness: [0.008, 0.025],
        grain: [0.025, 0.065],
        vignette: [0.025, 0.12]
      },
      {
        name: "old-black-and-white",
        saturation: [0.00, 0.04],
        contrast: [0.92, 1.12],
        exposure: [-0.03, 0.03],
        warmth: [-0.008, 0.015],
        softness: [0.00, 0.018],
        grain: [0.055, 0.11],
        vignette: [0.04, 0.15]
      },
      {
        name: "sepia-print",
        saturation: [0.12, 0.28],
        contrast: [0.82, 1.02],
        exposure: [-0.02, 0.04],
        warmth: [0.075, 0.16],
        softness: [0.008, 0.025],
        grain: [0.035, 0.08],
        vignette: [0.04, 0.16]
      },
      {
        name: "early-color-film",
        saturation: [0.48, 0.80],
        contrast: [0.84, 1.03],
        exposure: [-0.04, 0.05],
        warmth: [-0.015, 0.075],
        softness: [0.01, 0.035],
        grain: [0.035, 0.09],
        vignette: [0.03, 0.14]
      }
    ];

    const style = styles[Math.floor(rand() * styles.length)];
    const saturation = q(...style.saturation);
    const contrast = q(...style.contrast);
    const exposure = q(...style.exposure);
    const warmth = q(...style.warmth);
    const softness = q(...style.softness);
    const grain = q(...style.grain);
    const vignette = q(...style.vignette);

    // Slight blur/diffusion for period optics, before the pixel treatment.
    if (softness > 0.002) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.34, softness * 4.5);
      ctx.filter = `blur(${Math.max(0.25, Math.min(2.2, softness * Math.min(w, h)))}px)`;
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
    }

    const pixels = ctx.getImageData(0, 0, w, h);
    const d = pixels.data;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] / 255;
      let g = d[i + 1] / 255;
      let b = d[i + 2] / 255;

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const n = (rand() - 0.5) * grain;

      // Style-specific saturation.
      r = lum + (r - lum) * saturation;
      g = lum + (g - lum) * saturation;
      b = lum + (b - lum) * saturation;

      // Mild, non-uniform color response.
      r += warmth + n;
      g += warmth * 0.60 + n;
      b -= warmth * 0.42 - n * 0.25;

      r = (r - 0.5) * contrast + 0.5 + exposure;
      g = (g - 0.5) * contrast + 0.5 + exposure;
      b = (b - 0.5) * contrast + 0.5 + exposure;

      d[i] = Math.max(0, Math.min(255, r * 255));
      d[i + 1] = Math.max(0, Math.min(255, g * 255));
      d[i + 2] = Math.max(0, Math.min(255, b * 255));
    }

    ctx.putImageData(pixels, 0, 0);

    // Subtle, irregular exposure/fading rather than the previous bright center.
    const wash = ctx.createRadialGradient(
      q(w * 0.25, w * 0.75), q(h * 0.20, h * 0.80), 0,
      q(w * 0.25, w * 0.75), q(h * 0.20, h * 0.80), Math.max(w, h) * q(0.42, 0.75)
    );
    wash.addColorStop(0, `rgba(255,242,215,${q(0.00, 0.045)})`);
    wash.addColorStop(0.65, `rgba(255,242,215,${q(0.00, 0.02)})`);
    wash.addColorStop(1, "rgba(255,242,215,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    // Very restrained vignette, only where the selected photographic style calls for it.
    const vg = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.32,
      w / 2, h / 2, Math.max(w, h) * 0.78
    );
    vg.addColorStop(0, "rgba(30,22,15,0)");
    vg.addColorStop(1, `rgba(30,22,15,${vignette})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    // Layer 2: physical wear. Each is independently optional.
    if (rand() < 0.72) addFilmGrain(ctx, w, h, rand, q);
    if (rand() < 0.62) addDust(ctx, w, h, rand, q);
    if (rand() < 0.38) addScratches(ctx, w, h, rand, q);
    if (rand() < 0.26) addWrinkles(ctx, w, h, rand, q);
    if (rand() < 0.19) addCrease(ctx, w, h, rand, q);
    if (rand() < 0.33) addEdgeWear(ctx, w, h, rand, q);
    if (rand() < 0.10) addSmallTear(ctx, w, h, rand, q);
    if (rand() < 0.16) addDiscoloration(ctx, w, h, rand, q);

    return canvas.toDataURL("image/jpeg", 0.92);
  }

  function addFilmGrain(ctx, w, h, rand, q) {
    const count = Math.max(900, Math.floor(w * h / q(120, 240)));
    ctx.save();
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const size = q(0.35, 1.25) * Math.max(1, Math.min(w, h) / 900);
      const v = rand() < 0.52 ? q(70, 155) : q(175, 235);
      ctx.fillStyle = `rgba(${v},${v},${v},${q(0.018, 0.07)})`;
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }

  function addDust(ctx, w, h, rand, q) {
    const count = Math.max(8, Math.floor(w * h / q(45000, 80000)));
    ctx.save();
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = q(0.25, 1.7) * Math.max(1, Math.min(w, h) / 850);
      const dark = rand() < 0.58;
      const c = dark ? q(20, 65) : q(190, 245);
      ctx.fillStyle = `rgba(${c},${Math.max(0,c-5)},${Math.max(0,c-12)},${q(0.04,0.15)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function addScratches(ctx, w, h, rand, q) {
    const count = Math.floor(q(1, 7));
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = q(h * 0.035, h * 0.22);
      const dx = q(-w * 0.012, w * 0.012);
      const c = rand() < 0.5 ? 238 : 42;
      ctx.strokeStyle = `rgba(${c},${Math.max(0,c-10)},${Math.max(0,c-18)},${q(0.025,0.11)})`;
      ctx.lineWidth = q(0.35, 1.2) * Math.max(1, w / 900);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, Math.min(h, y + len));
      ctx.stroke();
    }
    ctx.restore();
  }

  function addWrinkles(ctx, w, h, rand, q) {
    const count = Math.floor(q(1, 4));
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < count; i++) {
      const x = q(w * 0.08, w * 0.92);
      const y = q(h * 0.08, h * 0.92);
      const length = q(Math.min(w, h) * 0.12, Math.min(w, h) * 0.42);
      const angle = q(-Math.PI, Math.PI);
      const x2 = x + Math.cos(angle) * length;
      const y2 = y + Math.sin(angle) * length;

      ctx.strokeStyle = `rgba(55,40,28,${q(0.035,0.085)})`;
      ctx.lineWidth = q(0.8, 2.0) * Math.max(1, w / 1000);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        (x + x2) / 2 + q(-w * 0.03, w * 0.03),
        (y + y2) / 2 + q(-h * 0.03, h * 0.03),
        x2, y2
      );
      ctx.stroke();

      ctx.strokeStyle = `rgba(245,235,215,${q(0.025,0.07)})`;
      ctx.lineWidth *= 0.55;
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 1);
      ctx.quadraticCurveTo(
        (x + x2) / 2 + q(-w * 0.025, w * 0.025),
        (y + y2) / 2 + q(-h * 0.025, h * 0.025),
        x2 + 1, y2 - 1
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function addCrease(ctx, w, h, rand, q) {
    const x1 = q(w * 0.05, w * 0.95);
    const y1 = q(h * 0.05, h * 0.95);
    const x2 = q(w * 0.05, w * 0.95);
    const y2 = q(h * 0.05, h * 0.95);

    ctx.save();
    ctx.lineCap = "round";

    ctx.strokeStyle = `rgba(45,30,20,${q(0.08,0.16)})`;
    ctx.lineWidth = q(1.2, 3.0) * Math.max(1, Math.min(w,h) / 900);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(q(w*0.25,w*0.75), q(h*0.25,h*0.75), x2, y2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(250,242,225,${q(0.045,0.11)})`;
    ctx.lineWidth *= 0.5;
    ctx.beginPath();
    ctx.moveTo(x1 - 1, y1 - 1);
    ctx.quadraticCurveTo(q(w*0.25,w*0.75), q(h*0.25,h*0.75), x2 - 1, y2 - 1);
    ctx.stroke();

    ctx.restore();
  }

  function addEdgeWear(ctx, w, h, rand, q) {
    ctx.save();
    const amount = q(0.035, 0.10);
    const strips = [
      [0, 0, w, q(h*0.015,h*0.045)],
      [0, h-q(h*0.015,h*0.045), w, h],
      [0, 0, q(w*0.015,w*0.045), h],
      [w-q(w*0.015,w*0.045), 0, w, h]
    ];

    strips.forEach(([x1,y1,x2,y2]) => {
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, `rgba(65,42,24,${amount})`);
      g.addColorStop(0.55, `rgba(95,60,30,${amount*0.45})`);
      g.addColorStop(1, "rgba(65,42,24,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x1, y1, x2-x1, y2-y1);
    });

    // Small irregular worn nicks along the perimeter.
    const nicks = Math.floor(q(3, 12));
    for (let i = 0; i < nicks; i++) {
      const side = Math.floor(rand() * 4);
      let x, y;
      if (side === 0) { x = rand()*w; y = rand()*h*0.025; }
      else if (side === 1) { x = rand()*w; y = h-rand()*h*0.025; }
      else if (side === 2) { x = rand()*w*0.025; y = rand()*h; }
      else { x = w-rand()*w*0.025; y = rand()*h; }

      ctx.fillStyle = `rgba(70,45,25,${q(0.05,0.15)})`;
      ctx.beginPath();
      ctx.arc(x, y, q(0.6, 2.2) * Math.max(1, w/900), 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  function addSmallTear(ctx, w, h, rand, q) {
    const edge = Math.floor(rand() * 4);
    let x, y;
    if (edge === 0) { x = q(w*0.1,w*0.9); y = q(0,h*0.025); }
    else if (edge === 1) { x = q(w*0.1,w*0.9); y = q(h*0.975,h); }
    else if (edge === 2) { x = q(0,w*0.025); y = q(h*0.1,h*0.9); }
    else { x = q(w*0.975,w); y = q(h*0.1,h*0.9); }

    const len = q(Math.min(w,h)*0.015, Math.min(w,h)*0.055);
    const angle = q(-0.8,0.8);

    ctx.save();
    ctx.strokeStyle = `rgba(35,25,18,${q(0.10,0.20)})`;
    ctx.lineWidth = q(1,2.5);
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x+Math.cos(angle)*len, y+Math.sin(angle)*len);
    ctx.stroke();

    ctx.strokeStyle = `rgba(245,235,215,${q(0.05,0.12)})`;
    ctx.lineWidth *= 0.5;
    ctx.beginPath();
    ctx.moveTo(x+1,y-1);
    ctx.lineTo(x+Math.cos(angle)*len+1, y+Math.sin(angle)*len-1);
    ctx.stroke();
    ctx.restore();
  }

  function addDiscoloration(ctx, w, h, rand, q) {
    const patches = Math.floor(q(1, 4));
    ctx.save();
    for (let i = 0; i < patches; i++) {
      const x = q(w*0.08,w*0.92);
      const y = q(h*0.08,h*0.92);
      const rx = q(w*0.025,w*0.12);
      const ry = q(h*0.02,h*0.10);
      const g = ctx.createRadialGradient(x,y,0,x,y,Math.max(rx,ry));
      g.addColorStop(0, `rgba(110,75,35,${q(0.025,0.08)})`);
      g.addColorStop(0.72, `rgba(125,85,42,${q(0.015,0.05)})`);
      g.addColorStop(1, "rgba(125,85,42,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x,y,rx,ry,q(-Math.PI,Math.PI),0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  load();
})();
