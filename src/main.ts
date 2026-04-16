import type { Category, CategoryEntry, SubItem, SubItemEntry } from './types';
import {
  getSettings,
  saveSettings,
  saveReport,
  getCurrentEntries,
  saveCurrentEntries,
  getSelectedCategoryIds,
  saveSelectedCategoryIds,
} from './storage';
import { generateCategoryOutput, generateId, toFullEmail } from './utils';
import { navigateTo } from './app';
import { navigateToSettingsTab } from './settings';

// ===== State =====
let currentEntries: CategoryEntry[] = [];
let selectedCategoryIds: Set<string> = new Set();
let currentReportDate: string = '';
const DATE_STORAGE_KEY = 'weeklyReportApp_selectedDate';

let mainInitialized = false;
const askedMasterUpdate = new Set<string>();

// ===== Date display =====
function updateDateDisplay(): void {
  const display = document.getElementById('reportDateDisplay')!;
  const card = document.getElementById('reportDateCard')!;
  if (currentReportDate) {
    const [y, m, d] = currentReportDate.split('-').map(Number);
    const dow = ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
    display.textContent = `${m}月${d}日（${dow}）の週報`;
    card.classList.add('has-date');
  } else {
    display.textContent = '日付を選択してください';
    card.classList.remove('has-date');
  }
}

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

