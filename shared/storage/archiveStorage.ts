import { Anime } from '../../types';
import { normalizeAnimeRecord } from '../schemas/anime';
import { getDefaultArchiveStatus } from '../../services/archiveStatus';

export const ARCHIVE_STORAGE_KEYS = {
  selectedIds: 'anime-horizon-selected-v3',
  details: 'anime-horizon-details-v3',
} as const;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ArchiveStorageState {
  selectedIds: Set<string>;
  selectedAnimeDetails: Map<string, Anime>;
  recovered: boolean;
}

export class StoragePersistenceError extends Error {
  constructor(message = '无法保存本地年鉴数据') {
    super(message);
    this.name = 'StoragePersistenceError';
  }
}

const getStorage = (): StorageLike | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const parseIds = (raw: string | null) => {
  if (!raw) return new Set<string>();
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('年鉴 ID 数据不是数组');
  return new Set(
    value
      .slice(0, 2_000)
      .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
      .map(String)
      .filter((id) => /^\d{1,32}$/.test(id))
  );
};

const parseDetails = (raw: string | null) => {
  if (!raw) return new Map<string, Anime>();
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('年鉴详情数据不是数组');

  const details = new Map<string, Anime>();
  for (const entry of value.slice(0, 2_000)) {
    try {
      const anime = normalizeAnimeRecord(entry);
      const rawStatus =
        typeof entry === 'object' && entry !== null ? (entry as { userStatus?: unknown }).userStatus : undefined;
      if (rawStatus !== 'PLAN' && rawStatus !== 'WATCHING' && rawStatus !== 'COMPLETED') {
        anime.userStatus = getDefaultArchiveStatus(anime);
      }
      details.set(anime.id, anime);
    } catch {
      // Ignore one damaged entry and keep the rest of the local archive usable.
    }
  }
  return details;
};

export const loadArchiveState = (storage: StorageLike | null = getStorage()): ArchiveStorageState => {
  if (!storage) return { selectedIds: new Set(), selectedAnimeDetails: new Map(), recovered: false };
  let selectedIds = new Set<string>();
  let selectedAnimeDetails = new Map<string, Anime>();
  let recovered = false;
  try {
    selectedIds = parseIds(storage.getItem(ARCHIVE_STORAGE_KEYS.selectedIds));
  } catch {
    recovered = true;
  }
  try {
    selectedAnimeDetails = parseDetails(storage.getItem(ARCHIVE_STORAGE_KEYS.details));
  } catch {
    recovered = true;
  }
  if (selectedAnimeDetails.size > 0) {
    return {
      selectedIds: new Set(selectedAnimeDetails.keys()),
      selectedAnimeDetails,
      recovered: recovered || selectedAnimeDetails.size !== selectedIds.size,
    };
  }
  return { selectedIds, selectedAnimeDetails, recovered };
};

export const saveArchiveState = (
  state: Pick<ArchiveStorageState, 'selectedIds' | 'selectedAnimeDetails'>,
  storage: StorageLike | null = getStorage()
) => {
  if (!storage) return;
  try {
    storage.setItem(ARCHIVE_STORAGE_KEYS.selectedIds, JSON.stringify(Array.from(state.selectedIds)));
    storage.setItem(ARCHIVE_STORAGE_KEYS.details, JSON.stringify(Array.from(state.selectedAnimeDetails.values())));
  } catch {
    throw new StoragePersistenceError();
  }
};

export const clearArchiveState = (storage: StorageLike | null = getStorage()) => {
  if (!storage) return;
  try {
    storage.removeItem(ARCHIVE_STORAGE_KEYS.selectedIds);
    storage.removeItem(ARCHIVE_STORAGE_KEYS.details);
  } catch {
    throw new StoragePersistenceError('无法清除本地年鉴数据');
  }
};

export const subscribeToArchiveStorage = (listener: (state: ArchiveStorageState) => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (
      !Object.values(ARCHIVE_STORAGE_KEYS).includes(
        event.key as (typeof ARCHIVE_STORAGE_KEYS)[keyof typeof ARCHIVE_STORAGE_KEYS]
      )
    )
      return;
    listener(loadArchiveState());
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
};
