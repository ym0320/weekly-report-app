import './style.css';
import { initMain } from './main';
import { initSettings } from './settings';
import { initHistory } from './history';

export type PageId = 'main' | 'settings' | 'history';

let currentPage: PageId | null = null;
let getSettingsDirty: (() => boolean) | null = null;

const pageTitles: Record<PageId, string> = {
  main: '週報',
  settings: '設定 — 週報',
  history: '履歴 — 週報',
};

// ===== Shared confirm (navigation guard) =====
function showConfirm(message: string, okLabel: string): Promise<boolean> {
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

// ===== Navigate =====
export async function navigateTo(page: PageId): Promise<void> {
  if (currentPage === page) return;

  // 設定から離れる時、未保存があれば確認
  if (currentPage === 'settings' && getSettingsDirty?.()) {
    const ok = await showConfirm('保存されていない変更があります。移動しますか？', '移動する');
    if (!ok) return;
  }

  document.querySelectorAll<HTMLElement>('.page').forEach((el) => {
    el.classList.remove('active');
  });

  const pageEl = document.getElementById(`page-${page}`)!;
  pageEl.classList.add('active');
  window.scrollTo(0, 0);
  document.title = pageTitles[page];
  currentPage = page;

  if (page === 'main') {
    initMain();
  } else if (page === 'settings') {
    getSettingsDirty = initSettings();
  } else if (page === 'history') {
    initHistory();
  }
}

// ===== data-navigate クリック委譲 =====
document.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest('[data-navigate]') as HTMLElement | null;
  if (!el) return;
  await navigateTo(el.dataset.navigate as PageId);
});

// ===== 初期表示 =====
navigateTo('main');