// ===== Office master (datalist combo) =====
function renderOfficeMasterSubItem(category: Category, subItem: SubItem, offices: string[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'field-group';

  if (subItem.label) {
    const lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.textContent = subItem.label;
    wrapper.appendChild(lbl);
  }

  const listId = `office-list-${subItem.id}`;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'field-input';
  input.placeholder = '事務所名を入力または選択';
  input.value = getSubItemValue(category.id, subItem.id);
  input.setAttribute('list', listId);

  const datalist = document.createElement('datalist');
  datalist.id = listId;
  for (const office of offices) {
    const opt = document.createElement('option');
    opt.value = office;
    datalist.appendChild(opt);
  }

  input.addEventListener('input', () => {
    setSubItemValue(category.id, subItem.id, input.value);
  });

  wrapper.appendChild(input);
  wrapper.appendChild(datalist);
  return wrapper;
}

// ===== Master update on blur =====
function addMasterUpdateHandler(textarea: HTMLTextAreaElement, categoryId: string, subItem: SubItem): void {
  if (!subItem.defaultValue) return;
  const originalDefault = subItem.defaultValue;

  textarea.addEventListener('blur', async () => {
    const current = textarea.value.trim();
    if (current === originalDefault || askedMasterUpdate.has(subItem.id)) return;
    askedMasterUpdate.add(subItem.id);

    const ok = await showConfirm('編集した内容をマスター（設定）にも反映しますか？', '反映する');
    if (!ok) return;

    const settings = getSettings();
    for (const cat of settings.categories) {
      if (cat.id !== categoryId) continue;
      const si = cat.subItems.find((s) => s.id === subItem.id);
      if (si) {
        si.defaultValue = current || undefined;
        saveSettings(settings);
        showToast('マスターに反映しました', 'success');
      }
      break;
    }
  });
}

// ===== Render sub item =====
function renderSubItem(category: Category, subItem: SubItem): HTMLElement {
  if (subItem.useOfficeMaster) {
    const settings = getSettings();
    return renderOfficeMasterSubItem(category, subItem, settings.offices);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'field-group';

  const storedValue = getSubItemValue(category.id, subItem.id);
  const value = storedValue !== '' ? storedValue : (subItem.defaultValue ?? '');

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
    const textarea = document.createElement('textarea');
    textarea.className = 'field-textarea';
    textarea.value = value;
    textarea.addEventListener('input', () => {
      setSubItemValue(category.id, subItem.id, textarea.value);
    });
    addMasterUpdateHandler(textarea, category.id, subItem);
    wrapper.appendChild(textarea);

  } else {
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
    addMasterUpdateHandler(textarea, category.id, subItem);
    wrapper.appendChild(textarea);
  }

  return wrapper;
}

// ===== Render body inner =====
function renderBodyInner(category: Category): HTMLElement {
  const bodyInner = document.createElement('div');
  bodyInner.className = 'category-body-inner';

  if (category.isEmail) {
    const settings = getSettings();
    const emailList = settings.emailList;
    const emailEntry = currentEntries.find((e) => e.categoryId === category.id);
    const selectionEntry = emailEntry?.subItemEntries.find((se) => se.subItemId === '__email_selection__');
    const fullEmailList = emailList.map(toFullEmail).filter(Boolean);
    let selectedEmails: string[] = selectionEntry
      ? JSON.parse(selectionEntry.value || '[]')
      : [...fullEmailList];

    const saveSelection = () => {
      setSubItemValue(category.id, '__email_selection__', JSON.stringify(selectedEmails));
    };

    if (!selectionEntry && fullEmailList.length > 0) {
      saveSelection();
    }

    if (fullEmailList.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'email-empty-hint';
      hint.textContent = '設定でメールアドレスを登録してください';
      bodyInner.appendChild(hint);
    } else {
      fullEmailList.forEach((email) => {
        const isSelected = selectedEmails.includes(email);
        const row = document.createElement('div');
        row.className = `email-row ${isSelected ? 'email-row-on' : 'email-row-off'}`;

        const toggle = document.createElement('button');
        toggle.className = `email-toggle ${isSelected ? 'on' : 'off'}`;
        toggle.textContent = isSelected ? '✓' : '−';
        toggle.title = isSelected ? '今回除外' : '今回追加';

        const label = document.createElement('span');
        label.className = 'email-row-label';
        label.textContent = email;

        toggle.addEventListener('click', () => {
          if (selectedEmails.includes(email)) {
            selectedEmails = selectedEmails.filter((e) => e !== email);
            row.classList.replace('email-row-on', 'email-row-off');
            toggle.classList.replace('on', 'off');
            toggle.textContent = '−';
            toggle.title = '今回追加';
          } else {
            selectedEmails.push(email);
            row.classList.replace('email-row-off', 'email-row-on');
            toggle.classList.replace('off', 'on');
            toggle.textContent = '✓';
            toggle.title = '今回除外';
          }
          saveSelection();
          label.classList.toggle('dimmed', !selectedEmails.includes(email));
        });

        if (!isSelected) label.classList.add('dimmed');

        row.appendChild(toggle);
        row.appendChild(label);
        bodyInner.appendChild(row);
      });
    }
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
    const activeCard = renderActiveCard(category);
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
function renderActiveCard(category: Category): HTMLElement {
  const card = document.createElement('div');
  card.className = 'category-card selected open';
  card.dataset.categoryId = category.id;

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

  if (category.isEmail) {
    const settings = getSettings();
    resetBtn.textContent = settings.emailList.length > 0 ? '編集' : '登録';
  } else {
    resetBtn.textContent = 'リセット';
  }

  const deselectBtn = document.createElement('button');
  deselectBtn.className = 'btn-deselect';
  deselectBtn.textContent = '✕';
  deselectBtn.title = '使用しない';

  headerRight.appendChild(copyBtn);
  headerRight.appendChild(resetBtn);
  if (!category.isEmail) {
    headerRight.appendChild(deselectBtn);
  }
  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  const body = document.createElement('div');
  body.className = 'category-body';

  let bodyInner = renderBodyInner(category);
  body.appendChild(bodyInner);

  card.appendChild(header);
  card.appendChild(body);

  headerLeft.addEventListener('click', () => {
    card.classList.toggle('open');
  });

  // Copy button
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!currentReportDate) {
      showToast('日付を先に選択してください', 'error');
      document.getElementById('mainDateInput')?.focus();
      return;
    }
    let output: string;

    if (category.isEmail) {
      const emailEntry = currentEntries.find((en) => en.categoryId === category.id);
      const selEntry = emailEntry?.subItemEntries.find((se) => se.subItemId === '__email_selection__');
      const selected: string[] = selEntry ? JSON.parse(selEntry.value || '[]') : [];
      const settings2 = getSettings();
      const masterOrder = settings2.emailList.map(toFullEmail).filter(Boolean);
      output = masterOrder.filter((email) => selected.includes(email)).join('; ');
    } else {
      const settings = getSettings();
      output = generateCategoryOutput(category, currentEntries, settings.emailAddresses);
    }

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

  // Reset / Edit button
  resetBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (category.isEmail) {
      navigateTo('settings');
      navigateToSettingsTab('email');
      return;
    }
    const ok = await showConfirm(`「${category.name}」の入力内容をリセットしますか？`, 'リセット');
    if (!ok) return;
    currentEntries = currentEntries.filter((en) => en.categoryId !== category.id);
    saveCurrentEntries(currentEntries);
    const newBodyInner = renderBodyInner(category);
    body.replaceChild(newBodyInner, bodyInner);
    bodyInner = newBodyInner;
    showToast(`${category.name}をリセットしました`, 'info');
  });

  // Deselect button
  deselectBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const entry = currentEntries.find((en) => en.categoryId === category.id);
    const hasData = entry?.subItemEntries.some((se) => se.value.trim()) ?? false;
    if (hasData) {
      const ok = await showConfirm(
        `「${category.name}」を使用しない状態に戻すと、入力した内容が消えます。外しますか？`,
        '外す'
      );
      if (!ok) return;
    }
    selectedCategoryIds.delete(category.id);
    saveSelectedCategoryIds(Array.from(selectedCategoryIds));
    currentEntries = currentEntries.filter((en) => en.categoryId !== category.id);
    saveCurrentEntries(currentEntries);
    const inactiveCard = renderInactiveCard(category);
    card.replaceWith(inactiveCard);
  });

  return card;
}

