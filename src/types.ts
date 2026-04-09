export interface SubItem {
  id: string;
  label: string;       // e.g., "(1) テーマ" - emptyなら出力にラベルなし
  type: 'select' | 'text';
  options: string[];   // select型の選択肢
}

export interface Category {
  id: string;
  name: string;
  subItems: SubItem[];
  isEmail?: boolean;   // 報告先メールアドレスカテゴリ用
}

export interface SubItemEntry {
  subItemId: string;
  value: string;
}

export interface CategoryEntry {
  categoryId: string;
  subItemEntries: SubItemEntry[];
}

export interface WeeklyReport {
  id: string;
  date: string;          // "YYYY-MM-DD"
  categoryEntries: CategoryEntry[];
  savedAt: string;       // ISO timestamp
}

export interface AppSettings {
  categories: Category[];
  emailAddresses: string;
}

export interface AppData {
  settings: AppSettings;
  reports: WeeklyReport[];
}
