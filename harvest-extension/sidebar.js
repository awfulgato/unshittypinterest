const bagEl = document.getElementById('bag');
const countEl = document.getElementById('count');
const toggleButton = document.getElementById('toggleSegl');
const clearButton = document.getElementById('clear');
const keepButton = document.getElementById('keep');

let active = false;
let items = [];
let keeping = false;

browser.runtime.onMessage.addListener(message => {
  if (message?.type === 'poki-changed') refresh();
});

toggleButton.addEventListener('click', async () => {
  try {
    const result = await browser.runtime.sendMessage({ type: 'segl-set-global-active', active: !active });
    active = !!result?.active;
    await refresh();
  } catch (error) {
    console.error(error);
  }
});

clearButton.addEventListener('click', async () => {
  if (!items.length || keeping) return;
  try {
    const result = await browser.runtime.sendMessage({ type: 'poki-clear' });
    active = !!result?.active;
    items = result?.items || [];
    render();
  } catch (error) {
    console.error(error);
  }
});

keepButton.addEventListener('click', async () => {
  if (!items.length || keeping) return;
  keeping = true;
  render('keeping…');
  try {
    const result = await browser.runtime.sendMessage({ type: 'poki-keep' });
    active = !!result?.active;
    items = result?.items || [];
    if (result?.ok) render(result.kept ? `kept ${result.kept}` : 'nothing kept');
    else render(result?.failures?.length ? `kept ${result.kept || 0} · ${result.failures.length} failed` : 'could not keep');
  } catch (error) {
    console.error(error);
    render('could not keep');
  } finally {
    keeping = false;
    keepButton.disabled = !items.length;
  }
});

refresh();

async function refresh() {
  try {
    const result = await browser.runtime.sendMessage({ type: 'poki-list' });
    active = !!result?.active;
    items = result?.items || [];
    render();
  } catch (error) {
    console.error(error);
  }
}

function render(status = '') {
  bagEl.innerHTML = '';
  countEl.textContent = `${items.length} in poki`;
  toggleButton.textContent = active ? 'segl on' : 'segl off';
  toggleButton.classList.toggle('active', active);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'poki empty';
    bagEl.appendChild(empty);
  }

  for (const item of items) {
    const thing = document.createElement('article');
    thing.className = `thing ${item.type}`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = '×';
    remove.title = 'remove';
    remove.addEventListener('click', async () => {
      try {
        const result = await browser.runtime.sendMessage({ type: 'poki-remove', id: item.id });
        active = !!result?.active;
        items = result?.items || [];
        render();
      } catch (error) {
        console.error(error);
      }
    });

    const kind = document.createElement('div');
    kind.className = 'kind';
    kind.textContent = item.type === 'text' ? 'text' : 'image';

    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = item.type === 'text'
      ? truncate(item.text || '', 150)
      : `from ${hostish(item.pageUrl)}${item.naturalWidth && item.naturalHeight ? ` · ${item.naturalWidth}×${item.naturalHeight}` : ''}${item.candidateCount ? ` · ${item.candidateCount} paths` : ''}`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = item.pageTitle ? truncate(item.pageTitle, 70) : (item.pageUrl ? hostish(item.pageUrl) : '');

    thing.append(remove, kind, body, meta);
    bagEl.appendChild(thing);
  }

  if (status) {
    const line = document.createElement('div');
    line.className = 'status';
    line.textContent = status;
    bagEl.appendChild(line);
  }

  clearButton.disabled = keeping || !items.length;
  keepButton.disabled = keeping || !items.length;
}

function hostish(url) {
  try { return new URL(url).host.replace(/^www\./, ''); }
  catch (_) { return 'page'; }
}

function truncate(text, max) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;
}
