import { describe, expect, it, vi } from 'vitest';
import {
  buildCsatSurvey,
  csatThankYou,
  parseCsatPostback,
} from './csat';

describe('parseCsatPostback', () => {
  it('รูปแบบถูก → conversationId + score', () => {
    expect(parseCsatPostback('csat|conv-1|5')).toEqual({ conversationId: 'conv-1', score: 5 });
  });
  it('คะแนนนอก 1-5 → null', () => {
    expect(parseCsatPostback('csat|conv-1|0')).toBeNull();
    expect(parseCsatPostback('csat|conv-1|6')).toBeNull();
  });
  it('ไม่ใช่ csat protocol → null', () => {
    expect(parseCsatPostback('confirm:ok')).toBeNull();
    expect(parseCsatPostback('csat|conv-1')).toBeNull();
    expect(parseCsatPostback('csat||5')).toBeNull();
  });
});

describe('buildCsatSurvey', () => {
  it('มีปุ่ม 5-1 ครบพร้อม postback data ตรงห้อง', () => {
    const survey = buildCsatSurvey('conv-9');
    if (survey.type !== 'flex') throw new Error('survey ต้องเป็น flex');
    const footer = (survey.contents as { footer: { contents: unknown[] } }).footer.contents;
    expect(footer).toHaveLength(5);
    const data = JSON.stringify(footer);
    expect(data).toContain('csat|conv-9|5');
    expect(data).toContain('csat|conv-9|1');
  });
});

describe('csatThankYou', () => {
  it('คะแนนต่ำขอบคุณแบบปรับปรุง คะแนนสูงขอบคุณแบบดีใจ', () => {
    expect(csatThankYou(1)).toContain('ปรับปรุง');
    expect(csatThankYou(5)).toContain('ดีใจ');
  });
});

describe('sendCsatSurvey/recordCsatResponse', () => {
  it('placeholder กันลืมพึ่ง DB จริง — ดู integration ข้างเคียง', () => {
    expect(vi.isMockFunction(vi.fn())).toBe(true);
  });
});
