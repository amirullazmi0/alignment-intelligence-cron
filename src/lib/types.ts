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
}

export interface Run {
    id: string;
    scheduleId: string | null;
    ministry: string;
    ministryLabel: string;
    keywords: string[];
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