// ===== Render category card =====
function renderCategoryCard(category: Category): HTMLElement {
  return selectedCategoryIds.has(category.id)
    ? renderActiveCard(category)
    : renderInactiveCard(category);
}

// ===== Render all categories =====
function renderCategories(): void {
  const settings = getSettings();
  const list = document.getElementById('categoryList')!;
  list.innerHTML = '';
  for (const cat of settings.categories) {
    list.appendChild(renderCategoryCard(cat));
  }
}

// ===== Save modal =====
function openSaveModal(): void {
  if (!currentReportDate) {
    showToast('日付を先に選択してください', 'error');
    document.getElementById('mainDateInput')?.focus();
    return;
  }
  const [y, m, d] = currentReportDate.split('-').map(Number);
  const dow = ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
  document.getElementById('saveModalDateText')!.textContent = `${m}月${d}日（${dow}）の週報を保存しますか？`;
  document.getElementById('saveModal')!.classList.add('active');
}

function closeSaveModal(): void {
  document.getElementById('saveModal')!.classList.remove('active');
}

function saveWeeklyReport(): void {
  const report = {
    id: generateId(),
    date: currentReportDate,
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

// ===== Init (exported, called by router) =====
export function initMain(): void {
  // 毎回: 状態復元 + 再レンダリング
  currentEntries = getCurrentEntries();
  selectedCategoryIds = new Set(getSelectedCategoryIds());

  const settings = getSettings();
  for (const cat of settings.categories) {
    if (cat.isEmail) selectedCategoryIds.add(cat.id);
  }
  saveSelectedCategoryIds(Array.from(selectedCategoryIds));
  renderCategories();

  // 一度だけ: 静的要素のイベントリスナー登録
  if (mainInitialized) return;
  mainInitialized = true;

  currentReportDate = localStorage.getItem(DATE_STORAGE_KEY) ?? '';
  if (!currentReportDate) {
    const today = new Date();
    currentReportDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    localStorage.setItem(DATE_STORAGE_KEY, currentReportDate);
  }
  const mainDateInput = document.getElementById('mainDateInput') as HTMLInputElement;
  mainDateInput.value = currentReportDate;
  updateDateDisplay();

  mainDateInput.addEventListener('change', () => {
    currentReportDate = mainDateInput.value;
    localStorage.setItem(DATE_STORAGE_KEY, currentReportDate);
    updateDateDisplay();
  });

  // 全てコピー
  document.getElementById('copyAllBtn')!.addEventListener('click', async () => {
    if (!currentReportDate) {
      showToast('日付を先に選択してください', 'error');
      document.getElementById('mainDateInput')?.focus();
      return;
    }
    const settings = getSettings();
    const parts: string[] = [];

    for (const cat of settings.categories) {
      if (!selectedCategoryIds.has(cat.id)) continue;

      if (cat.isEmail) {
        const emailEntry = currentEntries.find((en) => en.categoryId === cat.id);
        const selEntry = emailEntry?.subItemEntries.find((se) => se.subItemId === '__email_selection__');
        const selected: string[] = selEntry ? JSON.parse(selEntry.value || '[]') : [];
        const masterOrder = settings.emailList.map(toFullEmail).filter(Boolean);
        const emailOutput = masterOrder.filter((email) => selected.includes(email)).join('; ');
        if (emailOutput) parts.push(emailOutput);
      } else {
        const output = generateCategoryOutput(cat, currentEntries, settings.emailAddresses);
        if (output.trim()) parts.push(output);
      }
    }

    if (parts.length === 0) {
      showToast('コピーする入力がありません', 'error');
      return;
    }

    const fullOutput = parts.join('\n\n');
    navigator.clipboard.writeText(fullOutput).then(() => {
      const btn = document.getElementById('copyAllBtn')!;
      btn.textContent = '✓ コピー済み';
      showToast('全項目をコピーしました', 'success');
      setTimeout(() => { btn.textContent = '全てコピー'; }, 2000);
    }).catch(() => showToast('コピーに失敗しました', 'error'));
  });

  document.getElementById('resetAllBtn')!.addEventListener('click', async () => {
    const ok = await showConfirm('すべての入力内容をリセットしますか？\n（設定・履歴は消えません）', 'リセット');
    if (!ok) return;
    currentEntries = [];
    saveCurrentEntries(currentEntries);
    renderCategories();
    // 全カードを閉じる
    document.querySelectorAll('.category-card.open').forEach((el) => el.classList.remove('open'));
    showToast('すべてリセットしました', 'info');
  });

  document.getElementById('saveBtn')!.addEventListener('click', openSaveModal);
  document.getElementById('modalCancelBtn')!.addEventListener('click', closeSaveModal);
  document.getElementById('modalSaveBtn')!.addEventListener('click', saveWeeklyReport);
  document.getElementById('saveModal')!.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSaveModal();
  });
}
