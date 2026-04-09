import type { Category, CategoryEntry } from './types';

export function generateCategoryOutput(
  category: Category,
  entries: CategoryEntry[],
  emailAddresses: string
): string {
  if (category.isEmail) {
    return emailAddresses.trim();
  }

  const entry = entries.find((e) => e.categoryId === category.id);
  const lines: string[] = [];

  for (const subItem of category.subItems) {
    const subEntry = entry?.subItemEntries.find((se) => se.subItemId === subItem.id);
    const value = subEntry?.value?.trim() ?? '';

    if (!value) continue;

    if (subItem.label === '') {
      // ラベルなし: 値のみ出力
      lines.push(value);
    } else if (subItem.label.includes('●')) {
      // インライン: ●を値で置換
      lines.push(subItem.label.replace('●', value));
    } else if (subItem.type === 'select') {
      // selectの場合: ラベル → 全角スペース2つ + 値
      lines.push(subItem.label);
      lines.push('\u3000\u3000' + value);
    } else {
      // textの場合: ラベル → 値
      lines.push(subItem.label);
      lines.push(value);
    }
  }

  return lines.join('\n');
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}
