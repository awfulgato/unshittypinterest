(() => {
  const husbondLatin = ['a','c','e','g','h','k','m','p','r','s','t','u','x'];
  const husbondGreek = ['α','Β','γ','Δ','ζ','Θ','κ','Λ','μ','Π','σ','Ω'];
  const husbondCyrillic = ['ж','Я','ф'];
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
    husbondLatin.forEach(ch => links.push(link(ch, `husbond-${ch}`, 'nav-link')));
    ['1','2','3','4','5'].forEach(n => links.push(link(n, `husbond-${n}`,'nav-link numeral')));
    links.push(link('†','husbond-cross','nav-link symbol'));
    links.push(link('♥','husbond-heart','nav-link symbol'));
    husbondGreek.forEach((ch,i) => links.push(link(ch, `husbond-greek-${i}`,'nav-link greek')));
    husbondCyrillic.forEach((ch,i) => links.push(link(ch, `husbond-cyrillic-${i}`,'nav-link cyrillic')));
    links.push(link('道德经','husbond-taodejing','nav-link chinese'));
    links.push(link('无为','husbond-wuwei','nav-link chinese'));
    links.forEach((a,i) => { home.appendChild(a); placeRandom(a,i,links.length); });
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
