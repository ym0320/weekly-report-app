import './style.css';
import type { WeeklyReport } from './types';
import { getReports, getSettings } from './storage';
import { formatDate } from './utils';

// ===== State =====
let allReports: WeeklyReport[] = [];

// ===== Filter =====
function filterReports(): WeeklyReport[] {
  const dateFrom = (document.getElementById('dateFrom') as HTMLInputElement).value;
  const dateTo = (document.getElementById('dateTo') as HTMLInputElement).value;
  const searchText = (document.getElementById('searchText') as HTMLInputElement).value.trim().toLowerCase();

  const settings = getSettings();

  return allReports.filter((report) => {
    // Date range filter
    if (dateFrom && report.date < dateFrom) return false;
    if (dateTo && report.date > dateTo) return false;

    // Text filter
    if (searchText) {
      const haystack = buildSearchText(report, settings.categories);
      if (!haystack.includes(searchText)) return false;
    }

    return true;
  });
}

function buildSearchText(
  report: WeeklyReport,
  categories: ReturnType<typeof getSettings>['categories']
): string {
  const parts: string[] = [report.date];

  for (const cat of categories) {
    parts.push(cat.name.toLowerCase());
    const entry = report.categoryEntries.find((e) => e.categoryId === cat.id);
    if (entry) {
      for (const se of entry.subItemEntries) {
        parts.push(se.value.toLowerCase());
      }
    }
  }

  return parts.join(' ');
}

// ===== Render =====
function renderHistory(): void {
  const settings = getSettings();
  const filtered = filterReports();
  const list = document.getElementById('historyList')!;
  list.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = '履歴がありません';
    list.appendChild(empty);
    return;
  }

  // Sort descending by date
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  for (const report of sorted) {
    const card = document.createElement('div');
    card.className = 'history-card';

    const header = document.createElement('div');
    header.className = 'history-card-header';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'history-date';
    dateSpan.textContent = formatDate(report.date);

    const icon = document.createElement('span');
    icon.className = 'accordion-icon';
    icon.textContent = '▼';
    icon.style.fontSize = '11px';
    icon.style.color = 'var(--text-muted)';

    header.appendChild(dateSpan);
    header.appendChild(icon);

    const body = document.createElement('div');
    body.className = 'history-body';

    const bodyInner = document.createElement('div');
    bodyInner.className = 'history-body-inner';

    for (const cat of settings.categories) {
      if (cat.isEmail) continue;

      const entry = report.categoryEntries.find((e) => e.categoryId === cat.id);
      const hasContent = entry && entry.subItemEntries.some((se) => se.value.trim());
      if (!hasContent) continue;

      const catDiv = document.createElement('div');
      catDiv.className = 'history-cat';

      const catName = document.createElement('div');
      catName.className = 'history-cat-name';
      catName.textContent = cat.name;
      catDiv.appendChild(catName);

      const entriesDiv = document.createElement('div');
      entriesDiv.className = 'history-entries';

      for (const subItem of cat.subItems) {
        const se = entry?.subItemEntries.find((s) => s.subItemId === subItem.id);
        if (!se || !se.value.trim()) continue;

        const entryDiv = document.createElement('div');
        entryDiv.className = 'history-entry';

        if (subItem.label) {
          const labelSpan = document.createElement('div');
          labelSpan.className = 'history-entry-label';
          labelSpan.textContent = subItem.label;
          entryDiv.appendChild(labelSpan);
        }

        const valueDiv = document.createElement('div');
        valueDiv.className = 'history-entry-value';
        valueDiv.textContent = se.value;
        entryDiv.appendChild(valueDiv);

        entriesDiv.appendChild(entryDiv);
      }

      catDiv.appendChild(entriesDiv);
      bodyInner.appendChild(catDiv);
    }

    body.appendChild(bodyInner);
    card.appendChild(header);
    card.appendChild(body);

    // Toggle
    header.addEventListener('click', () => {
      card.classList.toggle('open');
    });

    list.appendChild(card);
  }
}

// ===== Init =====
function init(): void {
  allReports = getReports();

  renderHistory();

  document.getElementById('dateFrom')!.addEventListener('input', renderHistory);
  document.getElementById('dateTo')!.addEventListener('input', renderHistory);
  document.getElementById('searchText')!.addEventListener('input', renderHistory);
}

init();
