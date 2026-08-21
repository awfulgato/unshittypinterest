const board = document.getElementById('board');
if (board) {
  upgradeNotes(board);
  const observer = new MutationObserver(() => upgradeNotes(board));
  observer.observe(board, { childList: true, subtree: true });
}

function upgradeNotes(root) {
  root.querySelectorAll('.note-item').forEach(el => {
    if (el.dataset.eskjaTextUpgraded === '1') return;
    const textarea = el.querySelector('.note-text');
    const controls = el.querySelector('.image-controls');
    if (!textarea || !controls) return;

    el.dataset.eskjaTextUpgraded = '1';
    textarea.readOnly = true;

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'control note-edit-control';
    edit.textContent = '&';
    edit.title = 'edit text';
    controls.appendChild(edit);

    edit.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
    });

    edit.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      beginEdit();
    });

    textarea.addEventListener('blur', finishEdit);
    textarea.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        textarea.blur();
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        textarea.blur();
      }
    });

    function beginEdit() {
      document.querySelectorAll('.note-item.editing').forEach(other => {
        if (other === el) return;
        const otherText = other.querySelector('.note-text');
        if (otherText) otherText.blur();
      });
      el.classList.add('selected', 'editing');
      textarea.readOnly = false;
      textarea.classList.add('editing');
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    function finishEdit() {
      textarea.readOnly = true;
      textarea.classList.remove('editing');
      el.classList.remove('editing');
    }
  });
}
