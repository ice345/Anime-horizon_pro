import { z } from 'zod';
import { Anime } from '../../types';
import { normalizeAnimeRecord } from '../../shared/schemas/anime';
import { getDefaultArchiveStatus } from '../../services/archiveStatus';

export const CURRENT_BACKUP_VERSION = 2;
export const MAX_BACKUP_ENTRIES = 2_000;
export const MAX_BACKUP_VIEW_ENTRIES = 500;

const idSchema = z
  .union([z.string().trim().min(1).max(32), z.number().int().positive().max(2_000_000_000)])
  .transform(String)
  .refine((id) => /^\d{1,32}$/.test(id), '作品 ID 必须是数字');

const backupConfigSchema = z
  .object({
    itemsPerSeason: z.coerce.number().int().min(10).max(50).optional(),
    startYear: z.coerce.number().int().min(1900).max(2200).optional(),
    endYear: z.coerce.number().int().min(1900).max(2200).optional(),
  })
  .passthrough()
  .default({});

const rawBackupSchema = z
  .object({
    version: z.coerce.number().int().positive().optional().default(1),
    timestamp: z.string().max(80).optional(),
    config: backupConfigSchema,
    userSelection: z.array(idSchema).max(MAX_BACKUP_ENTRIES).default([]),
    userDetails: z.array(z.unknown()).max(MAX_BACKUP_ENTRIES).default([]),
    currentViewData: z.array(z.unknown()).max(MAX_BACKUP_VIEW_ENTRIES).default([]),
  })
  .passthrough();

export interface NormalizedBackup {
  version: typeof CURRENT_BACKUP_VERSION;
  timestamp: string;
  config: {
    itemsPerSeason?: number;
    startYear?: number;
    endYear?: number;
  };
  userSelection: string[];
  userDetails: Anime[];
  currentViewData: Anime[];
}

const normalizeEntries = (entries: unknown[], max: number, isArchive = false) => {
  const seen = new Set<string>();
  const normalized: Anime[] = [];
  for (const entry of entries.slice(0, max)) {
    const anime = normalizeAnimeRecord(entry);
    const rawStatus =
      typeof entry === 'object' && entry !== null ? (entry as { userStatus?: unknown }).userStatus : undefined;
    if (isArchive && rawStatus !== 'PLAN' && rawStatus !== 'WATCHING' && rawStatus !== 'COMPLETED') {
      anime.userStatus = getDefaultArchiveStatus(anime);
    }
    if (seen.has(anime.id)) continue;
    seen.add(anime.id);
    normalized.push(anime);
  }
  return normalized;
};

export const parseAndMigrateBackup = (value: unknown): NormalizedBackup => {
  const raw = rawBackupSchema.parse(value);
  if (raw.version !== 1 && raw.version !== CURRENT_BACKUP_VERSION) {
    throw new Error(`不支持的备份版本：${raw.version}`);
  }

  const userDetails = normalizeEntries(raw.userDetails, MAX_BACKUP_ENTRIES, true);
  const currentViewData = normalizeEntries(raw.currentViewData, MAX_BACKUP_VIEW_ENTRIES);
  const detailIds = userDetails.map((anime) => anime.id);
  const userSelection = Array.from(new Set([...raw.userSelection, ...detailIds]));

  return {
    version: CURRENT_BACKUP_VERSION,
    timestamp: raw.timestamp || new Date().toISOString(),
    config: {
      itemsPerSeason: raw.config.itemsPerSeason,
      startYear: raw.config.startYear,
      endYear: raw.config.endYear,
    },
    userSelection,
    userDetails,
    currentViewData,
  };
};

export const createBackup = (input: Omit<NormalizedBackup, 'version' | 'timestamp'>): NormalizedBackup => ({
  ...input,
  version: CURRENT_BACKUP_VERSION,
  timestamp: new Date().toISOString(),
});
