(() => {
  const husbondLatin = 'abcdefghijklmnopqrstuvwxyz'.split('');

  // Preserve the original Greek/Cyrillic indices so any existing boards keep
  // pointing at exactly the same board IDs. New characters are appended.
  const husbondGreek = ['α','Β','γ','Δ','ζ','Θ','κ','Λ','μ','Π','σ','Ω','ε','η','ν','φ','χ','ψ'];
  const husbondGreekOrder = ['α','Β','γ','Δ','ε','ζ','η','Θ','κ','Λ','μ','ν','Π','σ','φ','χ','ψ','Ω'];

  const husbondCyrillic = ['ж','Я','ф','а','б','д','к','м','р','у'];
  const husbondCyrillicOrder = ['а','б','д','ж','к','м','р','у','ф','Я'];

  const husbondHebrew = [
    { label: 'ש', board: 'husbond-hebrew-shema' },
    { label: 'ז', board: 'husbond-hebrew-zechariah' },
    { label: 'אדם', board: 'husbond-hebrew-adam' },
    { label: 'ר', board: 'husbond-hebrew-ruach' },
    { label: 'א', board: 'husbond-hebrew-ahava' }
  ];

  const wyfCyrillic = ['б','Д','й'];

  const rune = {
    'whaleroad':'ᚹᚺᚨᛚᛖᚱᚨᛟᛞ',
    'gold-tree':'ᚷᛟᛚᛞ-ᛏᚱᛖᛖ',
    'world-candle':'ᚹᛟᚱᛚᛞ-ᚲᚨᚾᛞᛚᛖ',
    'river':'ᚱᛁᚹᛖᚱ',
    'rafn':'ᚱᚨᚠᚾ'
  };

  const home = document.querySelector('.nav-canvas');
  if (!home) return;
  const type = home.dataset.nav;

  const link = (label, board, cls='nav-link') => {
    const a = document.createElement('a');
    a.className = cls;
    a.textContent = label;
    a.href = `board.html?board=${encodeURIComponent(board)}`;
    a.dataset.board = board;
    return a;
  };

  const placeRandom = (a, index, total) => {
    const pad = 4;
    const x = pad + Math.random() * (100 - pad * 2);
    const y = pad + Math.random() * (100 - pad * 2);
    a.style.left = `${x}%`;
    a.style.top = `${y}%`;
    a.style.transform = `translate(-50%, -50%) rotate(${(Math.random()*10-5).toFixed(2)}deg)`;
  };

  if (type === 'husbond') {
    const links = [];

    husbondLatin.forEach(ch => links.push(link(ch, `husbond-${ch}`, 'nav-link latin')));
    for (let n = 1; n <= 12; n++) links.push(link(String(n), `husbond-${n}`, 'nav-link numeral'));

    const cross = link('†','husbond-cross','nav-link symbol');
    links.push(cross);

    const heart = document.createElement('a');
    heart.className = 'nav-link symbol husbond-heart-toggle';
    heart.textContent = '♥';
    heart.setAttribute('role','button');
    heart.setAttribute('aria-label','organize husbond links');
    heart.setAttribute('aria-pressed','false');
    heart.tabIndex = 0;
    links.push(heart);

    husbondGreek.forEach((ch,i) => links.push(link(ch, `husbond-greek-${i}`,'nav-link greek')));
    husbondCyrillic.forEach((ch,i) => links.push(link(ch, `husbond-cyrillic-${i}`,'nav-link cyrillic')));
    husbondHebrew.forEach(({label, board}) => links.push(link(label, board, 'nav-link hebrew')));

    links.push(link('道德经','husbond-taodejing','nav-link chinese'));
    links.push(link('无为','husbond-wuwei','nav-link chinese'));

    links.forEach((a,i) => {
      home.appendChild(a);
      placeRandom(a,i,links.length);
    });

    const byClass = cls => links.filter(a => a.classList.contains(cls));
    const latinLinks = byClass('latin');
    const numeralLinks = byClass('numeral');
    const greekLinks = byClass('greek');
    const cyrillicLinks = byClass('cyrillic');
    const hebrewLinks = byClass('hebrew');
    const chineseLinks = byClass('chinese');

    const greekRank = new Map(husbondGreekOrder.map((ch,i) => [ch, i]));
    const cyrRank = new Map(husbondCyrillicOrder.map((ch,i) => [ch, i]));

    let organized = false;

    const resetLinkPresentation = a => {
      a.style.removeProperty('writing-mode');
      a.style.removeProperty('text-orientation');
      a.style.removeProperty('direction');
      a.style.removeProperty('letter-spacing');
      a.style.removeProperty('font-size');
    };

    const scatter = () => {
      organized = false;
      home.classList.remove('husbond-organized');
      links.forEach((a,i) => {
        resetLinkPresentation(a);
        placeRandom(a,i,links.length);
      });
      heart.setAttribute('aria-pressed','false');
    };

    const placeColumn = (items, left, top, bottom=8) => {
      const count = Math.max(1, items.length);
      const usable = 100 - top - bottom;
      const step = count <= 1 ? 0 : usable / (count - 1);
      items.forEach((a,i) => {
        resetLinkPresentation(a);
        a.style.left = `${left}%`;
        a.style.top = `${top + step * i}%`;
        a.style.transform = 'translate(-50%, -50%)';
      });
    };

    const organize = () => {
      organized = true;
      home.classList.add('husbond-organized');
      heart.setAttribute('aria-pressed','true');

      const sortedLatin = [...latinLinks].sort((a,b) => a.textContent.localeCompare(b.textContent, 'en'));
      const sortedNumerals = [...numeralLinks].sort((a,b) => Number(a.textContent) - Number(b.textContent));
      const sortedGreek = [...greekLinks].sort((a,b) => (greekRank.get(a.textContent) ?? 999) - (greekRank.get(b.textContent) ?? 999));
      const sortedCyrillic = [...cyrillicLinks].sort((a,b) => (cyrRank.get(a.textContent) ?? 999) - (cyrRank.get(b.textContent) ?? 999));

      // Hebrew order is intentionally semantic, matching the requested family:
      // Shema, Zechariah, Adam, ruach, ahava.
      const sortedHebrew = husbondHebrew.map(({board}) => hebrewLinks.find(a => a.dataset.board === board)).filter(Boolean);

      placeColumn(sortedLatin, 10, 7, 7);
      placeColumn(sortedNumerals, 25, 10, 10);
      placeColumn(sortedGreek, 40, 8, 8);
      placeColumn(sortedCyrillic, 55, 10, 10);
      placeColumn(sortedHebrew, 70, 13, 25);

      // Traditional-looking vertical presentation for the two Chinese links.
      chineseLinks.forEach((a,i) => {
        resetLinkPresentation(a);
        a.style.left = `${83 + i * 5}%`;
        a.style.top = '12%';
        a.style.transform = 'translate(-50%, 0)';
        a.style.writingMode = 'vertical-rl';
        a.style.textOrientation = 'upright';
        a.style.letterSpacing = '.08em';
      });

      // Keep the two sparse symbols together as the final family.
      cross.style.left = '94%';
      cross.style.top = '16%';
      cross.style.transform = 'translate(-50%, -50%)';

      heart.style.left = '94%';
      heart.style.top = '26%';
      heart.style.transform = 'translate(-50%, -50%)';
    };

    const toggleOrganization = event => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (organized) scatter();
      else organize();
    };

    heart.addEventListener('click', toggleOrganization);
    heart.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') toggleOrganization(event);
    });

    return;
  }

  // WYF is deliberately composed rather than randomized.
  const alphabet = document.createElement('div');
  alphabet.className = 'wyf-section wyf-alphabet';
  husbondLatin.slice(0,0); // keep the chosen husbond set independent
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  letters.forEach((ch,i) => alphabet.appendChild(link(ch, `wyf-letter-${ch}`, 'wyf-link')));
  home.appendChild(alphabet);

  const numbers = document.createElement('div');
  numbers.className = 'wyf-section wyf-numbers';
  for (let i=1;i<=41;i++) numbers.appendChild(link(String(i), `wyf-number-${i}`, 'wyf-link numeral'));
  home.appendChild(numbers);

  const cyr = document.createElement('div');
  cyr.className = 'wyf-section wyf-cyrillic';
  wyfCyrillic.forEach((ch,i) => {
    const a = link(ch, `wyf-cyrillic-${i}`, 'nav-link cyrillic');
    const fixed = [[18, 36], [31, 39], [45, 35]];
    a.style.left = `${fixed[i][0]}%`;
    a.style.top = `${fixed[i][1]}%`;
    cyr.appendChild(a);
  });
  home.appendChild(cyr);

  const runes = document.createElement('div');
  runes.className = 'wyf-section wyf-runes';
  Object.entries(rune).forEach(([word, glyphs],i) => {
    const a = link(glyphs, `wyf-rune-${i}`, 'rune-link');
    const fixed = [[11, 49], [29, 53], [48, 47], [67, 52], [84, 48]];
    a.style.left = `${fixed[i][0]}%`;
    a.style.top = `${fixed[i][1]}%`;
    runes.appendChild(a);
  });
  home.appendChild(runes);

  const handwriting = document.createElement('div');
  handwriting.className = 'wyf-section wyf-handwriting';
  ['passerby blue','guest','fivecoat','jane','bramble'].forEach((text,i) => {
    const a = link(text, `wyf-hand-${i}`, text === 'passerby blue' ? 'hand-link passerby-blue' : 'hand-link');
    handwriting.appendChild(a);
  });
  home.appendChild(handwriting);

  const shared = link('%','shared','wyf-shared');
  home.appendChild(shared);
})();
