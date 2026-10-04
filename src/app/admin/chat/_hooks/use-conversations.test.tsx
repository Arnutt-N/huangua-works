// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationList } from '../_components/conversation-list';
import { useConversations } from './use-conversations';

function jsonRes(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function Probe() {
  const { visible, counts, loading, feedback, filter, setFilter, sort, setSort, query, setQuery, loadConversations } =
    useConversations();
  return (
    <>
      {feedback?.type === 'error' && <p role="status">{feedback.msg}</p>}
      <button type="button" onClick={() => void loadConversations()}>reload</button>
      <ConversationList
        visible={visible}
        counts={counts}
        loading={loading}
        filter={filter}
        setFilter={setFilter}
        sort={sort}
        setSort={setSort}
        query={query}
        setQuery={setQuery}
        searchResults={[]}
        searching={false}
        selectedId={null}
        onSelect={() => {}}
        onTogglePin={() => {}}
        onToggleMute={() => {}}
        onMarkRead={() => {}}
      />
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('inbox error ที่ผู้ใช้เห็น', () => {
  it('401 แสดง Unauthorized ไม่ใช่ข้อความทั่วไป', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes({ error: 'Unauthorized' }, false, 401)));
    render(<Probe />);
    expect(await screen.findByRole('status')).toHaveTextContent('Unauthorized');
    expect(screen.queryByText('โหลดข้อมูลไม่สำเร็จ')).not.toBeInTheDocument();
  });

  it('reload ครั้งถัดไปไม่ยก loading — list ไม่ถูกแทนด้วย skeleton', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1 ? jsonRes([]) : jsonRes({ error: 'Forbidden' }, false, 403);
      }),
    );
    render(<Probe />);
    await screen.findByText('ยังไม่มีการสนทนา');
    screen.getByRole('button', { name: 'reload' }).click();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Forbidden'));
    expect(screen.getByText('ยังไม่มีการสนทนา')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeNull();
  });
});
