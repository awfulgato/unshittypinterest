(() => {
  const MIN_SIZE = 36;
  let currentImage = null;
  let busy = false;

  const sickle = document.createElement('button');
  sickle.type = 'button';
  sickle.id = 'eskja-harvest-sickle';
  sickle.setAttribute('aria-label', 'gather image');
  sickle.innerHTML = normalSickle();
  document.documentElement.appendChild(sickle);

  document.addEventListener('pointerover', event => {
    const image = event.target?.closest?.('img');
    if (!image || image.closest('#eskja-harvest-sickle')) return;
    const rect = image.getBoundingClientRect();
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE || rect.bottom <= 0 || rect.top >= innerHeight) return;
    currentImage = image;
    showSickle(image);
  }, true);

  document.addEventListener('pointermove', event => {
    if (!currentImage || busy) return;
    if (event.target === sickle || sickle.contains(event.target)) return;
    if (event.target === currentImage || currentImage.contains?.(event.target)) return;
    const rect = currentImage.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) hideSickle();
  }, true);

  window.addEventListener('scroll', () => currentImage && showSickle(currentImage), { passive: true });
  window.addEventListener('resize', () => currentImage && showSickle(currentImage), { passive: true });

  sickle.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
  });

  sickle.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (!currentImage || busy) return;

    busy = true;
    sickle.classList.add('working');
    sickle.innerHTML = normalSickle();

    const rect = currentImage.getBoundingClientRect();
    const src = currentImage.currentSrc || currentImage.src || '';
    try {
      const result = await browser.runtime.sendMessage({
        type: 'harvest-image',
        src,
        pageUrl: location.href,
        naturalWidth: currentImage.naturalWidth || rect.width,
        naturalHeight: currentImage.naturalHeight || rect.height,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        rect: {
          left: Math.max(0, rect.left),
          top: Math.max(0, rect.top),
          width: Math.min(rect.width, innerWidth - Math.max(0, rect.left)),
          height: Math.min(rect.height, innerHeight - Math.max(0, rect.top))
        }
      });

      if (result?.ok) {
        sickle.classList.add('gathered');
        setTimeout(() => {
          sickle.classList.remove('gathered');
          hideSickle();
        }, 420);
      } else {
        sickle.classList.add('broken');
        sickle.innerHTML = brokenSickle();
      }
    } catch (error) {
      console.error(error);
      sickle.classList.add('broken');
      sickle.innerHTML = brokenSickle();
    } finally {
      busy = false;
      sickle.classList.remove('working');
    }
  });

  function showSickle(image) {
    const rect = image.getBoundingClientRect();
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE || rect.bottom <= 0 || rect.top >= innerHeight) return hideSickle();
    const top = Math.max(6, Math.min(innerHeight - 34, rect.top + 8));
    const left = Math.max(6, Math.min(innerWidth - 34, rect.left + 8));
    sickle.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    sickle.classList.add('visible');
    if (!sickle.classList.contains('broken')) sickle.innerHTML = normalSickle();
  }

  function hideSickle() {
    currentImage = null;
    sickle.classList.remove('visible', 'broken', 'working');
    sickle.innerHTML = normalSickle();
  }

  function normalSickle() {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><path class="blade" d="M7.5 5.5c7.5 1 13.2 5.7 15.8 12.6-3.4-4.2-8.6-6.4-14.4-5.9 5.4 1.5 9.1 4.7 11.2 9.5-5.9-4.9-12.3-5.8-17-2.4 1.7-7 3-11.1 4.4-13.8Z"/><path class="handle" d="M19.5 19.5 27 27"/></svg>';
  }

  function brokenSickle() {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><path class="blade" d="M7.5 5.5c7.5 1 13.2 5.7 15.8 12.6-3.4-4.2-8.6-6.4-14.4-5.9 5.4 1.5 9.1 4.7 11.2 9.5-5.9-4.9-12.3-5.8-17-2.4 1.7-7 3-11.1 4.4-13.8Z"/><path class="handle" d="m19.5 19.5 2.8 2.8m2 2L27 27"/><path class="break" d="m21.3 24.8 2.1-3.1"/></svg>';
  }
})();
