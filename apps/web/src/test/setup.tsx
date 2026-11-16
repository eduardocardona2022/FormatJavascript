import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

vi.mock('@uiw/react-codemirror', async () => {
  const { MockCodeMirror } = await import('./codemirror-mock');
  return { default: MockCodeMirror };
});

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

if (!('ResizeObserver' in window)) {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
}

if (!('PointerEvent' in window)) {
  vi.stubGlobal('PointerEvent', MouseEvent);
}

Object.defineProperty(window.HTMLElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value: vi.fn(),
});
Object.defineProperty(window.HTMLElement.prototype, 'releasePointerCapture', {
  configurable: true,
  value: vi.fn(),
});
Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
});

Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  value: vi.fn(() => 'blob:mock-url'),
});
Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  value: vi.fn(),
});
Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
  configurable: true,
  value: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
});
