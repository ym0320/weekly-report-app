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
import { navigateToSettingsTab, scrollToSettingsCategory } from './settings';

// ===== State =====
let currentEntries: CategoryEntry[] = [];
let selectedCategoryIds: Set<string> = new Set();
let currentReportDate: string = '';
const DATE_STORAGE_KEY = 'weeklyReportApp_selectedDate';

let mainInitialized = false;
const activityCounts = new Map<string, number>();

// ===== Multi-activity helpers =====
function supportsMultiActivity(category: Category): boolean {
  if (category.isEmail) return false;
  return category.subItems.some((si) => si.label.endsWith('内容'));
}

function deriveActivityCount(categoryId: string, subItems: SubItem[]): number {
  const entry = currentEntries.find((e) => e.categoryId === categoryId);
  if (!entry) return 1;
  let count = 1;
  for (let idx = 1; idx < 20; idx++) {
    const hasAny = subItems.some((si) => {
      const id = `${si.id}__${idx}`;
      return entry.subItemEntries.some((se) => se.subItemId === id && se.value.trim());
    });
    if (!hasAny) break;
    count = idx + 1;
  }
  return count;
}

const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

function removeActivity(category: Category, actIdx: number): void {
  const count = activityCounts.get(category.id) || 1;
  const entry = currentEntries.find((e) => e.categoryId === category.id);

  if (entry) {
    // 全活動のデータを収集（削除対象をスキップ）
    const kept: { baseId: string; value: string }[][] = [];
    for (let i = 0; i < count; i++) {
      if (i === actIdx) continue;
      const group: { baseId: string; value: string }[] = [];
      for (const si of category.subItems) {
        const id = i === 0 ? si.id : `${si.id}__${i}`;
        const se = entry.subItemEntries.find((e) => e.subItemId === id);
        if (se) group.push({ baseId: si.id, value: se.value });
      }
      kept.push(group);
    }

    // 全活動エントリを削除
    const allIds = new Set<string>();
    for (let i = 0; i < count; i++) {
      for (const si of category.subItems) {
        allIds.add(i === 0 ? si.id : `${si.id}__${i}`);
      }
    }
    entry.subItemEntries = entry.subItemEntries.filter((se) => !allIds.has(se.subItemId));

    // 連番を詰めて再書き込み
    kept.forEach((group, newIdx) => {
      for (const item of group) {
        const newId = newIdx === 0 ? item.baseId : `${item.baseId}__${newIdx}`;
        entry.subItemEntries.push({ subItemId: newId, value: item.value });
      }
    });

    saveCurrentEntries(currentEntries);
  }

  const newCount = count - 1;
  if (newCount <= 1) {
    activityCounts.delete(category.id);
  } else {
    activityCounts.set(category.id, newCount);
  }

  // カード再描画
  const card = document.querySelector(`[data-category-id="${category.id}"]`) as HTMLElement;
  if (card) {
    const newCard = renderActiveCard(category);
    card.replaceWith(newCard);
  }
}

function getHeaderSubItem(category: Category): SubItem | undefined {
  return category.subItems.find((si) => si.useOfficeMaster) ||
         category.subItems.find((si) => si.type === 'select');
}

