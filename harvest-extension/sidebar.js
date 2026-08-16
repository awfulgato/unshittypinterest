const bagEl = document.getElementById('bag');
const keepButton = document.getElementById('keep');
const destinationButtons = [...document.querySelectorAll('[data-board]')];
let board = 'husbond';
let items = [];
let keeping = false;

browser.storage.local.get('harvestBoard').then(saved => {
  if (saved.harvestBoard === 'wyf') board = 'wyf';
  syncDestination();
});

destinationButtons.forEach(button => button.addEventListener('click', async () => {
  board = button.dataset.board === 'wyf' ? 'wyf' : 'husbond';
  await browser.storage.local.set({ harvestBoard: board });
  syncDestination();
}));

keepButton.addEventListener('click', async () => {
  if (!items.length || keeping) return;
  keeping = true;
  render('keeping');
  try {
    const result = await browser.runtime.sendMessage({ type: 'keep', board });
    items = await browser.runtime.sendMessage({ type: 'bag-list' });
    render(result?.ok ? '' : 'some could not be kept');
  } catch (error) {
    console.error(error);
    render('could not keep');
  } finally {
    keeping = false;
    keepButton.disabled = !items.length;
  }
});

browser.runtime.onMessage.addListener(message => {
  if (message?.type === 'bag-changed') refresh();
});

refresh();
setInterval(refresh, 900);

async function refresh() {
  try {
    items = await browser.runtime.sendMessage({ type: 'bag-list' }) || [];
    render();
  } catch (error) { console.error(error); }
}

function render(status = '') {
  bagEl.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    bagEl.appendChild(empty);
  }

  for (const item of items) {
    const thing = document.createElement('div');
    thing.className = 'thing';
    const img = document.createElement('img');
    img.src = item.preview;
    img.alt = '';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = 'remove from bag';
    remove.addEventListener('click', async () => {
      items = await browser.runtime.sendMessage({ type: 'bag-remove', id: item.id }) || [];
      render();
    });
    thing.append(img, remove);
    bagEl.appendChild(thing);
  }

  if (status) {
    const line = document.createElement('div');
    line.className = 'status';
    line.textContent = status;
    bagEl.appendChild(line);
  }
  keepButton.disabled = keeping || !items.length;
}

function syncDestination() {
  destinationButtons.forEach(button => button.classList.toggle('active', button.dataset.board === board));
}
