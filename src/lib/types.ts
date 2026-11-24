/** JDIHN, atau PASAL_ID: API metadata pasal.id dengan PDF dari situs resmi .go.id. */
export type CollectorSource = 'JDIHN' | 'PASAL_ID';

export const SOURCE_LABELS: Record<CollectorSource, string> = {
    JDIHN: 'JDIHN',
    PASAL_ID: 'pasal.id',
};

export interface MinistryOption {
    value: string;
    label: string;
    aliases: string[];
}

export interface Schedule {
    id: string;
    /** null berarti jadwal general: seluruh JDIHN, dibatasi keyword saja. */
    ministry: string | null;
    ministryLabel: string;
    aliases: string[];
    keywords: string[];
    source: CollectorSource;
    cronExpression: string;
    timezone: string;
    documentLimit: number;
    dryRun: boolean;
    isActive: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
}

export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface RunSummary {
    mode: string;
    dry_run: boolean;
    discovered: number;
    matched: number;
    uploaded: number;
    duplicates: number;
    skipped_existing: number;
    skipped_no_pdf: number;
    source_changed: number;
    failed: number;
    ministry: string | null;
    ministry_matched: number;
    source?: CollectorSource;
}

export interface Run {
    id: string;
    scheduleId: string | null;
    /** null berarti run general: seluruh JDIHN, dibatasi keyword saja. */
    ministry: string | null;
    ministryLabel: string;
    keywords: string[];
    source: CollectorSource;
    trigger: 'MANUAL' | 'CRON';
    status: RunStatus;
    dryRun: boolean;
    documentLimit: number | null;
    startedAt: string | null;
    finishedAt: string | null;
    summary: RunSummary | null;
    errorMessage: string | null;
    createdAt: string;
}

export interface LogLine {
    type: 'log';
    ts: string;
    level: string;
    logger: string;
    message: string;
}
