// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useRouter ต้องมี App Router context — mock เป็น stub ที่จำ refresh ได้
const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { LiffProvider, useLiff } from './liff-provider';

/** consumer จิ๋วไว้อ่าน context ออกมาเป็นข้อความ ตรวจง่าย */
function Probe() {
  const liff = useLiff();
  return (
    <div>
      <span data-testid="status">{liff.status}</span>
      <span data-testid="authenticated">{String(liff.authenticated)}</span>
      <span data-testid="in-client">{String(liff.isInClient)}</span>
      <span data-testid="display-name">{liff.displayName ?? '-'}</span>
      <span data-testid="children">ok</span>
    </div>
  );
}

function mockFetch(overrides: { get?: Response; post?: Response } = {}) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      return (
        overrides.post ??
        new Response(JSON.stringify({ ok: true, displayName: 'สมชาย ไลน์' }), { status: 200 })
      );
    }
    return overrides.get ?? new Response(JSON.stringify({ authenticated: false }), { status: 200 });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refreshMock.mockClear();
  delete (window as { liff?: unknown }).liff;
});

describe('LiffProvider', () => {
  it('ไม่มี LIFF ID (และไม่มี mock param) → status disabled และ children render ตามปกติ', async () => {
    vi.stubEnv('NEXT_PUBLIC_LIFF_ID', '');
    mockFetch();

    render(
      <LiffProvider>
        <Probe />
      </LiffProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('disabled'));
    expect(screen.getByTestId('children')).toHaveTextContent('ok');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('mock param (?liffmock=) → สร้าง session ผ่าน POST → authenticated + displayName', async () => {
    window.history.pushState({}, '', '/intake?liffmock=Utest123');
    const fetchMock = mockFetch();

    render(
      <LiffProvider>
        <Probe />
      </LiffProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('true'), {
      timeout: 3000,
    });
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
    expect(screen.getByTestId('in-client')).toHaveTextContent('true');
    // mock path ไม่มีโปรไฟล์จริง — displayName ใช้ userId ตาม ensureMockSession
    expect(screen.getByTestId('display-name')).toHaveTextContent('Utest123');

    // ส่ง mock token รูปแบบ mock.<lineUserId> — server env เป็นด่านจริง
    const postCall = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
    expect(postCall).toBeDefined();
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({ idToken: 'mock.Utest123' });
  });

  it('session ที่มีอยู่แล้ว (GET authenticated) → ไม่ POST ซ้ำ', async () => {
    window.history.pushState({}, '', '/intake?liffmock=Utest123');
    const fetchMock = mockFetch({ get: new Response(JSON.stringify({ authenticated: true }), { status: 200 }) });

    render(
      <LiffProvider>
        <Probe />
      </LiffProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('true'), {
      timeout: 3000,
    });
    const postCall = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
    expect(postCall).toBeUndefined();
  });

  it('SDK init ล้มเหลว → status error (fallback ฟอร์มเดิม ไม่ throw ตลอดทาง)', async () => {
    vi.stubEnv('NEXT_PUBLIC_LIFF_ID', '1234-abcd');
    mockFetch();
    // มี liff object แต่ init reject
    (window as { liff?: unknown }).liff = {
      init: vi.fn().mockRejectedValue(new Error('init failed')),
      isInClient: () => true,
      isLoggedIn: () => true,
      getIDToken: () => 'tok',
      getProfile: async () => ({}),
    };

    render(
      <LiffProvider>
        <Probe />
      </LiffProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'), {
      timeout: 3000,
    });
    expect(screen.getByTestId('children')).toHaveTextContent('ok');
  });
});
