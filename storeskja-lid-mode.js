import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const canvas = document.querySelector('.nav-canvas[data-nav="husbond"]');
if (!canvas) {
  // Wyf is still on the legacy navigation path for now.
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const STORE = 'storeskja-husbond';
  const rows = new Map();

  await refreshRows();
  upgradeLids();

  const observer = new MutationObserver(() => upgradeLids());
  observer.observe(canvas, { childList: true, subtree: true });

  // Take ownership of the lid body gesture before nav.js's older
  // hold-to-edit handler sees it.
  canvas.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerdown', onDocumentPointerDown, true);

  async function refreshRows() {
    const { data, error } = await supabase
      .from('board_items')
      .select('id,target_board,x,y,width,height,z')
      .eq('board', STORE)
      .not('target_board', 'is', null);

    if (error) {
      console.error(error);
      return;
    }

    rows.clear();
    for (const row of data || []) rows.set(row.id, row);
  }

  function upgradeLids() {
    canvas.querySelectorAll('.storeskja-lid').forEach(lid => {
      if (lid.dataset.lidModeReady === '1') return;
      lid.dataset.lidModeReady = '1';

      const editMode = document.createElement('button');
      editMode.type = 'button';
      editMode.className = 'lid-mode-toggle';
      editMode.title = 'edit lid';
      editMode.setAttribute('aria-label', 'edit lid');
      editMode.innerHTML =
        '<svg viewBox="0 0 16 16" aria-hidden="true">' +
        '<path d="M3 11.8 3.7 9l6.8-6.8 2.3 2.3L6 11.3 3 11.8Z"/>' +
        '<path d="m9.4 3.3 2.3 2.3"/>' +
        '</svg>';
      lid.appendChild(editMode);
    });
  }

  async function rowFor(lid) {
    const id = lid?.dataset?.id;
    if (!id) return null;
    if (rows.has(id)) return rows.get(id);

    const { data, error } = await supabase
      .from('board_items')
      .select('id,target_board,x,y,width,height,z')
      .eq('board', STORE)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(error);
      return null;
    }
    if (data) rows.set(id, data);
    return data;
  }

  function onDocumentPointerDown(event) {
    const lid = event.target.closest?.('.storeskja-lid');
    if (lid) {
      canvas.querySelectorAll('.storeskja-lid.lid-edit-mode').forEach(other => {
        if (other !== lid) closeEditMode(other);
      });
      return;
    }

    if (event.target.closest?.('.eskja-confirm,.lid-composer,.storeskja-actions')) return;
    canvas.querySelectorAll('.storeskja-lid.lid-edit-mode').forEach(closeEditMode);
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;

    const lid = event.target.closest?.('.storeskja-lid');
    if (!lid || !canvas.contains(lid)) return;

    const toggle = event.target.closest('.lid-mode-toggle');
    if (toggle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (lid.classList.contains('lid-edit-mode')) {
        closeEditMode(lid);
      } else {
        openEditMode(lid);
      }
      return;
    }

    // Let the existing focused tools keep doing their jobs.
    if (event.target.closest('.lid-control')) return;

    const resize = event.target.closest('.lid-resize');
    if (resize) {
      event.preventDefault();
      event.stopImmediatePropagation();
      beginResize(event, lid, resize);
      return;
    }

    const textarea = lid.querySelector('.storeskja-lid-text');
    if (textarea && !textarea.readOnly) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    beginMoveOrEnter(event, lid);
  }

  function openEditMode(lid) {
    canvas.querySelectorAll('.storeskja-lid.lid-edit-mode').forEach(other => {
      if (other !== lid) closeEditMode(other);
    });
    lid.classList.add('lid-edit-mode');
    lid.classList.remove('selected', 'held');
  }

  function closeEditMode(lid) {
    const textarea = lid.querySelector('.storeskja-lid-text');
    if (textarea && !textarea.readOnly) textarea.blur();
    lid.classList.remove('lid-edit-mode', 'selected', 'held');
  }

  async function beginMoveOrEnter(event, lid) {
    const row = await rowFor(lid);
    if (!row) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = parseFloat(lid.style.left) || Number(row.x) || 0;
    const originY = parseFloat(lid.style.top) || Number(row.y) || 0;
    let moved = false;

    lid.setPointerCapture(event.pointerId);

    const onMove = moveEvent => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!moved && Math.hypot(dx, dy) > 4) {
        moved = true;
        lid.classList.add('moving');
      }
      if (!moved) return;

      const x = Math.max(0, originX + dx);
      const y = Math.max(0, originY + dy);
      lid.style.left = `${x}px`;
      lid.style.top = `${y}px`;
    };

    const cleanup = () => {
      lid.removeEventListener('pointermove', onMove);
      lid.removeEventListener('pointerup', onUp);
      lid.removeEventListener('pointercancel', onCancel);
      lid.classList.remove('moving');
    };

    const onUp = async () => {
      cleanup();

      if (moved) {
        const x = parseFloat(lid.style.left) || 0;
        const y = parseFloat(lid.style.top) || 0;
        const z = Date.now() % 2147483647;
        lid.style.zIndex = String(z);
        Object.assign(row, { x, y, z });

        const { error } = await supabase
          .from('board_items')
          .update({ x, y, z })
          .eq('board', STORE)
          .eq('id', row.id);
        if (error) console.error(error);
        return;
      }

      // Once editing has been deliberately opened, the lid body stops being
      // a doorway until edit mode is closed.
      if (lid.classList.contains('lid-edit-mode')) return;

      if (row.target_board) {
        window.location.href = `board.html?board=${encodeURIComponent(row.target_board)}`;
      }
    };

    const onCancel = () => cleanup();

    lid.addEventListener('pointermove', onMove);
    lid.addEventListener('pointerup', onUp);
    lid.addEventListener('pointercancel', onCancel);
  }

  async function beginResize(event, lid, handle) {
    const row = await rowFor(lid);
    if (!row) return;

    openEditMode(lid);

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = Math.max(36, lid.offsetWidth);
    const startHeight = Math.max(28, lid.offsetHeight);
    const ratio = startWidth / Math.max(1, startHeight);
    const type = lid.classList.contains('lid-image')
      ? 'image'
      : lid.classList.contains('lid-video')
        ? 'video'
        : lid.classList.contains('lid-audio')
          ? 'audio'
          : 'note';
    const preserveRatio = type === 'image' || type === 'video';
    const minWidth = type === 'note' ? 36 : 70;
    const minHeight = type === 'note' ? 28 : 40;

    handle.setPointerCapture(event.pointerId);

    const onMove = moveEvent => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let width = Math.max(minWidth, startWidth + dx);
      let height = Math.max(minHeight, startHeight + dy);

      if (preserveRatio) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          height = Math.max(minHeight, width / ratio);
        } else {
          width = Math.max(minWidth, height * ratio);
        }
      }

      lid.style.width = `${width}px`;
      lid.style.height = `${height}px`;
    };

    const cleanup = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onCancel);
    };

    const onUp = async () => {
      cleanup();
      const x = parseFloat(lid.style.left) || 0;
      const y = parseFloat(lid.style.top) || 0;
      const width = lid.offsetWidth;
      const height = lid.offsetHeight;
      Object.assign(row, { x, y, width, height });

      const { error } = await supabase
        .from('board_items')
        .update({ x, y, width, height })
        .eq('board', STORE)
        .eq('id', row.id);
      if (error) console.error(error);
    };

    const onCancel = () => cleanup();

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onCancel);
  }
}
