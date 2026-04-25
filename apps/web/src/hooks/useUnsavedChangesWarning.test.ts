import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';

function beforeUnloadCallCount(addSpy: ReturnType<typeof vi.spyOn>) {
  return addSpy.mock.calls.filter((c) => c[0] === 'beforeunload').length;
}

describe('useUnsavedChangesWarning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty true iken beforeunload dinleyicisi ekler ve unmount kaldırır', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const before = beforeUnloadCallCount(add);
    const { unmount } = renderHook(() => useUnsavedChangesWarning(true));
    expect(beforeUnloadCallCount(add)).toBeGreaterThan(before);
    unmount();
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('dirty false iken en az bir beforeunload eklemez (hook pasif)', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const before = beforeUnloadCallCount(add);
    const { unmount } = renderHook(() => useUnsavedChangesWarning(false));
    expect(beforeUnloadCallCount(add)).toBe(before);
    unmount();
  });
});