function relabelForMultiActivity(subItem: SubItem, _category: Category, circledIdx: number): SubItem {
  const cleanLabel = subItem.label.replace(/^\(\d+\)\s*/, '');
  return { ...subItem, label: `${CIRCLED_NUMBERS[circledIdx] || `(${circledIdx + 1})`}${cleanLabel}` };
}

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
    const labelRow = document.createElement('div');
    labelRow.className = 'field-label-row';

    const lbl = document.createElement('span');
    lbl.className = 'field-label';
    lbl.textContent = subItem.label;

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-inline-link';
    editBtn.textContent = offices.length > 0 ? '編集' : '登録';
    editBtn.addEventListener('click', () => {
      navigateTo('settings');
      navigateToSettingsTab('office');
    });

    labelRow.appendChild(lbl);
    labelRow.appendChild(editBtn);
    wrapper.appendChild(labelRow);
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

  // マスター未登録の事務所名をblur時に登録提案
  input.addEventListener('blur', async () => {
    const val = input.value.trim();
    if (!val || offices.includes(val)) return;

    const ok = await showConfirm(`「${val}」は事務所マスターに未登録です。登録しますか？`, '登録する');
    if (!ok) return;

    const settings = getSettings();
    settings.offices.push(val);
    saveSettings(settings);
    showToast('事務所マスターに登録しました', 'success');

    // datalistを更新
    const newOpt = document.createElement('option');
    newOpt.value = val;
    datalist.appendChild(newOpt);
  });

  wrapper.appendChild(input);
  wrapper.appendChild(datalist);
  return wrapper;
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
    if (category.name === '特記事項' && !subItem.defaultValue) {
      textarea.placeholder = 'エリアルールに基づき、記載してください。';
    }
    textarea.addEventListener('input', () => {
      setSubItemValue(category.id, subItem.id, textarea.value);
    });

    wrapper.appendChild(textarea);

  } else {
    const lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.textContent = subItem.label;
    wrapper.appendChild(lbl);

    const textarea = document.createElement('textarea');
    textarea.className = 'field-textarea';
    textarea.value = value;
    if (subItem.label.endsWith('内容')) {
      textarea.placeholder = 'テーマが複数ある場合は、テーマ毎に分けて記載';
      textarea.classList.add('field-textarea-lg');
    }
    textarea.addEventListener('input', () => {
      setSubItemValue(category.id, subItem.id, textarea.value);
    });

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
  } else if (supportsMultiActivity(category)) {
    const count = activityCounts.get(category.id) || deriveActivityCount(category.id, category.subItems);
    activityCounts.set(category.id, count);
    const isMulti = count > 1;
    const headerSi = isMulti ? getHeaderSubItem(category) : undefined;
    const otherSis = isMulti ? category.subItems.filter((si) => si !== headerSi) : category.subItems;

    for (let actIdx = 0; actIdx < count; actIdx++) {
      const idSuffix = actIdx === 0 ? '' : `__${actIdx}`;

      if (isMulti) {
        const sep = document.createElement('div');
        sep.className = 'activity-separator';

        const sepLabel = document.createElement('span');
        sepLabel.textContent = `${actIdx + 1}つ目の活動`;
        sep.appendChild(sepLabel);

        const delActBtn = document.createElement('button');
        delActBtn.className = 'btn btn-danger btn-sm activity-del-btn';
        delActBtn.textContent = '削除';
        delActBtn.addEventListener('click', () => {
          removeActivity(category, actIdx);
        });
        sep.appendChild(delActBtn);

        bodyInner.appendChild(sep);

        // ヘッダー項目（事務所名 or テーマ）を表示
        if (headerSi) {
          const proxied = { ...headerSi, id: `${headerSi.id}${idSuffix}` };
          bodyInner.appendChild(renderSubItem(category, proxied));
        }

        // 残りの項目を①②表記で表示
        let circledIdx = 0;
        for (const si of otherSis) {
          const relabeled = relabelForMultiActivity(si, category, circledIdx);
          const proxied = { ...relabeled, id: `${si.id}${idSuffix}` };
          bodyInner.appendChild(renderSubItem(category, proxied));
          circledIdx++;
        }
      } else {
        for (const subItem of category.subItems) {
          bodyInner.appendChild(renderSubItem(category, subItem));
        }
      }
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-secondary btn-sm add-activity-btn';
    addBtn.textContent = `${count + 1}つ目の活動を登録する`;
    addBtn.addEventListener('click', () => {
      activityCounts.set(category.id, count + 1);
      // bodyのみ差し替え（スクロール維持）
      const card = document.querySelector(`[data-category-id="${category.id}"]`) as HTMLElement;
      if (card) {
        const body = card.querySelector('.category-body') as HTMLElement;
        const newBodyInner = renderBodyInner(category);
        const oldBodyInner = body.querySelector('.category-body-inner') as HTMLElement;
        if (oldBodyInner) {
          body.replaceChild(newBodyInner, oldBodyInner);
        }
        updateCardStatus(card, category);
      }
    });
    bodyInner.appendChild(addBtn);
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
    okBtn.focus();
  });
}

// ===== Category completion check =====
function isCategoryComplete(category: Category): boolean {
  if (category.isEmail) {
    const entry = currentEntries.find((e) => e.categoryId === category.id);
    const sel = entry?.subItemEntries.find((se) => se.subItemId === '__email_selection__');
    const selected: string[] = sel ? JSON.parse(sel.value || '[]') : [];
    return selected.length > 0;
  }
  const entry = currentEntries.find((e) => e.categoryId === category.id);
  if (!entry) return false;
  const count = activityCounts.get(category.id) || 1;
  for (let actIdx = 0; actIdx < count; actIdx++) {
    for (const si of category.subItems) {
      const id = actIdx === 0 ? si.id : `${si.id}__${actIdx}`;
      const se = entry.subItemEntries.find((e) => e.subItemId === id);
      if (!se || !se.value.trim()) return false;
    }
  }
  return true;
}

function updateCardStatus(card: HTMLElement, category: Category): void {
  if (category.isEmail) return;
  card.classList.toggle('complete', isCategoryComplete(category));
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

  addBtn.addEventListener('click', () => {
    activate();
  });

  return card;
}

