import { describe, expect, it } from 'vitest';
import { callTool, listTools } from './tools';

// § pure unit ไม่แตะ DB: unknown_tool ถูกปฏิเสธก่อน resolve actor เสมอ

describe('listTools', () => {
  it('exposes the 5 documented tools', () => {
    expect(listTools().map((t) => t.name).sort()).toEqual(
      ['add_case_comment', 'get_case', 'get_system_setting', 'search_cases', 'update_case_status'].sort(),
    );
  });
});

describe('callTool deny-by-default', () => {
  it('rejects unknown tool without touching the database', async () => {
    await expect(callTool('drop_database', {}, 'nobody')).rejects.toThrow('unknown_tool');
  });
});
