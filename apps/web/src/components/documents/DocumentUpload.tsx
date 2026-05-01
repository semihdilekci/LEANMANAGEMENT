'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';

const SCAN_POLL_MS = 2000;
const SCAN_TIMEOUT_MS = 60_000;

const KTI_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Tarayıcı/OS bazen `File.type` boş bırakır; uzantıdan MIME çıkarırız (API ile uyumlu). */
export function resolveKtiImageContentType(
  file: Pick<File, 'name' | 'type'>,
): (typeof KTI_IMAGE_TYPES)[number] | null {
  const t = file.type.trim().toLowerCase();
  if (KTI_IMAGE_TYPES.includes(t as (typeof KTI_IMAGE_TYPES)[number])) {
    return t as (typeof KTI_IMAGE_TYPES)[number];
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return null;
}

export type DocumentUploadSlotItem = {
  id: string;
  filename: string;
  scanStatus: string;
};

type UploadRowState =
  | { phase: 'uploading'; progress: number }
  | { phase: 'scanning' }
  | { phase: 'clean' }
  | { phase: 'infected' }
  | { phase: 'error'; message: string }
  | { phase: 'timeout' };

type Row = {
  clientKey: string;
  documentId: string;
  filename: string;
  state: UploadRowState;
};

function cleanIdsFromRows(rows: Row[]): string[] {
  return rows.filter((r) => r.state.phase === 'clean').map((r) => r.documentId);
}

export interface DocumentUploadProps {
  /** Alan başlığı (erişilebilirlik) */
  label: string;
  /** Kısa açıklama metni */
  hint?: string;
  maxFiles?: number;
  disabled?: boolean;
  /** Yalnızca CLEAN olan doküman id listesi (form ile senkron) */
  value: string[];
  onChange: (documentIds: string[]) => void;
}

/**
 * KTİ öncesi/sonrası fotoğraflar: initiate → presigned PUT → complete → scan poll.
 * Worker yoksa tarama uzun sürebilir; zaman aşımında satır hatası gösterilir.
 */
export function DocumentUpload({
  label,
  hint = 'En az 1 adet; en fazla 10 adet; JPEG, PNG veya WebP; dosya başına en fazla 10 MB.',
  maxFiles = 10,
  disabled,
  value,
  onChange,
}: DocumentUploadProps) {
  const fileInputId = useId();
  const [rows, setRows] = useState<Row[]>([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(
    () => () => {
      for (const t of pollTimers.current.values()) {
        clearInterval(t);
      }
      pollTimers.current.clear();
    },
    [],
  );

  // setRows updater içinde doğrudan onChange → ebeveyn setState; React "render sırasında
  // farklı bileşeni güncelleme" uyarısı verir. Mikro görev ile commit sonrasına alınır.
  const pushCleanToParent = useCallback(
    (nextRows: Row[]) => {
      const ids = cleanIdsFromRows(nextRows);
      queueMicrotask(() => {
        onChange(ids);
      });
    },
    [onChange],
  );

  const stopPoll = useCallback((documentId: string) => {
    const t = pollTimers.current.get(documentId);
    if (t) {
      clearInterval(t);
      pollTimers.current.delete(documentId);
    }
  }, []);

  const startScanPoll = useCallback(
    (documentId: string, startedAt: number) => {
      stopPoll(documentId);
      const id = setInterval(async () => {
        if (Date.now() - startedAt > SCAN_TIMEOUT_MS) {
          stopPoll(documentId);
          setRows((prev) => {
            const next = prev.map((r) =>
              r.documentId === documentId ? { ...r, state: { phase: 'timeout' as const } } : r,
            );
            pushCleanToParent(next);
            return next;
          });
          return;
        }
        try {
          const res = await apiClient.get<{
            success: boolean;
            data: { scanStatus: string; scanResultDetail: string | null };
          }>(`/api/v1/documents/${encodeURIComponent(documentId)}/scan-status`);
          const { scanStatus: status, scanResultDetail } = res.data.data;
          if (status === 'CLEAN') {
            stopPoll(documentId);
            setRows((prev) => {
              const next = prev.map((r) =>
                r.documentId === documentId ? { ...r, state: { phase: 'clean' as const } } : r,
              );
              pushCleanToParent(next);
              return next;
            });
          } else if (status === 'INFECTED') {
            stopPoll(documentId);
            setRows((prev) => {
              const next = prev.map((r) =>
                r.documentId === documentId ? { ...r, state: { phase: 'infected' as const } } : r,
              );
              pushCleanToParent(next);
              return next;
            });
          } else if (status === 'SCAN_FAILED') {
            stopPoll(documentId);
            const msg =
              scanResultDetail?.trim() ||
              'Virüs taraması tamamlanamadı. Worker ve ClamAV yapılandırmasını kontrol edin.';
            setRows((prev) => {
              const next = prev.map((r) =>
                r.documentId === documentId
                  ? { ...r, state: { phase: 'error' as const, message: msg } }
                  : r,
              );
              pushCleanToParent(next);
              return next;
            });
          } else {
            setRows((prev) =>
              prev.map((r) =>
                r.documentId === documentId ? { ...r, state: { phase: 'scanning' as const } } : r,
              ),
            );
          }
        } catch {
          /* ağ hatası — bir sonraki poll’da tekrar dene */
        }
      }, SCAN_POLL_MS);
      pollTimers.current.set(documentId, id);
    },
    [pushCleanToParent, stopPoll],
  );

  const uploadFile = useCallback(
    async (file: File, contentType: (typeof KTI_IMAGE_TYPES)[number]): Promise<boolean> => {
      const clientKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      let accepted = false;
      setRows((prev) => {
        const cleanCount = prev.filter((r) => r.state.phase === 'clean').length;
        const busy = prev.filter(
          (r) => r.state.phase === 'uploading' || r.state.phase === 'scanning',
        ).length;
        if (cleanCount + busy >= maxFiles) return prev;
        accepted = true;
        return [
          ...prev,
          {
            clientKey,
            documentId: '',
            filename: file.name,
            state: { phase: 'uploading' as const, progress: 0 },
          },
        ];
      });
      if (!accepted) return false;

      try {
        const initRes = await apiClient.post<{
          success: boolean;
          data: {
            documentId: string;
            uploadUrl: string;
            uploadMethod: 'PUT';
            uploadHeaders: Record<string, string>;
          };
        }>('/api/v1/documents/upload-initiate', {
          filename: file.name,
          contentType,
          fileSizeBytes: file.size,
          contextType: 'PROCESS_START',
          contextData: { processType: 'BEFORE_AFTER_KAIZEN' },
        });
        const { documentId, uploadUrl, uploadHeaders } = initRes.data.data;

        setRows((prev) =>
          prev.map((r) =>
            r.clientKey === clientKey
              ? { ...r, documentId, state: { phase: 'uploading', progress: 30 } }
              : r,
          ),
        );

        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: uploadHeaders,
          body: file,
          mode: 'cors',
          // S3 farklı origin; cookie gönderimi CORS'ta Allow-Credentials ister ve genelde gerekmez
          credentials: 'omit',
        });
        if (!putRes.ok) {
          throw new Error(`Yükleme başarısız (${putRes.status})`);
        }

        setRows((prev) =>
          prev.map((r) =>
            r.clientKey === clientKey ? { ...r, state: { phase: 'uploading', progress: 70 } } : r,
          ),
        );

        await apiClient.post('/api/v1/documents', {
          documentId,
          filename: file.name,
          contentType,
          fileSizeBytes: file.size,
          contextType: 'PROCESS_START',
          contextData: { processType: 'BEFORE_AFTER_KAIZEN' },
        });

        setRows((prev) =>
          prev.map((r) =>
            r.clientKey === clientKey
              ? { ...r, documentId, state: { phase: 'scanning' as const } }
              : r,
          ),
        );
        startScanPoll(documentId, Date.now());
      } catch (e) {
        let message = 'Yükleme hatası';
        if (e instanceof Error) {
          message = e.message;
          if (
            e instanceof TypeError ||
            /failed to fetch|load failed|networkerror|aborted|cancelled/i.test(message)
          ) {
            message = `${message} — S3 CORS: Adres çubuğundaki tam kök (örn. http://localhost:3000) AllowedOrigins’te olmalı; localhost ile 127.0.0.1 ayrıdır. CORS’u presigned URL’deki bucket’ta tanımlayın. .env’de API_UPSTREAM_URL uzak sunucuysa, CORS ve bucket o ortama aittir; yalnızca web’i (npm run dev) yenilemek yetmez.`;
          }
        }
        setRows((prev) => {
          const next = prev.map((r) =>
            r.clientKey === clientKey ? { ...r, state: { phase: 'error' as const, message } } : r,
          );
          pushCleanToParent(next);
          return next;
        });
      }
      return true;
    },
    [maxFiles, pushCleanToParent, startScanPoll],
  );

  const handlePick: React.ChangeEventHandler<HTMLInputElement> = async (ev) => {
    const input = ev.target;
    // value temizlenmeden önce File[] kopyala — bazı tarayıcılarda FileList input ile canlı bağlıdır
    const files = input.files?.length ? Array.from(input.files) : [];
    input.value = '';
    if (files.length === 0) return;

    let queued = 0;
    let rejectedType = 0;
    let rejectedSize = 0;
    let rejectedCapacity = 0;

    for (const file of files) {
      const contentType = resolveKtiImageContentType(file);
      if (!contentType) {
        rejectedType += 1;
        continue;
      }
      if (file.size > 10_485_760) {
        rejectedSize += 1;
        continue;
      }
      const ok = await uploadFile(file, contentType);
      if (ok) queued += 1;
      else rejectedCapacity += 1;
    }

    if (queued > 0) return;

    if (rejectedType > 0) {
      const parts: string[] = [
        'Yalnızca JPEG, PNG veya WebP kabul edilir (.jpg, .jpeg, .png, .webp).',
      ];
      if (rejectedSize > 0) parts.push('10 MB üstü dosyalar reddedilir.');
      if (rejectedCapacity > 0) parts.push('Kotanız dolduysa mevcut dosyalardan silin.');
      toast.error(parts.join(' '));
      return;
    }
    if (rejectedSize > 0) {
      toast.error('Seçilen dosyalar 10 MB sınırını aşıyor. Daha küçük görüntü seçin.');
      return;
    }
    if (rejectedCapacity > 0) {
      toast.error(
        `En fazla ${maxFiles} görüntü yükleyebilirsiniz. Devam etmek için listeden dosya kaldırın.`,
      );
    }
  };

  const removeRow = (clientKey: string, documentId: string) => {
    if (documentId) stopPoll(documentId);
    setRows((prev) => {
      const next = prev.filter((r) => r.clientKey !== clientKey);
      pushCleanToParent(next);
      return next;
    });
  };

  const cleanCount = rows.filter((r) => r.state.phase === 'clean').length;
  const busyCount = rows.filter(
    (r) => r.state.phase === 'uploading' || r.state.phase === 'scanning',
  ).length;
  const canAddMore = cleanCount + busyCount < maxFiles;

  return (
    <div className="space-y-[var(--space-3)]">
      <div>
        <p className="text-sm font-medium text-[var(--color-neutral-900)]">{label}</p>
        <p className="text-xs text-[var(--color-neutral-600)]">{hint}</p>
      </div>
      <input
        id={fileInputId}
        type="file"
        accept={[...KTI_IMAGE_TYPES, '.jpg', '.jpeg', '.png', '.webp'].join(',')}
        multiple
        className="sr-only"
        aria-label={label}
        disabled={disabled || !canAddMore}
        onChange={handlePick}
      />
      {disabled || !canAddMore ? (
        <span
          className="ls-btn ls-btn--neutral ls-btn--sm inline-flex cursor-not-allowed items-center gap-2 opacity-50"
          aria-disabled="true"
        >
          <Upload className="h-4 w-4" aria-hidden />
          Dosya seç
        </span>
      ) : (
        <label
          htmlFor={fileInputId}
          className="ls-btn ls-btn--neutral ls-btn--sm inline-flex cursor-pointer items-center gap-2"
        >
          <Upload className="h-4 w-4" aria-hidden />
          Dosya seç
        </label>
      )}
      <ul className="grid gap-[var(--space-3)] sm:grid-cols-2" aria-live="polite">
        {rows.map((row) => (
          <li
            key={row.clientKey}
            className="ls-card flex flex-col gap-[var(--space-2)] p-[var(--space-3)] text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="truncate font-medium text-[var(--color-neutral-900)]">
                {row.filename}
              </span>
              <button
                type="button"
                className="ls-btn ls-btn--neutral ls-btn--sm shrink-0"
                aria-label={`${row.filename} dosyasını kaldır`}
                onClick={() => removeRow(row.clientKey, row.documentId)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <RowStatus row={row} />
          </li>
        ))}
      </ul>
      {value.length > 0 ? (
        <p className="text-xs text-[var(--color-neutral-500)]" aria-live="polite">
          {value.length} temiz dosya seçildi (gönderime hazır)
        </p>
      ) : null}
    </div>
  );
}

function RowStatus({ row }: { row: Row }) {
  switch (row.state.phase) {
    case 'uploading':
      return (
        <div className="flex items-center gap-2 text-[var(--color-neutral-600)]">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          <span>Yükleniyor… %{row.state.progress}</span>
        </div>
      );
    case 'scanning':
      return (
        <div className="flex items-center gap-2 text-[var(--color-neutral-600)]">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          <span>Taranıyor…</span>
        </div>
      );
    case 'clean':
      return <span className="text-[var(--color-success-700)]">Tarama tamam — güvenli</span>;
    case 'infected':
      return (
        <span className="text-[var(--color-error-700)]" role="alert">
          Zararlı yazılım tespit edildi. Dosyayı kaldırın.
        </span>
      );
    case 'timeout':
      return (
        <span className="text-[var(--color-error-700)]" role="alert">
          Tarama zaman aşımı. Dosyayı kaldırıp yeniden yükleyin.
        </span>
      );
    case 'error':
      return (
        <span className="text-[var(--color-error-700)]" role="alert">
          {row.state.message}
        </span>
      );
    default:
      return null;
  }
}
