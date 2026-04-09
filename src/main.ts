import './style.css';
import type { Category, CategoryEntry, SubItemEntry } from './types';
import {
  getSettings,
  saveReport,
  getCurrentEntries,
  saveCurrentEntries,
  getSelectedCategoryIds,
  saveSelectedCategoryIds,
} from './storage';
import { generateCategoryOutput, generateId } from './utils';

// ===== State =====
let currentEntries: CategoryEntry[] = [];
let selectedCategoryIds: Set<string> = new Set();

// ===== Toast =====
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

// ===== Entry helpers =====
function getOrCreateEntry(categoryId: string): CategoryEntry {
  let entry = currentEntries.find((e) => e.categoryId === categoryId);
  if (!entry) {
    entry = { categoryId, subItemEntries: [] };
    currentEntries.push(entry);
  }
  return entry;
}

function setSubItemValue(categoryId: string, subItemId: string, value: string): void {
  const entry = getOrCreateEntry(categoryId);
  const existing = entry.subItemEntries.find((se) => se.subItemId === subItemId);
  if (existing) {
    existing.value = value;
  } else {
    entry.subItemEntries.push({ subItemId, value });
  }
  saveCurrentEntries(currentEntries);
}

function getSubItemValue(categoryId: string, subItemId: string): string {
  const entry = currentEntries.find((e) => e.categoryId === categoryId);
  return entry?.subItemEntries.find((se) => se.subItemId === subItemId)?.value ?? '';
}

// ===== Render sub item =====
function renderSubItem(category: Category, subItem: typeof category.subItems[0]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'field-group';

  const value = getSubItemValue(category.id, subItem.id);

  if (subItem.type === 'select') {
    if (subItem.label) {
      const lbl = document.createElement('label');
      lbl.className = 'field-label';
      lbl.textContent = subItem.label;
      wrapper.appendChild(lbl);
    }
    const sel = document.createElement('select');
    sel.className = 'field-select';

    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- 選択 --';
    sel.appendChild(emptyOpt);

    for (const opt of subItem.options) {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (opt === value) option.selected = true;
      sel.appendChild(option);
    }

    sel.addEventListener('change', () => {
      setSubItemValue(category.id, subItem.id, sel.value);
    });
    wrapper.appendChild(sel);

  } else if (subItem.label.includes('●')) {
    // Inline form
    const parts = subItem.label.split('●');
    const inlineWrapper = document.createElement('div');
    inlineWrapper.className = 'inline-field-wrapper';

    if (parts[0]) {
      const span1 = document.createElement('span');
      span1.className = 'inline-text';
      span1.textContent = parts[0];
      inlineWrapper.appendChild(span1);
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-input';
    input.value = value;
    input.addEventListener('input', () => {
      setSubItemValue(category.id, subItem.id, input.value);
    });
    inlineWrapper.appendChild(input);

    if (parts[1]) {
      const span2 = document.createElement('span');
      span2.className = 'inline-text';
      span2.textContent = parts[1];
      inlineWrapper.appendChild(span2);
    }

    wrapper.appendChild(inlineWrapper);

  } else if (subItem.label === '') {
    // No label, just textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'field-textarea';
    textarea.value = value;
    textarea.addEventListener('input', () => {
      setSubItemValue(category.id, subItem.id, textarea.value);
    });
    wrapper.appendChild(textarea);

  } else {
    // Label + textarea
    const lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.textContent = subItem.label;
    wrapper.appendChild(lbl);

    const textarea = document.createElement('textarea');
    textarea.className = 'field-textarea';
    textarea.value = value;
    textarea.addEventListener('input', () => {
      setSubItemValue(category.id, subItem.id, textarea.value);
    });
    wrapper.appendChild(textarea);
  }

  return wrapper;
}

// ===== Render body inner (reused for reset) =====
function renderBodyInner(category: Category, emailAddresses: string): HTMLElement {
  const bodyInner = document.createElement('div');
  bodyInner.className = 'category-body-inner';

  if (category.isEmail) {
    const emailDiv = document.createElement('div');
    emailDiv.className = 'email-display';
    emailDiv.textContent = emailAddresses || '（設定でメールアドレスを入力してください）';
    bodyInner.appendChild(emailDiv);
  } else {
    for (const subItem of category.subItems) {
      bodyInner.appendChild(renderSubItem(category, subItem));
    }
  }

  return bodyInner;
}

// ===== Confirm dialog =====
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

// ===== Render inactive card =====
function renderInactiveCard(category: Category): HTMLElement {
  const card = document.createElement('div');
  card.className = 'category-card';
  card.dataset.categoryId = category.id;

  const header = document.createElement('div');
  header.className = 'category-header';
  header.style.cursor = 'pointer';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'category-header-left';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'category-name inactive-name';
  nameSpan.textContent = category.name;

  headerLeft.appendChild(nameSpan);

  const headerRight = document.createElement('div');
  headerRight.className = 'category-header-right';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-category';
  addBtn.textContent = '＋ 使用する';

  headerRight.appendChild(addBtn);
  header.appendChild(headerLeft);
  header.appendChild(headerRight);
  card.appendChild(header);

  const activate = () => {
    selectedCategoryIds.add(category.id);
    saveSelectedCategoryIds(Array.from(selectedCategoryIds));
    const settings = getSettings();
    const activeCard = renderActiveCard(category, settings.emailAddresses);
    card.replaceWith(activeCard);
  };

  header.addEventListener('click', (e) => {
    if (e.target === addBtn) return;
    activate();
  });
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    activate();
  });

  return card;
}

