/**
 * JDIHN; PASAL_ID: API metadata pasal.id dengan PDF dari situs resmi .go.id;
 * PERATURAN_GO_ID: katalog resmi peraturan.go.id, disusuri per jenis peraturan.
 */
export type CollectorSource = 'JDIHN' | 'PASAL_ID' | 'PERATURAN_GO_ID';

export const SOURCE_LABELS: Record<CollectorSource, string> = {
    JDIHN: 'JDIHN',
    PASAL_ID: 'pasal.id',
    PERATURAN_GO_ID: 'peraturan.go.id',
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

export type DocumentStatus =
    | 'DISCOVERED'
    | 'SKIPPED_NO_PDF'
    | 'UPLOADED'
    | 'DUPLICATE'
    | 'FAILED_RETRYABLE'
    | 'FAILED_PERMANENT'
    | 'PARSE_FAILED'
    | 'SOURCE_CHANGED';

/** Label dan warna status dokumen, dalam bahasa yang dipahami bukan-programmer. */
export const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; hint: string; badge: string }> = {
    UPLOADED: {
        label: 'Masuk Alignment',
        hint: 'Sudah dikirim ke Alignment dan sedang/sudah diproses jadi teks pasal.',
        badge: 'badge-success',
    },
    DUPLICATE: {
        label: 'Sudah ada',
        hint: 'Alignment sudah punya dokumen yang sama; tidak dikirim ulang.',
        badge: 'badge-info',
    },
    DISCOVERED: {
        label: 'Ditemukan',
        hint: 'Tercatat dari sumber, belum diproses.',
        badge: 'badge-ghost',
    },
    SKIPPED_NO_PDF: {
        label: 'Tanpa PDF',
        hint: 'Sumber tidak menyediakan PDF, jadi dilewati.',
        badge: 'badge-ghost',
    },
    SOURCE_CHANGED: {
        label: 'Berubah di sumber',
        hint: 'Isi atau PDF di sumber berubah setelah diunggah; perlu ditinjau.',
        badge: 'badge-warning',
    },
    FAILED_RETRYABLE: {
        label: 'Gagal, dicoba lagi',
        hint: 'Gangguan sementara (jaringan, 403, 5xx). Run berikutnya mencoba ulang, maksimal 5 kali.',
        badge: 'badge-warning',
    },
    FAILED_PERMANENT: {
        label: 'Gagal permanen',
        hint: 'PDF tidak ada (404), tautan tidak aman, atau sudah gagal 5 kali.',
        badge: 'badge-error',
    },
    PARSE_FAILED: {
        label: 'Gagal dibaca',
        hint: 'Halaman sumber tidak bisa diurai.',
        badge: 'badge-error',
    },
};

export interface CollectedDocument {
    sourceId: string;
    source: CollectorSource;
    sourceUrl: string;
    title: string;
    attachmentUrl: string | null;
    institution: string | null;
    status: DocumentStatus;
    alignmentDocumentId: string | null;
    attempts: number;
    errorCode: string | null;
    errorMessage: string | null;
    firstSeenAt: string;
    updatedAt: string;
    runId: string | null;
    scheduleId: string | null;
    runLabel: string | null;
}

export interface Regulation {
    sourceId: string;
    catalogue: string;
    title: string;
    lawType: string;
    lawNumber: string | null;
    lawYear: number | null;
    issuer: string | null;
    status: string | null;
    relations: { kind: string; target: string }[];
    pageUrl: string;
    pdfUrl: string | null;
    textStatus: 'PENDING' | 'RETRY' | 'REGISTERED' | 'DUPLICATE' | 'NO_PDF' | 'FAILED';
    alignmentDocumentId: string | null;
}

export interface CatalogueStat {
    catalogue: string;
    total: number;
    checked: number;
    with_text: number;
    text_failed: number;
    revoked: number;
}

export type CatalogJob = 'sync_new' | 'sweep' | 'refresh_details' | 'ingest_text';

export interface CatalogJobReport {
    job: CatalogJob;
    startedAt: string;
    finishedAt: string | null;
    durationSeconds: number | null;
    counts: Record<string, number>;
    error: string | null;
}

export interface CatalogStats {
    catalogues: CatalogueStat[];
    recentChanges: {
        sourceId: string;
        title: string;
        field: string;
        oldValue: string | null;
        newValue: string | null;
        changedAt: string;
    }[];
    busy: boolean;
    jobs: Partial<Record<CatalogJob, CatalogJobReport>>;
}

export const CATALOGUE_LABELS: Record<string, string> = {
    uu: 'Undang-Undang',
    perppu: 'Perppu',
    pp: 'Peraturan Pemerintah',
    perpres: 'Peraturan Presiden',
    permen: 'Peraturan Menteri',
    perda: 'Peraturan Daerah',
};
