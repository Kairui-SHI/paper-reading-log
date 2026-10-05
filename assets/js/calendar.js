(() => {
  const notes = JSON.parse(document.getElementById('calendar-notes').textContent);
  const now = new Date();
  let displayed = new Date(now.getFullYear(), now.getMonth(), 1);
  const grid = document.getElementById('calendar-days');
  const todayButton = document.getElementById('calendar-today');
  function render() {
    const year = displayed.getFullYear();
    const month = displayed.getMonth();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const monthNotes = notes.filter(note => note.date.startsWith(prefix));
    document.getElementById('calendar-title').textContent = `${year} 年 ${month + 1} 月`;
    grid.setAttribute('aria-label', `${year} 年 ${month + 1} 月日期`);
    grid.replaceChildren();
    todayButton.disabled = isCurrentMonth;
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) {
      const blank = document.createElement('span');
      blank.setAttribute('aria-hidden', 'true');
      grid.append(blank);
    }
    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
      const date = prefix + String(day).padStart(2, '0');
      const entries = monthNotes.filter(note => note.date === date);
      const cell = document.createElement(entries.length ? 'a' : 'span');
      cell.className = 'calendar-day';
      cell.textContent = day;
      if (isCurrentMonth && day === now.getDate()) {
        cell.classList.add('is-today');
        cell.setAttribute('aria-current', 'date');
      }
      if (entries.length) {
        cell.classList.add('has-notes');
        cell.href = entries.length === 1 ? entries[0].url : `#note-${notes.findIndex(note => note.date === date) + 1}`;
        cell.title = entries.map(note => note.title).join('\n');
      }
      cell.setAttribute('aria-label', `${year} 年 ${month + 1} 月 ${day} 日${entries.length ? `，${entries.length} 篇阅读记录：${entries.map(note => note.title).join('、')}` : '，暂无记录'}`);
      grid.append(cell);
    }
    document.getElementById('calendar-summary').textContent = `${isCurrentMonth ? '本月' : '该月'}已记录 ${new Set(monthNotes.map(note => note.date)).size} 天 · ${monthNotes.length} 篇笔记`;
  }
  document.getElementById('calendar-prev').addEventListener('click', () => {
    displayed = new Date(displayed.getFullYear(), displayed.getMonth() - 1, 1);
    render();
  });
  document.getElementById('calendar-next').addEventListener('click', () => {
    displayed = new Date(displayed.getFullYear(), displayed.getMonth() + 1, 1);
    render();
  });
  todayButton.addEventListener('click', () => {
    displayed = new Date(now.getFullYear(), now.getMonth(), 1);
    render();
  });
  render();
})();