// ===== Render active card =====
function renderActiveCard(category: Category, emailAddresses: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'category-card selected open';
  card.dataset.categoryId = category.id;

  // Header
  const header = document.createElement('div');
  header.className = 'category-header';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'category-header-left';
  headerLeft.style.cursor = 'pointer';

  const icon = document.createElement('span');
  icon.className = 'accordion-icon';
  icon.textContent = '▼';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'category-name';
  nameSpan.textContent = category.name;

  headerLeft.appendChild(icon);
  headerLeft.appendChild(nameSpan);

  const headerRight = document.createElement('div');
  headerRight.className = 'category-header-right';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-secondary btn-sm';
  copyBtn.textContent = 'コピー';

  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn btn-ghost btn-sm';
  resetBtn.textContent = 'リセット';

  const deselectBtn = document.createElement('button');
  deselectBtn.className = 'btn-deselect';
  deselectBtn.textContent = '✕';
  deselectBtn.title = '使用しない';

  headerRight.appendChild(copyBtn);
  headerRight.appendChild(resetBtn);
  headerRight.appendChild(deselectBtn);
  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  // Body
  const body = document.createElement('div');
  body.className = 'category-body';

  let bodyInner = renderBodyInner(category, emailAddresses);
  body.appendChild(bodyInner);

  card.appendChild(header);
  card.appendChild(body);

  // Accordion toggle (header-left only)
  headerLeft.addEventListener('click', () => {
    card.classList.toggle('open');
  });

  // Copy button
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const output = generateCategoryOutput(category, currentEntries, emailAddresses);
    if (!output.trim()) {
      showToast(`「${category.name}」に入力がありません`, 'error');
      return;
    }
    navigator.clipboard.writeText(output).then(() => {
      copyBtn.textContent = '✓ コピー済み';
      copyBtn.classList.add('btn-success');
      copyBtn.classList.remove('btn-secondary');
      showToast('コピーしました', 'success');
      setTimeout(() => {
        copyBtn.textContent = 'コピー';
        copyBtn.classList.remove('btn-success');
        copyBtn.classList.add('btn-secondary');
      }, 2000);
    }).catch(() => {
      showToast('コピーに失敗しました', 'error');
    });
  });

  // Reset button (category-level)
  resetBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const ok = await showConfirm(`「${category.name}」の入力内容をリセットしますか？`, 'リセット');
    if (!ok) return;
    currentEntries = currentEntries.filter((en) => en.categoryId !== category.id);
    saveCurrentEntries(currentEntries);
    const newBodyInner = renderBodyInner(category, emailAddresses);
    body.replaceChild(newBodyInner, bodyInner);
    bodyInner = newBodyInner;
    showToast(`${category.name}をリセットしました`, 'info');
  });

  // Deselect button
  deselectBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const ok = await showConfirm(`「${category.name}」を選択から外しますか？`, '外す');
    if (!ok) return;
    selectedCategoryIds.delete(category.id);
    saveSelectedCategoryIds(Array.from(selectedCategoryIds));
    const inactiveCard = renderInactiveCard(category);
    card.replaceWith(inactiveCard);
  });

  return card;
}

// ===== Render category card =====
function renderCategoryCard(category: Category, emailAddresses: string): HTMLElement {
  return selectedCategoryIds.has(category.id)
    ? renderActiveCard(category, emailAddresses)
    : renderInactiveCard(category);
}

// ===== Render all categories =====
function renderCategories(): void {
  const settings = getSettings();
  const list = document.getElementById('categoryList')!;
  list.innerHTML = '';

  for (const cat of settings.categories) {
    list.appendChild(renderCategoryCard(cat, settings.emailAddresses));
  }
}

// ===== Save modal =====
function openSaveModal(): void {
  const modal = document.getElementById('saveModal')!;
  const dateInput = document.getElementById('reportDate') as HTMLInputElement;
  // Default to today
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
  modal.classList.add('active');
}

function closeSaveModal(): void {
  const modal = document.getElementById('saveModal')!;
  modal.classList.remove('active');
}

function saveWeeklyReport(): void {
  const dateInput = document.getElementById('reportDate') as HTMLInputElement;
  const date = dateInput.value;
  if (!date) {
    showToast('日付を選択してください', 'error');
    return;
  }

  const report = {
    id: generateId(),
    date,
    categoryEntries: currentEntries.map((e) => ({
      categoryId: e.categoryId,
      subItemEntries: e.subItemEntries.map((se): SubItemEntry => ({
        subItemId: se.subItemId,
        value: se.value,
      })),
    })),
    savedAt: new Date().toISOString(),
  };

  saveReport(report);
  closeSaveModal();
  showToast('週報を保存しました', 'success');
}

// ===== Init =====
function init(): void {
  // Restore state
  currentEntries = getCurrentEntries();
  selectedCategoryIds = new Set(getSelectedCategoryIds());

  renderCategories();

  document.getElementById('saveBtn')!.addEventListener('click', openSaveModal);
  document.getElementById('modalCancelBtn')!.addEventListener('click', closeSaveModal);
  document.getElementById('modalSaveBtn')!.addEventListener('click', saveWeeklyReport);

  // Close modal on overlay click
  document.getElementById('saveModal')!.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSaveModal();
  });
}

init();
