import type { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-1',
    name: '共有事項',
    subItems: [
      {
        id: 'sub-1-1',
        label: '(1) テーマ',
        type: 'select',
        options: ['顧客の反応', '研修受講報告', '競合他社情報', 'クレーム・トラブル', 'その他'],
      },
      {
        id: 'sub-1-2',
        label: '(2) 内容',
        type: 'text',
        options: [],
      },
    ],
  },
  {
    id: 'cat-2',
    name: 'ロープレの実施',
    subItems: [
      {
        id: 'sub-2-1',
        label: '(1) 今週の実施回数：●回',
        type: 'text',
        options: [],
      },
      {
        id: 'sub-2-2',
        label: '(2) ロープレテーマ',
        type: 'text',
        options: [],
      },
      {
        id: 'sub-2-3',
        label: '　①実施した相手',
        type: 'text',
        options: [],
      },
      {
        id: 'sub-2-4',
        label: '　②得た気づき',
        type: 'text',
        options: [],
      },
    ],
  },
  {
    id: 'cat-3',
    name: '自計化推進活動',
    subItems: [
      {
        id: 'sub-3-1',
        label: '(1) テーマ',
        type: 'select',
        options: ['新規自計化', 'クラウド移行', 'ＭＶＰ推進'],
      },
      {
        id: 'sub-3-2',
        label: '(2) 会員事務所名',
        type: 'text',
        options: [],
        useOfficeMaster: true,
      },
      {
        id: 'sub-3-3',
        label: '(3) 面談前のゴール',
        type: 'text',
        options: [],
      },
      {
        id: 'sub-3-4',
        label: '(4) 活動結果',
        type: 'select',
        options: ['契約', '前進', '停滞', '拒絶'],
      },
      {
        id: 'sub-3-5',
        label: '(5) 活動内容',
        type: 'text',
        options: [],
      },
    ],
  },
  {
    id: 'cat-4',
    name: 'クラウド移行特選事務所への推進活動',
    subItems: [
      {
        id: 'sub-4-1',
        label: '(1) 活動プロセス',
        type: 'select',
        options: [
          '特選事務所の選定',
          'クラウド推進の動機づけ',
          '所長方針取得済み',
          '対象企業選定',
          '企業提案準備・実施',
          '企業提案済',
          '受注',
          '納品フォロー',
        ],
      },
      {
        id: 'sub-4-2',
        label: '(2) 会員事務所名',
        type: 'text',
        options: [],
        useOfficeMaster: true,
      },
      {
        id: 'sub-4-3',
        label: '(3) 面談前のゴール',
        type: 'text',
        options: [],
      },
      {
        id: 'sub-4-4',
        label: '(4) 活動結果',
        type: 'select',
        options: ['契約', '前進', '停滞', '拒絶'],
      },
      {
        id: 'sub-4-5',
        label: '(5) 活動内容',
        type: 'text',
        options: [],
      },
    ],
  },
  {
    id: 'cat-5',
    name: 'FX4クラウド推進活動',
    subItems: [
      {
        id: 'sub-5-1',
        label: '(1) 会員事務所名',
        type: 'text',
        options: [],
        useOfficeMaster: true,
      },
      {
        id: 'sub-5-2',
        label: '(2) 面談前のゴール',
        type: 'text',
        options: [],
      },
      {
        id: 'sub-5-3',
        label: '(3) 活動結果',
        type: 'select',
        options: ['契約', '前進', '停滞', '拒絶'],
      },
      {
        id: 'sub-5-4',
        label: '(4) 活動内容',
        type: 'text',
        options: [],
      },
    ],
  },
  {
    id: 'cat-6',
    name: 'OMS、TPS、HP推進活動',
    subItems: [
      {
        id: 'sub-6-1',
        label: '(1) テーマ',
        type: 'select',
        options: ['ＯＭＳ活用支援', 'ＴＰＳ新規', 'ＴＰＳフォロー', 'ＨＰ新規', 'ＨＰリニューアル'],
      },
      {
        id: 'sub-6-2',
        label: '(2) 会員事務所名',
        type: 'text',
        options: [],
        useOfficeMaster: true,
      },
      {
        id: 'sub-6-3',
        label: '(3) 面談前のゴール',
        type: 'text',
        options: [],
      },
      {
        id: 'sub-6-4',
        label: '(4) 活動結果',
        type: 'select',
        options: ['契約', '前進', '停滞', '拒絶'],
      },
      {
        id: 'sub-6-5',
        label: '(5) 活動内容',
        type: 'text',
        options: [],
      },
    ],
  },
  {
    id: 'cat-7',
    name: '特記事項',
    subItems: [
      {
        id: 'sub-7-1',
        label: '',
        type: 'text',
        options: [],
      },
    ],
  },
  {
    id: 'cat-8',
    name: '報告先メールアドレス',
    isEmail: true,
    subItems: [],
  },
];

export const DEFAULT_EMAIL_ADDRESSES = '';
