import type { Category, CategoryEntry } from './types';

export const EMAIL_DOMAIN = '@tkc.ne.jp';

/** メールプレフィックスからフルアドレスに変換 */
export function toFullEmail(prefix: string): string {
  return prefix.trim() ? prefix.trim() + EMAIL_DOMAIN : '';
}

export function generateCategoryOutput(
  category: Category,
  allEntries: CategoryEntry[],
  _emailAddresses: string // 後方互換のため残すが使わない
): string {
  // isEmailカテゴリの処理はメイン側で対応するため空文字返す
  if (category.isEmail) return '';

  const entry = allEntries.find((e) => e.categoryId === category.id);
  if (!entry) return '';

  const lines: string[] = [];
  for (const subItem of category.subItems) {
    const subEntry = entry.subItemEntries.find((se) => se.subItemId === subItem.id);
    const value = subEntry?.value?.trim() ?? '';
    if (!value) continue;

    if (!subItem.label) {
      lines.push(value);
    } else if (subItem.label.includes('●')) {
      lines.push(subItem.label.replace('●', value));
    } else {
      // (n) プレフィックスがある場合は2行形式: ラベル行 + インデントした値行
      const prefixMatch = subItem.label.match(/^\(\d+\) /);
      if (prefixMatch) {
        const indent = ' '.repeat(prefixMatch[0].length);
        lines.push(subItem.label);
        lines.push(indent + value);
      } else {
        lines.push(`${subItem.label}: ${value}`);
      }
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
