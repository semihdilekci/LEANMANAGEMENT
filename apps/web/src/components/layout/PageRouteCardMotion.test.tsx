import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { PageRouteCardMotion } from './PageRouteCardMotion';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

describe('PageRouteCardMotion', () => {
  it('içeriği render eder ve ls-card için gecikme değişkeni atar', () => {
    const { container } = render(
      <PageRouteCardMotion>
        <div className="ls-card">A</div>
        <div className="ls-card">B</div>
      </PageRouteCardMotion>,
    );

    const cards = container.querySelectorAll<HTMLElement>('.ls-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]?.style.getPropertyValue('--card-enter-delay').trim()).toBe('0ms');
    expect(cards[1]?.style.getPropertyValue('--card-enter-delay').trim()).toBe('42ms');
  });
});
