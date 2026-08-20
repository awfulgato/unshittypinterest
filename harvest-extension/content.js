(() => {
  const MIN_IMAGE_SIZE = 28;
  let active = false;
  let busy = false;
  let currentKind = null;
  let currentImage = null;
  let currentText = null;
  let selectionTimer = null;

  const segl = document.createElement('button');
  segl.type = 'button';
  segl.id = 'eskja-segl';
  segl.setAttribute('aria-label', 'segl this thing');
  segl.textContent = 'S';
  document.documentElement.appendChild(segl);

  const activeMarker = document.createElement('div');
  activeMarker.id = 'eskja-segl-active';
  activeMarker.textContent = 'SEGL';
  document.documentElement.appendChild(activeMarker);

  browser.runtime.onMessage.addListener(message => {
    if (message?.type === 'segl-set-active') {
      setActive(!!message.active);
      return Promise.resolve({ ok: true, active });
    }
    return undefined;
  });

  browser.runtime.sendMessage({ type: 'segl-status' })
    .then(result => setActive(!!result?.active))
    .catch(() => setActive(false));

  document.addEventListener('pointerover', event => {
    if (!active || busy) return;
    const image = event.target?.closest?.('img');
    if (!image || image === segl || image.closest?.('#eskja-segl')) return;
    if (!isUsableImage(image)) return;
    currentKind = 'image';
    currentImage = image;
    currentText = null;
    showForImage(image);
  }, true);

  document.addEventListener('pointermove', event => {
    if (!active || busy || currentKind !== 'image' || !currentImage) return;
    if (event.target === segl || segl.contains(event.target)) return;
    const rect = currentImage.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      hideSegl();
    }
  }, true);

  document.addEventListener('selectionchange', () => {
    if (!active || busy || currentKind === 'image') return;
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(updateTextSelection, 35);
  }, true);

  document.addEventListener('pointerup', event => {
    if (!active || busy || event.target === segl || segl.contains(event.target)) return;
    setTimeout(updateTextSelection, 0);
  }, true);

  document.addEventListener('keyup', () => {
    if (!active || busy) return;
    setTimeout(updateTextSelection, 0);
  }, true);

  window.addEventListener('scroll', () => {
    if (!active || busy) return;
    if (currentKind === 'image' && currentImage) showForImage(currentImage);
    else if (currentKind === 'text') updateTextSelection();
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (!active || busy) return;
    if (currentKind === 'image' && currentImage) showForImage(currentImage);
    else if (currentKind === 'text') updateTextSelection();
  }, { passive: true });

  segl.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
  });

  segl.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (!active || busy || !currentKind) return;

    busy = true;
    segl.classList.add('working');
    segl.textContent = 'S';

    try {
      let result;
      if (currentKind === 'image' && currentImage) {
        result = await browser.runtime.sendMessage(buildImageMessage(currentImage));
      } else if (currentKind === 'text' && currentText?.text) {
        result = await browser.runtime.sendMessage({
          type: 'segl-text',
          text: currentText.text,
          pageUrl: location.href,
          pageTitle: document.title || ''
        });
      }

      if (result?.ok) {
        segl.classList.remove('failed');
        segl.classList.add('kept');
        segl.textContent = '✓';
        setTimeout(() => {
          segl.classList.remove('kept');
          hideSegl();
        }, 650);
      } else {
        throw new Error(result?.reason || 'could not keep thing');
      }
    } catch (error) {
      console.error('Segl failed', error);
      segl.classList.add('failed');
      segl.textContent = '×';
    } finally {
      busy = false;
      segl.classList.remove('working');
    }
  });

  function setActive(next) {
    active = next;
    activeMarker.classList.toggle('visible', active);
    document.documentElement.classList.toggle('eskja-segl-on', active);
    if (!active) hideSegl();
  }

  function isUsableImage(image) {
    const rect = image.getBoundingClientRect();
    return rect.width >= MIN_IMAGE_SIZE && rect.height >= MIN_IMAGE_SIZE && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  }

  function showForImage(image) {
    if (!active || !isUsableImage(image)) return hideSegl();
    const rect = image.getBoundingClientRect();
    showAt(rect.left + 8, rect.top + 8);
  }

  function updateTextSelection() {
    if (!active || busy) return;
    const selection = window.getSelection();
    const text = selection?.toString?.().trim() || '';
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !text) {
      if (currentKind === 'text') hideSegl();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return;

    currentKind = 'text';
    currentImage = null;
    currentText = { text };
    showAt(rect.right + 6, rect.top - 2);
  }

  function showAt(left, top) {
    const x = Math.max(6, Math.min(innerWidth - 38, left));
    const y = Math.max(6, Math.min(innerHeight - 38, top));
    segl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    segl.classList.remove('failed', 'kept');
    segl.textContent = 'S';
    segl.classList.add('visible');
  }

  function hideSegl() {
    currentKind = null;
    currentImage = null;
    currentText = null;
    segl.classList.remove('visible', 'failed', 'kept', 'working');
    segl.textContent = 'S';
  }

  function buildImageMessage(image) {
    const rect = image.getBoundingClientRect();
    return {
      type: 'segl-image',
      pageUrl: location.href,
      pageTitle: document.title || '',
      candidates: collectImageCandidates(image),
      naturalWidth: image.naturalWidth || rect.width,
      naturalHeight: image.naturalHeight || rect.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      rect: {
        left: Math.max(0, rect.left),
        top: Math.max(0, rect.top),
        width: Math.max(1, Math.min(rect.width, innerWidth - Math.max(0, rect.left))),
        height: Math.max(1, Math.min(rect.height, innerHeight - Math.max(0, rect.top)))
      }
    };
  }

  function collectImageCandidates(image) {
    const found = new Map();

    const add = (rawUrl, meta = {}) => {
      if (!rawUrl) return;
      let url;
      try { url = new URL(String(rawUrl).trim(), location.href); }
      catch (_) { return; }
      if (!/^https?:$/i.test(url.protocol)) return;
      const key = url.href;
      const candidate = {
        url: key,
        declaredWidth: Number(meta.declaredWidth) || 0,
        density: Number(meta.density) || 0,
        priority: Number(meta.priority) || 0,
        source: meta.source || 'unknown'
      };
      const old = found.get(key);
      if (!old || candidateScore(candidate) > candidateScore(old)) found.set(key, candidate);
    };

    const addSrcset = (value, source, priority) => {
      if (!value) return;
      for (const rawPart of String(value).split(',')) {
        const part = rawPart.trim();
        if (!part) continue;
        const bits = part.split(/\s+/);
        const url = bits.shift();
        let declaredWidth = 0;
        let density = 0;
        for (const descriptor of bits) {
          if (/^\d+(?:\.\d+)?w$/i.test(descriptor)) declaredWidth = parseFloat(descriptor);
          if (/^\d+(?:\.\d+)?x$/i.test(descriptor)) density = parseFloat(descriptor);
        }
        add(url, { declaredWidth, density, priority, source });
      }
    };

    const picture = image.closest('picture');
    if (picture) {
      for (const sourceEl of picture.querySelectorAll('source')) {
        const media = sourceEl.getAttribute('media');
        if (media) {
          try { if (!matchMedia(media).matches) continue; }
          catch (_) {}
        }
        addSrcset(sourceEl.getAttribute('srcset'), 'picture-srcset', 85);
        addSrcset(sourceEl.getAttribute('data-srcset'), 'picture-data-srcset', 90);
        add(sourceEl.getAttribute('src'), { source: 'picture-src', priority: 75 });
      }
    }

    addSrcset(image.getAttribute('srcset'), 'img-srcset', 80);
    addSrcset(image.getAttribute('data-srcset'), 'img-data-srcset', 90);
    add(image.getAttribute('data-original'), { source: 'data-original', priority: 95 });
    add(image.getAttribute('data-full'), { source: 'data-full', priority: 95 });
    add(image.getAttribute('data-image'), { source: 'data-image', priority: 90 });
    add(image.getAttribute('data-src'), { source: 'data-src', priority: 88 });
    add(image.getAttribute('data-lazy-src'), { source: 'data-lazy-src', priority: 86 });
    add(image.currentSrc, { source: 'currentSrc', priority: 70, declaredWidth: image.naturalWidth || 0 });
    add(image.src, { source: 'src', priority: 60, declaredWidth: image.naturalWidth || 0 });

    const link = image.closest('a[href]');
    if (link) {
      try {
        const linked = new URL(link.href, location.href);
        if (/\.(?:avif|gif|jpe?g|png|webp|svg)(?:$|[?#])/i.test(linked.href)) {
          add(linked.href, { source: 'linked-image', priority: 100 });
        }
      } catch (_) {}
    }

    return [...found.values()].sort((a, b) => candidateScore(b) - candidateScore(a));
  }

  function candidateScore(candidate) {
    return (candidate.priority || 0) * 1000000000 + (candidate.declaredWidth || 0) * 1000 + (candidate.density || 0);
  }
})();
