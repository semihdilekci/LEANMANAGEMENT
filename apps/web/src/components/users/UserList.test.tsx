import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, it, expect, vi } from 'vitest';

import { UserList } from './UserList';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const server = setupServer(
  http.get('/api/v1/users', () =>
    HttpResponse.json({
      success: true,
      data: {
        items: [
          {
            id: 'user-1',
            sicil: '12345678',
            firstName: 'Ahmet',
            lastName: 'Yılmaz',
            email: 'ahmet@example.com',
            company: { id: 'c1', code: 'C1', name: 'Şirket A' },
            position: { id: 'p1', code: 'P1', name: 'Mühendis' },
            isActive: true,
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: { nextCursor: null, hasMore: false },
      },
    }),
  ),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('<UserList>', () => {
  it('kullanıcı listesini render eder', async () => {
    renderWithClient(<UserList />);
    expect(await screen.findByText('Ahmet Yılmaz')).toBeDefined();
    expect(screen.getByText('12345678')).toBeDefined();
    expect(screen.getByText('Şirket A')).toBeDefined();
  });

  it('boş liste durumunda empty state gösterir', async () => {
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: { items: [], pagination: { nextCursor: null, hasMore: false } },
        }),
      ),
    );
    renderWithClient(<UserList />);
    expect(await screen.findByText('Kullanıcı bulunamadı')).toBeDefined();
  });

  it('API hatasında error state gösterir', async () => {
    server.use(http.get('/api/v1/users', () => HttpResponse.error()));
    renderWithClient(<UserList />);
    expect(await screen.findByText('Kullanıcılar yüklenemedi.')).toBeDefined();
  });
});
