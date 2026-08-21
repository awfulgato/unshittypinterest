import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const params = new URLSearchParams(location.search);
const boardParam = params.get('board');
const boardName = /^[a-z0-9_-]{1,80}$/i.test(boardParam || '') ? boardParam.toLowerCase() : 'husbond';

let segmenterPromise = null;

function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = pipeline('background-removal', 'Ko033/isnet-general-use-onnx', {
      dtype: 'q8'
    }).catch(error => {
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

function publicUrl(path) {
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function writeCutoutState(id, path, enabled) {
  const { error } = await supabase
    .from('board_items')
    .update({ cutout_path: path || null, cutout_enabled: !!enabled })
    .eq('id', id)
    .eq('board', boardName);
  if (error) throw error;
}

function rememberState(itemEl, path, enabled) {
  if (!itemEl) return;
  itemEl.dataset.cutoutPath = path || '';
  itemEl.dataset.cutoutEnabled = enabled ? '1' : '0';
}

function applyVisualState(itemEl, button, img, originalPath, cutoutPath, enabled) {
  rememberState(itemEl, cutoutPath, enabled);
  button.classList.toggle('active', !!enabled);
  img.src = enabled && cutoutPath ? publicUrl(cutoutPath) : publicUrl(originalPath);
}

async function syncRememberedState(itemEl) {
  const id = itemEl?.dataset?.id;
  const path = itemEl?.dataset?.cutoutPath;
  if (!id || !path) return;
  const enabled = itemEl.dataset.cutoutEnabled === '1';
  try {
    await writeCutoutState(id, path, enabled);
  } catch (error) {
    console.error('Could not preserve cutout state after item update.', error);
  }
}

function scheduleRememberedStateSync(itemEl) {
  if (!itemEl?.dataset?.cutoutPath) return;
  clearTimeout(itemEl._eskjaCutoutSyncTimer);
  itemEl._eskjaCutoutSyncTimer = setTimeout(() => syncRememberedState(itemEl), 350);
}

async function handleCutout(button) {
  if (button.dataset.cutoutBusy === '1') return;

  const itemEl = button.closest('.image-item');
  const img = itemEl?.querySelector('img');
  const id = itemEl?.dataset?.id;
  if (!itemEl || !img || !id) return;

  button.dataset.cutoutBusy = '1';
  button.classList.add('working');

  try {
    const { data: row, error } = await supabase
      .from('board_items')
      .select('storage_path,cutout_path,cutout_enabled')
      .eq('id', id)
      .eq('board', boardName)
      .single();
    if (error) throw error;
    if (!row?.storage_path) throw new Error('Original image is missing from storage.');

    if (row.cutout_path) {
      const enabled = !row.cutout_enabled;
      await writeCutoutState(id, row.cutout_path, enabled);
      applyVisualState(itemEl, button, img, row.storage_path, row.cutout_path, enabled);
      return;
    }

    // Let the pressed state paint before model loading/inference begins.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const segmenter = await getSegmenter();
    const output = await segmenter([publicUrl(row.storage_path)]);
    const cutout = output?.[0];
    if (!cutout || typeof cutout.toBlob !== 'function') {
      throw new Error('The cutout model returned no usable image.');
    }

    const blob = await cutout.toBlob();
    if (!blob || !blob.size) throw new Error('The cutout model returned an empty image.');

    const path = `${boardName}/${id}-cutout.png`;
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { contentType: 'image/png', upsert: true });
    if (uploadError) throw uploadError;

    await writeCutoutState(id, path, true);
    applyVisualState(itemEl, button, img, row.storage_path, path, true);
  } catch (error) {
    console.error('Eskja cutout failed.', error);
    alert(error?.message ? `Background removal failed.\n\n${error.message}` : 'Background removal failed. Try again.');
  } finally {
    button.classList.remove('working');
    delete button.dataset.cutoutBusy;
  }
}

// Capture the click before app.js' older cutout handler reaches the button.
document.addEventListener('click', event => {
  const cutoutButton = event.target.closest?.('.cutout-button');
  if (cutoutButton) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void handleCutout(cutoutButton);
    return;
  }

  // app.js does not yet know about a cutout generated during this page session,
  // so remove that derived object explicitly when the thing is deleted.
  const deleteButton = event.target.closest?.('.delete-control');
  const itemEl = deleteButton?.closest('.image-item');
  const cutoutPath = itemEl?.dataset?.cutoutPath;
  if (deleteButton && cutoutPath) {
    void supabase.storage.from(STORAGE_BUCKET).remove([cutoutPath]);
  }
}, true);

// app.js may save movement / resize / saturation using its older in-memory copy.
// Re-assert the cutout metadata just after those saves so the cutout persists.
document.addEventListener('pointerup', event => {
  scheduleRememberedStateSync(event.target.closest?.('.image-item'));
}, true);

document.addEventListener('input', event => {
  if (event.target.matches?.('.gray-slider input')) {
    scheduleRememberedStateSync(event.target.closest('.image-item'));
  }
}, true);
