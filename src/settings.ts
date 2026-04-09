import './style.css';
import type { Category, SubItem } from './types';
import { getSettings, saveSettings, exportBackup, importBackup } from './storage';
import type { BackupData } from './storage';
import { generateId, EMAIL_DOMAIN } from './utils';

// ===== State =====
let categories: Category[] = [];
let emailList: string[] = [];
let offices: string[] = [];
let isDirty = false;

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

function markDirty(): void {
  isDirty = true;
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

// ===== Drag and Drop for categories =====
let dragSrcCatIndex: number | null = null;

// ===== Drag and Drop for options =====
let dragSrcOptIndex: number | null = null;
let dragSrcOptSubId: string | null = null;

function setupCatDragAndDrop(item: HTMLElement, index: number): void {
  item.setAttribute('draggable', 'true');

  item.addEventListener('dragstart', () => {
    dragSrcCatIndex = index;
    item.classList.add('dragging');
  });

  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    dragSrcCatIndex = null;
    document.querySelectorAll('.cat-item').forEach((el) => el.classList.remove('drag-over'));
  });

  item.addEventListener('dragover', (e) => {
    e.preventDefault();
    item.classList.add('drag-over');
  });

  item.addEventListener('dragleave', () => {
    item.classList.remove('drag-over');
  });

  item.addEventListener('drop', (e) => {
    e.preventDefault();
    item.classList.remove('drag-over');
    if (dragSrcCatIndex === null || dragSrcCatIndex === index) return;
    const moved = categories.splice(dragSrcCatIndex, 1)[0];
    categories.splice(index, 0, moved);
    markDirty();
    renderCatList();
  });
}

// ===== Drag and Drop for sub items =====
let dragSrcSubIndex: number | null = null;
let dragSrcSubCatId: string | null = null;

function setupSubDragAndDrop(item: HTMLElement, catId: string, subIndex: number): void {
  item.setAttribute('draggable', 'true');

  item.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    dragSrcSubIndex = subIndex;
    dragSrcSubCatId = catId;
    item.classList.add('dragging');
  });

  item.addEventListener('dragend', (e) => {
    e.stopPropagation();
    item.classList.remove('dragging');
    dragSrcSubIndex = null;
    dragSrcSubCatId = null;
    document.querySelectorAll('.sub-item').forEach((el) => el.classList.remove('drag-over'));
  });

  item.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    item.classList.add('drag-over');
  });

  item.addEventListener('dragleave', (e) => {
    e.stopPropagation();
    item.classList.remove('drag-over');
  });

  item.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    item.classList.remove('drag-over');
    if (
      dragSrcSubIndex === null ||
      dragSrcSubCatId !== catId ||
      dragSrcSubIndex === subIndex
    ) return;
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const moved = cat.subItems.splice(dragSrcSubIndex, 1)[0];
    cat.subItems.splice(subIndex, 0, moved);
    markDirty();
    renderCatList();
  });
}

// ===== Create option item for select type =====
function createOptionItem(subItem: SubItem, optIndex: number, optList: HTMLElement): HTMLElement {
  const item = document.createElement('div');
  item.className = 'option-item';
  item.setAttribute('draggable', 'true');

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '≡';
  handle.title = 'ドラッグして並べ替え';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'option-input';
  input.value = subItem.options[optIndex];
  input.addEventListener('input', () => {
    subItem.options[optIndex] = input.value;
    markDirty();
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'option-delete-btn';
  deleteBtn.textContent = '×';
  deleteBtn.addEventListener('click', () => {
    subItem.options.splice(optIndex, 1);
    markDirty();
    renderCatList();
  });

  // Drag events (scoped to this option list)
  item.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    dragSrcOptIndex = optIndex;
    dragSrcOptSubId = subItem.id;
    item.classList.add('dragging');
  });

  item.addEventListener('dragend', (e) => {
    e.stopPropagation();
    item.classList.remove('dragging');
    dragSrcOptIndex = null;
    dragSrcOptSubId = null;
    optList.querySelectorAll('.option-item').forEach((el) => el.classList.remove('drag-over'));
  });

  item.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    item.classList.add('drag-over');
  });

  item.addEventListener('dragleave', (e) => {
    e.stopPropagation();
    item.classList.remove('drag-over');
  });

  item.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    item.classList.remove('drag-over');
    if (
      dragSrcOptIndex === null ||
      dragSrcOptSubId !== subItem.id ||
      dragSrcOptIndex === optIndex
    ) return;
    const moved = subItem.options.splice(dragSrcOptIndex, 1)[0];
    subItem.options.splice(optIndex, 0, moved);
    markDirty();
    renderCatList();
  });

  item.appendChild(handle);
  item.appendChild(input);
  item.appendChild(deleteBtn);
  return item;
}

