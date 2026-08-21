import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const textButton = document.getElementById('lidTextButton');
const canvas = document.querySelector('.nav-canvas[data-nav="husbond"]');
const STORE = 'storeskja-husbond';
let composer = null;

if (textButton && canvas) {
  textButton.addEventListener('click', beginWrite, true);
}

function beginWrite(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (composer) {
    composer.textarea.focus();
    return;
  }

  const shell = document.createElement('div');
  shell.className = 'lid-composer';
  const textarea = document.createElement('textarea');
  textarea.spellcheck = false;
  textarea.rows = 1;
  shell.appendChild(textarea);
  document.body.appendChild(shell);
  document.body.classList.add('writing-lid');
  composer = { shell, textarea, saving: false };

  const autosize = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(180, Math.max(34, textarea.scrollHeight))}px`;
  };
  textarea.addEventListener('input', autosize);
  textarea.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onPlace, true);
  requestAnimationFrame(() => textarea.focus());

  function onKey(keyEvent) {
    if (keyEvent.key !== 'Escape') return;
    keyEvent.preventDefault();
    endWrite();
  }

  async function onPlace(pointerEvent) {
    if (!composer || composer.saving) return;
    if (shell.contains(pointerEvent.target) || pointerEvent.target.closest?.('.storeskja-actions')) return;
    if (pointerEvent.button !== 0) return;

    pointerEvent.preventDefault();
    pointerEvent.stopImmediatePropagation();

    const text = textarea.value.trim();
    if (!text) {
      endWrite();
      return;
    }

    composer.saving = true;
    const width = Math.min(320, Math.max(70, Math.min(24, text.length) * 10 + 24));
    const lines = Math.max(1, Math.ceil(text.length / 24));
    const height = Math.min(180, Math.max(38, 22 + lines * 21));
    const x = Math.max(0, pointerEvent.clientX - width / 2);
    const y = Math.max(0, pointerEvent.clientY - height / 2);
    const id = crypto.randomUUID();

    const { error } = await supabase.from('board_items').insert({
      id,
      board: STORE,
      target_board: `husbond-${crypto.randomUUID()}`.toLowerCase(),
      type: 'note',
      src: null,
      storage_path: null,
      text,
      x,
      y,
      width,
      height,
      grayscale: 0,
      z: Date.now() % 2147483647
    });

    if (error) {
      console.error(error);
      composer.saving = false;
      return;
    }

    endWrite();
    location.reload();
  }

  function endWrite() {
    document.removeEventListener('pointerdown', onPlace, true);
    textarea.removeEventListener('keydown', onKey, true);
    shell.remove();
    document.body.classList.remove('writing-lid');
    composer = null;
  }
}
