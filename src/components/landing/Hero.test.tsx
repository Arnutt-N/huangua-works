// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Hero } from './Hero';

vi.mock('framer-motion', async () => {
  const { createElement } = await import('react');
  const animationProps = new Set(['initial', 'animate', 'transition', 'whileHover']);
  const motion = Object.fromEntries(['div', 'span', 'h1', 'p'].map((tag) => [
    tag,
    (props: Record<string, unknown>) => createElement(
      tag,
      Object.fromEntries(Object.entries(props).filter(([key]) => !animationProps.has(key))),
    ),
  ]));
  return { motion, useReducedMotion: () => true };
});

vi.mock('next/link', async () => {
  const { createElement } = await import('react');
  return { default: (props: Record<string, unknown>) => createElement('a', props) };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-30T16:59:59.000Z'));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test('HTML ใช้ปีจากเซิร์ฟเวอร์และ hydration ปรับปีเก่าโดยไม่มีข้อผิดพลาด', async () => {
  vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z'));
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Hero initialFiscalYearBE={2569} />);
  expect(container.textContent).toContain('ระบบออนไลน์ใหม่ ปีงบประมาณ 2569');
  document.body.appendChild(container);
  const onRecoverableError = vi.fn();
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, <Hero initialFiscalYearBE={2569} />, { onRecoverableError });
    });
    expect(container.textContent).toContain('ระบบออนไลน์ใหม่ ปีงบประมาณ 2570');
    expect(onRecoverableError).not.toHaveBeenCalled();
  } finally {
    await act(async () => root?.unmount());
    container.remove();
  }
});

test('หน้าเปิดค้างปรับปีงบประมาณภายในหนึ่งนาที', () => {
  render(<Hero initialFiscalYearBE={2569} />);
  expect(screen.getByText('ระบบออนไลน์ใหม่ ปีงบประมาณ 2569')).toBeTruthy();
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByText('ระบบออนไลน์ใหม่ ปีงบประมาณ 2570')).toBeTruthy();
  expect(screen.queryByText('ระบบออนไลน์ใหม่ ปีงบประมาณ 2569')).toBeNull();
});

test('กลับมาดูแท็บปรับปีทันทีโดยไม่ต้องรอรอบหนึ่งนาที', () => {
  render(<Hero initialFiscalYearBE={2569} />);
  vi.setSystemTime(new Date('2026-09-30T17:00:00.000Z'));
  expect(screen.getByText('ระบบออนไลน์ใหม่ ปีงบประมาณ 2569')).toBeTruthy();
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(screen.getByText('ระบบออนไลน์ใหม่ ปีงบประมาณ 2570')).toBeTruthy();
});

test('render ซ้ำคง subscription เดิมและ unmount ล้าง timer กับ listener', () => {
  const setInterval = vi.spyOn(window, 'setInterval');
  const addEventListener = vi.spyOn(document, 'addEventListener');
  const removeEventListener = vi.spyOn(document, 'removeEventListener');
  const { rerender, unmount } = render(<Hero initialFiscalYearBE={2569} />);
  const subscription = addEventListener.mock.calls.find(([event]) => event === 'visibilitychange');
  expect(subscription).toBeDefined();
  expect(vi.getTimerCount()).toBe(1);
  rerender(<Hero initialFiscalYearBE={2570} />);
  expect(setInterval).toHaveBeenCalledTimes(1);
  expect(screen.getByText('ระบบออนไลน์ใหม่ ปีงบประมาณ 2569')).toBeTruthy();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(removeEventListener).toHaveBeenCalledWith('visibilitychange', subscription?.[1]);
});
