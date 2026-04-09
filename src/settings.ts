import './style.css';
import type { Category, SubItem } from './types';
import { getSettings, saveSettings } from './storage';
import { generateId } from './utils';

// ===== State =====
let categories: Category[] = [];
let emailAddresses = '';
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

// ===== Drag and Drop for categories =====
let dragSrcCatIndex: number | null = null;

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

  // Label + type row
  const row1 = document.createElement('div');
  row1.className = 'sub-item-row';

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'sub-label-input';
  labelInput.value = subItem.label;
  labelInput.placeholder = 'ラベル（空欄可）';
  labelInput.addEventListener('input', () => {
    subItem.label = labelInput.value;
    markDirty();
  });

  const typeSelect = document.createElement('select');
  typeSelect.className = 'sub-type-select';
  const optText = document.createElement('option');
  optText.value = 'text';
  optText.textContent = 'テキスト入力';
  const optSelect = document.createElement('option');
  optSelect.value = 'select';
  optSelect.textContent = '単一選択';
  typeSelect.appendChild(optText);
  typeSelect.appendChild(optSelect);
  typeSelect.value = subItem.type;
  typeSelect.addEventListener('change', () => {
    subItem.type = typeSelect.value as 'select' | 'text';
    markDirty();
    // Re-render to show/hide options field
    renderCatList();
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-danger btn-sm';
  delBtn.textContent = '削除';
  delBtn.addEventListener('click', () => {
    cat.subItems.splice(subIndex, 1);
    markDirty();
    renderCatList();
  });

  row1.appendChild(labelInput);
  row1.appendChild(typeSelect);
  row1.appendChild(delBtn);
  fields.appendChild(row1);

  // Options row (only for select type)
  if (subItem.type === 'select') {
    const optionsInput = document.createElement('input');
    optionsInput.type = 'text';
    optionsInput.className = 'sub-options-input';
    optionsInput.placeholder = '選択肢をカンマ区切りで入力 例: 選択肢A, 選択肢B';
    optionsInput.value = subItem.options.join(', ');
    optionsInput.addEventListener('input', () => {
      subItem.options = optionsInput.value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      markDirty();
    });

    const optHint = document.createElement('p');
    optHint.className = 'sub-options-hint';
    optHint.textContent = '選択肢をカンマ区切りで入力';

    fields.appendChild(optionsInput);
    fields.appendChild(optHint);
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
    emailAddresses,
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
  emailAddresses = settings.emailAddresses;

  const emailInput = document.getElementById('emailAddresses') as HTMLInputElement;
  emailInput.value = emailAddresses;
  emailInput.addEventListener('input', () => {
    emailAddresses = emailInput.value;
    markDirty();
  });

  renderCatList();

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

  window.addEventListener('beforeunload', beforeUnloadHandler);
}

init();