// ===== Render active card =====
function renderActiveCard(category: Category): HTMLElement {
  const card = document.createElement('div');
  card.className = `category-card selected open${category.isEmail ? ' email-card' : ''}`;
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

  // 特記事項: 登録/編集リンク
  if (category.name === '特記事項') {
    const tokkiSub = category.subItems[0];
    const tokkiBtn = document.createElement('button');
    tokkiBtn.className = 'btn-inline-link';
    tokkiBtn.textContent = tokkiSub?.defaultValue ? '編集' : '登録';
    tokkiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateTo('settings');
      navigateToSettingsTab('design');
      setTimeout(() => scrollToSettingsCategory('cat-7'), 100);
    });
    headerLeft.appendChild(tokkiBtn);
  }

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

  // 完了状態チェック（初期 + input/change イベントで動的更新）
  updateCardStatus(card, category);
  card.addEventListener('input', () => updateCardStatus(card, category));
  card.addEventListener('change', () => updateCardStatus(card, category));

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

  // 連続コピー（順番コピー）
  let copyQueue: { name: string; text: string }[] = [];
  let copyIndex = -1;
  const copyAllBtn = document.getElementById('copyAllBtn')!;

  function resetCopyQueue(): void {
    copyQueue = [];
    copyIndex = -1;
    copyAllBtn.textContent = '連続コピー';
    copyAllBtn.classList.remove('btn-primary');
    copyAllBtn.classList.add('btn-secondary');
  }

  copyAllBtn.addEventListener('click', async () => {
    if (!currentReportDate) {
      showToast('日付を先に選択してください', 'error');
      document.getElementById('mainDateInput')?.focus();
      return;
    }

    if (copyIndex === -1) {
      const settings = getSettings();
      copyQueue = [];
      for (const cat of settings.categories) {
        if (!selectedCategoryIds.has(cat.id)) continue;
        let text = '';
        if (cat.isEmail) {
          const emailEntry = currentEntries.find((en) => en.categoryId === cat.id);
          const selEntry = emailEntry?.subItemEntries.find((se) => se.subItemId === '__email_selection__');
          const selected: string[] = selEntry ? JSON.parse(selEntry.value || '[]') : [];
          const masterOrder = settings.emailList.map(toFullEmail).filter(Boolean);
          text = masterOrder.filter((email) => selected.includes(email)).join('; ');
        } else {
          text = generateCategoryOutput(cat, currentEntries, settings.emailAddresses);
        }
        if (text.trim()) copyQueue.push({ name: cat.name, text });
      }
      if (copyQueue.length === 0) {
        showToast('コピーする入力がありません', 'error');
        return;
      }
      copyIndex = 0;
    }

    const item = copyQueue[copyIndex];
    try {
      await navigator.clipboard.writeText(item.text);
      showToast(`${item.name} をコピー（${copyIndex + 1}/${copyQueue.length}）`, 'success');
    } catch {
      showToast('コピーに失敗しました', 'error');
      resetCopyQueue();
      return;
    }

    copyIndex++;
    if (copyIndex < copyQueue.length) {
      copyAllBtn.textContent = `次へ: ${copyQueue[copyIndex].name}（${copyIndex + 1}/${copyQueue.length}）`;
      copyAllBtn.classList.remove('btn-secondary');
      copyAllBtn.classList.add('btn-primary');
    } else {
      copyAllBtn.textContent = '✓ 全項目コピー完了';
      setTimeout(resetCopyQueue, 2000);
    }
  });

  document.getElementById('resetAllBtn')!.addEventListener('click', async () => {
    const ok = await showConfirm('すべての入力内容をリセットしますか？\n（設定・履歴は消えません）', 'リセット');
    if (!ok) return;
    currentEntries = [];
    saveCurrentEntries(currentEntries);
    // 選択状態・活動数もクリア
    activityCounts.clear();
    const settings2 = getSettings();
    selectedCategoryIds = new Set<string>();
    for (const cat of settings2.categories) {
      if (cat.isEmail) selectedCategoryIds.add(cat.id);
    }
    saveSelectedCategoryIds(Array.from(selectedCategoryIds));
    // 日付を本日に戻す
    const today = new Date();
    currentReportDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    localStorage.setItem(DATE_STORAGE_KEY, currentReportDate);
    (document.getElementById('mainDateInput') as HTMLInputElement).value = currentReportDate;
    updateDateDisplay();
    renderCategories();
    showToast('すべてリセットしました', 'info');
  });

  document.getElementById('saveBtn')!.addEventListener('click', openSaveModal);
  document.getElementById('modalCancelBtn')!.addEventListener('click', closeSaveModal);
  document.getElementById('modalSaveBtn')!.addEventListener('click', saveWeeklyReport);
  document.getElementById('saveModal')!.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSaveModal();
  });
}
