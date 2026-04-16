import type { WeeklyReport } from './types';
import { getReports, getSettings, deleteReport } from './storage';
import { formatDate } from './utils';

// ===== State =====
let allReports: WeeklyReport[] = [];
let historyInitialized = false;

function showConfirm(message: string, okLabel = '確認'): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal')!;
    const msgEl = document.getElementById('confirmMessage')!;
    const cancelBtn = document.getElementById('confirmCancelBtn')!;
    const okBtn = document.getElementById('confirmOkBtn')!;

    msgEl.textContent = message;
    okBtn.textContent = okLabel;
    modal.classList.add('active');

    const close = (result: boolean) => {
      modal.classList.remove('active');
      cancelBtn.removeEventListener('click', onCancel);
      okBtn.removeEventListener('click', onOk);
      modal.removeEventListener('click', onOverlay);
      resolve(result);
    };
    const onCancel = () => close(false);
    const onOk = () => close(true);
    const onOverlay = (e: MouseEvent) => { if (e.target === modal) close(false); };
    cancelBtn.addEventListener('click', onCancel);
    okBtn.addEventListener('click', onOk);
    modal.addEventListener('click', onOverlay);
  });
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const container = document.getElementById('toastContainer')!;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ===== Filter =====
function filterReports(): WeeklyReport[] {
  const dateFrom = (document.getElementById('dateFrom') as HTMLInputElement).value;
  const dateTo = (document.getElementById('dateTo') as HTMLInputElement).value;
  const searchText = (document.getElementById('searchText') as HTMLInputElement).value.trim().toLowerCase();

  const settings = getSettings();

  return allReports.filter((report) => {
    if (dateFrom && report.date < dateFrom) return false;
    if (dateTo && report.date > dateTo) return false;
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

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-sm';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await showConfirm(`${formatDate(report.date)} の週報を削除しますか？この操作は取り消せません。`, '削除');
      if (!ok) return;
      deleteReport(report.id);
      allReports = allReports.filter((r) => r.id !== report.id);
      renderHistory();
      showToast('削除しました', 'info');
    });

    header.appendChild(dateSpan);
    header.appendChild(delBtn);
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

    header.addEventListener('click', () => {
      card.classList.toggle('open');
    });

    list.appendChild(card);
  }
}

// ===== Init (exported, called by router) =====
export function initHistory(): void {
  // 毎回: 最新データを読み込んで再レンダリング
  allReports = getReports();
  renderHistory();

  // 一度だけ: フィルター入力のイベント登録
  if (historyInitialized) return;
  historyInitialized = true;

  document.getElementById('dateFrom')!.addEventListener('input', renderHistory);
  document.getElementById('dateTo')!.addEventListener('input', renderHistory);
  document.getElementById('searchText')!.addEventListener('input', renderHistory);
}
