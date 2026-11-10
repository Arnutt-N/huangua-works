// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Conversation } from '../_lib/types';
import { ConversationList } from './conversation-list';

const room: Conversation = {
  id: 'c1',
  mode: 'human_active',
  lastMessageText: 'สวัสดี',
  lastMessageAt: null,
  lastMessageSender: null,
  unreadAdmin: 1,
  assignedAdminId: null,
  linkedCaseId: null,
  displayName: 'สมชาย',
  lineUserId: null,
};

function renderList(collapsed: boolean) {
  render(
    <ConversationList
      collapsed={collapsed}
      onToggleCollapsed={() => {}}
      visible={[room]}
      counts={{ all: 1, waiting: 0, active: 1 }}
      loading={false}
      filter="all"
      setFilter={() => {}}
      sort="newest"
      setSort={() => {}}
      query=""
      setQuery={() => {}}
      searchResults={[]}
      searching={false}
      selectedId={null}
      onSelect={() => {}}
      onTogglePin={() => {}}
      onToggleMute={() => {}}
      onMarkRead={() => {}}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('รายการห้องแชทตอนย่อ', () => {
  it('ย่อเหลือปุ่มรูปและชื่อห้อง ไม่ซ่อนทั้งแผง', () => {
    renderList(true);
    expect(screen.getByRole('complementary', { name: 'การสนทนา LINE' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'สมชาย' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'แสดงรายการสนทนา' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'ค้นหาการสนทนา' })).not.toBeInTheDocument();
  });

  it('ตอนขยายยังมีช่องค้นหาและชื่อห้อง', () => {
    renderList(false);
    expect(screen.getByRole('searchbox', { name: 'ค้นหาการสนทนา' })).toBeInTheDocument();
    expect(screen.getByText('สมชาย')).toBeInTheDocument();
  });
});
