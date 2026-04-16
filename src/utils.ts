import type { Category, CategoryEntry, SubItem } from './types';

export const EMAIL_DOMAIN = '@tkc.co.jp';

export function toFullEmail(prefix: string): string {
  return prefix.trim() ? prefix.trim() + EMAIL_DOMAIN : '';
}

const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

function getActivityCount(category: Category, entry: CategoryEntry): number {
  let count = 1;
  for (let idx = 1; idx < 20; idx++) {
    const hasAny = category.subItems.some((si) => {
      const id = `${si.id}__${idx}`;
      return entry.subItemEntries.some((se) => se.subItemId === id && se.value.trim());
    });
    if (!hasAny) break;
    count = idx + 1;
  }
  return count;
}

function getHeaderSubItem(category: Category): SubItem | undefined {
  return category.subItems.find((si) => si.useOfficeMaster) ||
         category.subItems.find((si) => si.type === 'select');
}

function supportsMultiActivity(category: Category): boolean {
  if (category.isEmail) return false;
  return category.subItems.some((si) => si.label.endsWith('内容'));
}

function generateSingleOutput(category: Category, entry: CategoryEntry): string {
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

function generateMultiOutput(category: Category, entry: CategoryEntry, actCount: number): string {
  const headerSi = getHeaderSubItem(category);
  const otherSis = category.subItems.filter((si) => si !== headerSi);
  const lines: string[] = [];

  for (let actIdx = 0; actIdx < actCount; actIdx++) {
    const getId = (si: SubItem) => actIdx === 0 ? si.id : `${si.id}__${actIdx}`;

    // ヘッダー: (N) 事務所名 or テーマ名
    if (headerSi) {
      const headerValue = entry.subItemEntries.find((se) => se.subItemId === getId(headerSi))?.value?.trim() ?? '';
      if (headerValue) {
        lines.push(`(${actIdx + 1}) ${headerValue}`);
      }
    }

    // 他の項目: ①②形式
    let circledIdx = 0;
    for (const si of otherSis) {
      const value = entry.subItemEntries.find((se) => se.subItemId === getId(si))?.value?.trim() ?? '';
      if (!value) continue;

      const circle = CIRCLED_NUMBERS[circledIdx] || `(${circledIdx + 1})`;
      circledIdx++;

      const cleanLabel = si.label.replace(/^\(\d+\)\s*/, '');

      if (si.label.includes('●')) {
        const cleanInline = si.label.replace(/^\(\d+\)\s*/, '').replace('●', value);
        lines.push(`  ${circle}${cleanInline}`);
      } else if (cleanLabel) {
        lines.push(`  ${circle}${cleanLabel}: ${value}`);
      } else {
        lines.push(`  ${circle}${value}`);
      }
    }
  }

  return lines.join('\n');
}

export function generateCategoryOutput(
  category: Category,
  allEntries: CategoryEntry[],
  _emailAddresses: string
): string {
  if (category.isEmail) return '';

  const entry = allEntries.find((e) => e.categoryId === category.id);
  if (!entry) return '';

  if (supportsMultiActivity(category)) {
    const actCount = getActivityCount(category, entry);
    if (actCount > 1) {
      return generateMultiOutput(category, entry, actCount);
    }
  }

  return generateSingleOutput(category, entry);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}
