import type { AppData, AppSettings, CategoryEntry, WeeklyReport } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_EMAIL_ADDRESSES } from './defaults';

const STORAGE_KEY = 'weeklyReportApp';
const CURRENT_ENTRIES_KEY = 'weeklyReportApp_currentEntries';

export function loadData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const defaultData: AppData = {
      settings: {
        categories: DEFAULT_CATEGORIES,
        emailAddresses: DEFAULT_EMAIL_ADDRESSES,
      },
      reports: [],
    };
    saveData(defaultData);
    return defaultData;
  }
  try {
    return JSON.parse(raw) as AppData;
  } catch {
    const defaultData: AppData = {
      settings: {
        categories: DEFAULT_CATEGORIES,
        emailAddresses: DEFAULT_EMAIL_ADDRESSES,
      },
      reports: [],
    };
    saveData(defaultData);
    return defaultData;
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getSettings(): AppSettings {
  return loadData().settings;
}

export function saveSettings(settings: AppSettings): void {
  const data = loadData();
  data.settings = settings;
  saveData(data);
}

export function getReports(): WeeklyReport[] {
  return loadData().reports;
}

export function saveReport(report: WeeklyReport): void {
  const data = loadData();
  const existingIndex = data.reports.findIndex((r) => r.id === report.id);
  if (existingIndex >= 0) {
    data.reports[existingIndex] = report;
  } else {
    data.reports.push(report);
  }
  saveData(data);
}

export function getCurrentEntries(): CategoryEntry[] {
  const raw = localStorage.getItem(CURRENT_ENTRIES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CategoryEntry[];
  } catch {
    return [];
  }
}

export function saveCurrentEntries(entries: CategoryEntry[]): void {
  localStorage.setItem(CURRENT_ENTRIES_KEY, JSON.stringify(entries));
}

export function clearCurrentEntries(): void {
  localStorage.removeItem(CURRENT_ENTRIES_KEY);
}

const SELECTED_CATS_KEY = 'weeklyReportApp_selectedCats';

export function getSelectedCategoryIds(): string[] {
  const raw = localStorage.getItem(SELECTED_CATS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export function saveSelectedCategoryIds(ids: string[]): void {
  localStorage.setItem(SELECTED_CATS_KEY, JSON.stringify(ids));
}
