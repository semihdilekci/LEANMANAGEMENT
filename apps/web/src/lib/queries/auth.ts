import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export const authQueryKeys = {
  me: ['me'] as const,
  consentVersion: (id: string) => ['consent-version', id] as const,
};

export function useConsentVersionQuery(consentVersionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: authQueryKeys.consentVersion(consentVersionId ?? 'none'),
    enabled: enabled && !!consentVersionId,
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        data: { id: string; version: number; title: string; body: string; locale: string };
      }>(`/api/v1/consent-versions/${consentVersionId!}`);
      if (!res.data.success || !res.data.data) {
        throw new Error('Rıza metni yüklenemedi');
      }
      return res.data.data;
    },
    staleTime: 5 * 60_000,
  });
}
