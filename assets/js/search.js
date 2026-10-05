(() => {
  const input = document.getElementById('note-search');
  const cards = [...document.querySelectorAll('.note-card')];
  const normalize = text => text.normalize('NFKC').toLocaleLowerCase();
  const records = cards.map(card => ({card, text:normalize(card.dataset.search || card.textContent)}));
  function filter() {
    const keywords = normalize(input.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const {card,text} of records) {
      card.hidden = !keywords.every(keyword => text.includes(keyword));
      if (!card.hidden) count++;
    }
    document.getElementById('search-count').textContent = keywords.length ? `${count} / ${cards.length} 篇` : `${cards.length} 篇笔记`;
    document.getElementById('search-empty').hidden = !keywords.length || count > 0;
    const empty = document.querySelector('.empty-state');
    if (empty) empty.hidden = keywords.length > 0;
  }
  input.addEventListener('input',filter);
  input.addEventListener('search',filter);
  document.querySelector('.reading-calendar')?.addEventListener('click',event => {
    const link = event.target.closest('a[href^="#note-"]');
    if (link) { input.value=''; filter(); }
  });
  filter();
})();
