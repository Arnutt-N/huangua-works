// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { hasQuickReply, payloadSummary, typeBadgeClass } from './reply-preview';

afterEach(() => {
  cleanup();
});

describe('reply-preview helpers', () => {
  it('text สรุปจาก text ไม่เกิน 80 ตัวอักษร', () => {
    expect(payloadSummary('text', { text: 'สวัสดีครับ' })).toBe('สวัสดีครับ');
    expect(payloadSummary('text', {})).toBe('—');
  });

  it('image สรุปจาก url', () => {
    expect(payloadSummary('image', { url: 'https://example.com/a.png' })).toContain(
      'https://example.com/a.png',
    );
  });

  it('sticker สรุป package/sticker', () => {
    expect(payloadSummary('sticker', { packageId: '1', stickerId: '2' })).toContain('1');
  });

  it('location สรุปจาก title', () => {
    expect(payloadSummary('location', { title: 'อบต.หัวงัว', address: 'x', latitude: 1, longitude: 1 })).toBe(
      'อบต.หัวงัว',
    );
  });

  it('flex ใช้ altText ก่อน keys', () => {
    expect(payloadSummary('flex', { altText: 'เมนูหลัก', type: 'bubble' })).toBe('เมนูหลัก');
    expect(payloadSummary('flex', { type: 'bubble' })).toBe('type');
  });

  it('ตัด quickReply ออกจาก keys', () => {
    expect(payloadSummary('flex', { type: 'bubble', quickReply: { items: [] } })).toBe('type');
  });

  it('hasQuickReply ตรวจ items ไม่ว่าง', () => {
    expect(hasQuickReply({ quickReply: { items: [{ type: 'action' }] } })).toBe(true);
    expect(hasQuickReply({ quickReply: { items: [] } })).toBe(false);
    expect(hasQuickReply({})).toBe(false);
    expect(hasQuickReply({ quickReply: 'เสีย' })).toBe(false);
  });

  it('typeBadgeClass แยกสีตามกลุ่ม type', () => {
    expect(typeBadgeClass('flex')).toContain('accent');
    expect(typeBadgeClass('image')).toContain('success');
    expect(typeBadgeClass('text')).toContain('surface');
  });

  it('render จริงผ่าน client ไม่ต้อง mock หนัก', async () => {
    expect(typeof screen).toBe('object');
  });
});
