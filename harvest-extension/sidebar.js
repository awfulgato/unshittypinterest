const bagEl = document.getElementById('bag');
const countEl = document.getElementById('count');
const statusEl = document.getElementById('status');
const keepButton = document.getElementById('keep');
const clearButton = document.getElementById('clear');

let items = [];
let keeping = false;

keepButton.addEventListener('click', async () => {
  if (!items.length || keeping) return;
  keeping = true;
  syncControls();
  statusEl.textContent = 'keeping…';

  try {
    const result = await browser.runtime.sendMessage({ type: 'poki-keep' });
    items = await browser.runtime.sendMessage({ type: 'poki-list' }) || [];
    if (result?.ok) statusEl.textContent = result.kept ? `kept ${result.kept}` : '';
    else statusEl.textContent = `${result?.kept || 0} kept · ${result?.remaining || items.length} left`;
    render();
  } catch (error) {
    console.error(error);
    statusEl.textContent = 'could not keep';
  } finally {
    keeping = false;
    syncControls();
  }
});

clearButton.addEventListener('click', async () => {
  if (!items.length || keeping) return;
  items = await browser.runtime.sendMessage({ type: 'poki-clear' }) || [];
  statusEl.textContent = '';
  render();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.eskjaPokiV0) refresh();
});

refresh();

async function refresh() {
  try {
    items = await browser.runtime.sendMessage({ type: 'poki-list' }) || [];
    render();
  } catch (error) {
    console.error(error);
  }
}

function render() {
  bagEl.innerHTML = '';
  countEl.textContent = String(items.length);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'empty';
    bagEl.appendChild(empty);
    syncControls();
    return;
  }

  for (const item of items) {
    const thing = document.createElement('article');
    thing.className = `thing ${item.type || 'unknown'}`;

    const kind = document.createElement('div');
    kind.className = 'kind';
    kind.textContent = item.type === 'text' ? 'text' : 'image';

    const body = document.createElement('div');
    body.className = 'body';

    if (item.type === 'text') {
      body.textContent = compactText(item.text, 180);
    } else {
      body.textContent = describeImage(item);
    }

    const source = document.createElement('div');
    source.className = 'source';
    source.textContent = describeSource(item.pageUrl);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = '×';
    remove.title = 'remove from poki';
    remove.addEventListener('click', async () => {
      items = await browser.runtime.sendMessage({ type: 'poki-remove', id: item.id }) || [];
      statusEl.textContent = '';
      render();
    });

    thing.append(kind, body, source, remove);
    bagEl.appendChild(thing);
  }

  syncControls();
}

function syncControls() {
  countEl.textContent = String(items.length);
  keepButton.disabled = keeping || !items.length;
  clearButton.disabled = keeping || !items.length;
}

function compactText(value, limit) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function describeImage(item) {
  const candidate = Array.isArray(item.candidates) ? item.candidates[0] : null;
  let name = 'image';
  if (candidate?.url) {
    try {
      const url = new URL(candidate.url);
      name = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || url.hostname);
    } catch (_) {}
  }

  const width = Number(item.naturalWidth) || 0;
  const height = Number(item.naturalHeight) || 0;
  return width && height ? `${name} · ${Math.round(width)}×${Math.round(height)}` : name;
}

function describeSource(value) {
  try { return new URL(value).hostname.replace(/^www\./, ''); }
  catch (_) { return ''; }
}