// ===== Render sub item in settings =====
function renderSettingsSubItem(cat: Category, subItem: SubItem, subIndex: number): HTMLElement {
  const item = document.createElement('div');
  item.className = 'sub-item';

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '≡';
  handle.title = 'ドラッグして並べ替え';
  item.appendChild(handle);

  const fields = document.createElement('div');
  fields.className = 'sub-item-fields';

  // Row 1: ラベル + 削除ボタン（右端）
  const labelRow = document.createElement('div');
  labelRow.className = 'sub-item-label-row';

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'sub-label-input';
  labelInput.value = subItem.label;
  labelInput.placeholder = 'ラベル（空欄可）';
  labelInput.addEventListener('input', () => {
    subItem.label = labelInput.value;
    markDirty();
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-danger btn-sm';
  delBtn.textContent = '削除';
  delBtn.addEventListener('click', () => {
    cat.subItems.splice(subIndex, 1);
    markDirty();
    renderCatList();
  });

  labelRow.appendChild(labelInput);
  labelRow.appendChild(delBtn);
  fields.appendChild(labelRow);

  // Row 2: タイプ選択 + オプション
  const typeRow = document.createElement('div');
  typeRow.className = 'sub-item-type-row';

  const typeSelect = document.createElement('select');
  typeSelect.className = 'sub-type-select';
  const optText = document.createElement('option');
  optText.value = 'text';
  optText.textContent = 'テキスト入力';
  const optSelect = document.createElement('option');
  optSelect.value = 'select';
  optSelect.textContent = '選択';
  typeSelect.appendChild(optText);
  typeSelect.appendChild(optSelect);
  typeSelect.value = subItem.type;
  typeSelect.addEventListener('change', () => {
    subItem.type = typeSelect.value as 'select' | 'text';
    markDirty();
    renderCatList();
  });
  typeRow.appendChild(typeSelect);

  // useOfficeMaster toggle (only for text type)
  if (subItem.type === 'text') {
    const officeMasterCb = document.createElement('input');
    officeMasterCb.type = 'checkbox';
    officeMasterCb.id = `om-${subItem.id}`;
    officeMasterCb.checked = subItem.useOfficeMaster ?? false;
    officeMasterCb.addEventListener('change', () => {
      subItem.useOfficeMaster = officeMasterCb.checked;
      markDirty();
    });

    const officeMasterLabel = document.createElement('label');
    officeMasterLabel.htmlFor = `om-${subItem.id}`;
    officeMasterLabel.textContent = '事務所マスター';
    officeMasterLabel.className = 'office-master-toggle-label';

    typeRow.appendChild(officeMasterCb);
    typeRow.appendChild(officeMasterLabel);
  }

  fields.appendChild(typeRow);

  // Options list (only for select type)
  if (subItem.type === 'select') {
    const optList = document.createElement('div');
    optList.className = 'options-list';

    subItem.options.forEach((_opt, optIndex) => {
      optList.appendChild(createOptionItem(subItem, optIndex, optList));
    });

    const addOptBtn = document.createElement('button');
    addOptBtn.className = 'btn btn-secondary btn-sm';
    addOptBtn.textContent = '＋ 選択肢を追加';
    addOptBtn.addEventListener('click', () => {
      subItem.options.push('新しい選択肢');
      markDirty();
      renderCatList();
    });

    fields.appendChild(optList);
    fields.appendChild(addOptBtn);
  }

  item.appendChild(fields);
  setupSubDragAndDrop(item, cat.id, subIndex);

  return item;
}

// ===== Render category item in settings =====
function renderSettingsCatItem(cat: Category, index: number): HTMLElement {
  const item = document.createElement('div');
  item.className = 'cat-item';
  item.dataset.catId = cat.id;

  // Header
  const header = document.createElement('div');
  header.className = 'cat-item-header';

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '≡';
  handle.title = 'ドラッグして並べ替え';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'cat-name-input';
  nameInput.value = cat.name;
  if (cat.isEmail) {
    nameInput.readOnly = true;
    nameInput.title = '変更不可';
  }
  nameInput.addEventListener('input', () => {
    cat.name = nameInput.value;
    markDirty();
  });

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn btn-secondary btn-sm';
  toggleBtn.textContent = '▼';
  toggleBtn.title = '展開/折りたたみ';

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-danger btn-sm';
  delBtn.textContent = '削除';
  if (cat.isEmail) {
    delBtn.disabled = true;
    delBtn.title = '削除不可';
    delBtn.style.opacity = '0.4';
    delBtn.style.cursor = 'not-allowed';
  }
  delBtn.addEventListener('click', () => {
    if (cat.isEmail) return;
    categories.splice(index, 1);
    markDirty();
    renderCatList();
  });

  header.appendChild(handle);
  header.appendChild(nameInput);
  header.appendChild(toggleBtn);
  header.appendChild(delBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'cat-item-body';

  if (!cat.isEmail) {
    const subList = document.createElement('div');
    subList.className = 'sub-list';

    cat.subItems.forEach((subItem, subIndex) => {
      subList.appendChild(renderSettingsSubItem(cat, subItem, subIndex));
    });

    const addSubBtn = document.createElement('button');
    addSubBtn.className = 'btn btn-secondary btn-sm';
    addSubBtn.textContent = '+ サブ項目追加';
    addSubBtn.addEventListener('click', () => {
      cat.subItems.push({
        id: generateId(),
        label: '',
        type: 'text',
        options: [],
      });
      markDirty();
      renderCatList();
    });

    body.appendChild(subList);
    body.appendChild(addSubBtn);
  } else {
    const note = document.createElement('p');
    note.style.color = 'var(--text-muted)';
    note.style.fontSize = '13px';
    note.textContent = 'マスター設定で入力したメールアドレスが自動出力されます。';
    body.appendChild(note);
  }

  item.appendChild(header);
  item.appendChild(body);

  // Toggle accordion
  toggleBtn.addEventListener('click', () => {
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open', !isOpen);
    toggleBtn.textContent = isOpen ? '▼' : '▶';
  });

  setupCatDragAndDrop(item, index);

  return item;
}

// ===== Render email list =====
function renderEmailList(): void {
  const container = document.getElementById('emailListContainer')!;
  container.innerHTML = '';
  emailList.forEach((email, index) => {
    const row = document.createElement('div');
    row.className = 'email-master-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'email-master-input';
    input.value = email;
    input.placeholder = '例: yamada-taro';
    input.addEventListener('input', () => {
      emailList[index] = input.value;
      markDirty();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-sm';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', () => {
      emailList.splice(index, 1);
      markDirty();
      renderEmailList();
    });

    const domainLabel = document.createElement('span');
    domainLabel.className = 'email-domain-label';
    domainLabel.textContent = EMAIL_DOMAIN;

    row.appendChild(input);
    row.appendChild(domainLabel);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

// ===== Render office list =====
function renderOfficeList(): void {
  const container = document.getElementById('officeListContainer')!;
  container.innerHTML = '';
  offices.forEach((office, index) => {
    const row = document.createElement('div');
    row.className = 'office-master-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'office-master-input';
    input.value = office;
    input.placeholder = '事務所名を入力';
    input.addEventListener('input', () => {
      offices[index] = input.value;
      markDirty();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-sm';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', () => {
      offices.splice(index, 1);
      markDirty();
      renderOfficeList();
    });

    row.appendChild(input);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

// ===== Render cat list =====
function renderCatList(): void {
  const list = document.getElementById('catList')!;
  list.innerHTML = '';
  categories.forEach((cat, index) => {
    list.appendChild(renderSettingsCatItem(cat, index));
  });
}

// ===== Save settings =====
function doSaveSettings(): void {
  // Validate: check for empty category names
  for (const cat of categories) {
    if (!cat.name.trim()) {
      showToast('カテゴリ名が空のものがあります', 'error');
      return;
    }
  }

  const settings = {
    categories: categories.map((cat) => ({
      ...cat,
      subItems: cat.subItems.map((si) => ({ ...si })),
    })),
    emailAddresses: emailList.join('; '), // 後方互換
    emailList: [...emailList],
    offices: [...offices],
  };

  saveSettings(settings);
  isDirty = false;
  showToast('設定を保存しました', 'success');

  // Remove beforeunload
  window.removeEventListener('beforeunload', beforeUnloadHandler);
}

// ===== beforeunload =====
function beforeUnloadHandler(e: BeforeUnloadEvent): void {
  if (isDirty) {
    e.preventDefault();
  }
}

// ===== Init =====
function init(): void {
  const settings = getSettings();
  categories = settings.categories.map((cat) => ({
    ...cat,
    subItems: cat.subItems.map((si) => ({ ...si })),
  }));
  emailList = [...settings.emailList];
  offices = [...settings.offices];

  renderEmailList();
  renderOfficeList();
  renderCatList();

  // ===== 項目の設計 編集トグル =====
  const editDesignBtn = document.getElementById('editDesignBtn')!;
  const designEditArea = document.getElementById('designEditArea')!;
  editDesignBtn.addEventListener('click', () => {
    const isOpen = designEditArea.style.display !== 'none';
    designEditArea.style.display = isOpen ? 'none' : 'block';
    editDesignBtn.textContent = isOpen ? '編集' : '完了';
  });

  document.getElementById('addEmailBtn')!.addEventListener('click', () => {
    emailList.push('');
    markDirty();
    renderEmailList();
  });

  document.getElementById('addOfficeBtn')!.addEventListener('click', () => {
    offices.push('');
    markDirty();
    renderOfficeList();
  });

  document.getElementById('addCatBtn')!.addEventListener('click', () => {
    categories.push({
      id: generateId(),
      name: '新しいカテゴリ',
      subItems: [],
    });
    markDirty();
    renderCatList();
  });

  document.getElementById('saveSettingsBtn')!.addEventListener('click', doSaveSettings);

  // ===== Export =====
  document.getElementById('exportBtn')!.addEventListener('click', () => {
    const backup = exportBackup();
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `週報バックアップ_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('エクスポートしました', 'success');
  });

  // ===== Import =====
  document.getElementById('importBtn')!.addEventListener('click', () => {
    document.getElementById('importInput')!.click();
  });

  document.getElementById('importInput')!.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const ok = await showConfirm(
      '現在のすべてのデータ（設定・履歴・入力中データ）が上書きされます。インポートしますか？',
      'インポート'
    );
    (e.target as HTMLInputElement).value = '';
    if (!ok) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text) as BackupData;
      importBackup(backup);
      showToast('インポート完了。ページを再読み込みします...', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch {
      showToast('インポートに失敗しました。ファイル形式を確認してください', 'error');
    }
  });

  window.addEventListener('beforeunload', beforeUnloadHandler);
}

init();
