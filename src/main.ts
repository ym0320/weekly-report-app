import './style.css';
import type { Category, CategoryEntry, SubItem, SubItemEntry } from './types';
import {
  getSettings,
  saveReport,
  getCurrentEntries,
  saveCurrentEntries,
  getSelectedCategoryIds,
  saveSelectedCategoryIds,
} from './storage';
import { generateCategoryOutput, generateId, toFullEmail } from './utils';

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

// ===== Office master combo box =====
function renderOfficeMasterSubItem(category: Category, subItem: SubItem, offices: string[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'field-group';

  if (subItem.label) {
    const lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.textContent = subItem.label;
    wrapper.appendChild(lbl);
  }

  const combo = document.createElement('div');
  combo.className = 'office-combo';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'field-input office-search-input';
  input.placeholder = '事務所名を検索または直接入力...';
  input.value = getSubItemValue(category.id, subItem.id);

  const dropdown = document.createElement('div');
  dropdown.className = 'office-dropdown';
  dropdown.style.display = 'none';

  const showDropdown = (filter: string) => {
    dropdown.innerHTML = '';
    const filtered = offices.filter((o) => o.includes(filter));
    if (filtered.length === 0) {
      dropdown.style.display = 'none';
      return;
    }
    filtered.forEach((office) => {
      const item = document.createElement('div');
      item.className = 'office-dropdown-item';
      item.textContent = office;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = office;
        setSubItemValue(category.id, subItem.id, office);
        dropdown.style.display = 'none';
      });
      dropdown.appendChild(item);
    });
    dropdown.style.display = 'block';
  };

  input.addEventListener('input', () => {
    setSubItemValue(category.id, subItem.id, input.value);
    showDropdown(input.value);
  });
  input.addEventListener('focus', () => showDropdown(input.value));
  input.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 150));

  combo.appendChild(input);
  combo.appendChild(dropdown);
  wrapper.appendChild(combo);
  return wrapper;
}

// ===== Render sub item =====
function renderSubItem(category: Category, subItem: SubItem): HTMLElement {
  // useOfficeMaster チェックを最初に
  if (subItem.useOfficeMaster) {
    const settings = getSettings();
    return renderOfficeMasterSubItem(category, subItem, settings.offices);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'field-group';

  // defaultValue: 未入力時はデフォルト値を使用（特記事項など）
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
function renderBodyInner(category: Category): HTMLElement {
  const bodyInner = document.createElement('div');
  bodyInner.className = 'category-body-inner';

  if (category.isEmail) {
    const settings = getSettings();
    const emailList = settings.emailList;

    // このカテゴリのcurrentEntryから選択中メールを取得
    // subItemId: '__email_selection__', value: JSON.stringify(string[])
    const emailEntry = currentEntries.find((e) => e.categoryId === category.id);
    const selectionEntry = emailEntry?.subItemEntries.find((se) => se.subItemId === '__email_selection__');
    // emailListはプレフィックスのみ保存。表示・コピーはフルアドレスを使う
    const fullEmailList = emailList.map(toFullEmail).filter(Boolean);
    let selectedEmails: string[] = selectionEntry
      ? JSON.parse(selectionEntry.value || '[]')
      : [...fullEmailList]; // デフォルト: 全選択

    // 選択を保存する関数
    const saveSelection = () => {
      setSubItemValue(category.id, '__email_selection__', JSON.stringify(selectedEmails));
    };

    // 初回: デフォルトを保存
    if (!selectionEntry && fullEmailList.length > 0) {
      saveSelection();
    }

    if (fullEmailList.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'email-empty-hint';
      hint.textContent = '設定でメールアドレスを登録してください';
      bodyInner.appendChild(hint);
    } else {
      // 各メールをトグル可能な行として表示
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
  // メールカテゴリは必須なので✕（選択解除）ボタンを非表示
  if (!category.isEmail) {
    headerRight.appendChild(deselectBtn);
  }
  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  // Body
  const body = document.createElement('div');
  body.className = 'category-body';

  let bodyInner = renderBodyInner(category);
  body.appendChild(bodyInner);

  card.appendChild(header);
  card.appendChild(body);

  // Accordion toggle (header-left only)
  headerLeft.addEventListener('click', () => {
    card.classList.toggle('open');
  });

  // Copy button
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    let output: string;

    if (category.isEmail) {
      const emailEntry = currentEntries.find((en) => en.categoryId === category.id);
      const selEntry = emailEntry?.subItemEntries.find((se) => se.subItemId === '__email_selection__');
      const selected: string[] = selEntry ? JSON.parse(selEntry.value || '[]') : [];
      output = selected.join('; ');
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

  // Reset button (category-level)
  resetBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
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

  // メールカテゴリは常に選択状態にする
  const settings = getSettings();
  for (const cat of settings.categories) {
    if (cat.isEmail) selectedCategoryIds.add(cat.id);
  }
  saveSelectedCategoryIds(Array.from(selectedCategoryIds));

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
