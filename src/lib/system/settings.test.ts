import { describe, expect, it } from 'vitest';
import {
  DEFAULTS_EXPOSED_FOR_TEST,
  isSystemSettingKey,
  normalizeSystemSetting,
} from './settings';

// § pure unit รอบนี้ไม่แตะ DB: DB round-trip อยู่ใน system.integration.test.ts (T4)

describe('isSystemSettingKey', () => {
  it('accepts the 3 allowlist keys', () => {
    expect(isSystemSettingKey('maintenance_mode')).toBe(true);
    expect(isSystemSettingKey('audit_retention_days')).toBe(true);
    expect(isSystemSettingKey('import_default_org')).toBe(true);
  });

  it('rejects unknown keys', () => {
    expect(isSystemSettingKey('bot_enabled')).toBe(false);
    expect(isSystemSettingKey('')).toBe(false);
  });
});

describe('normalizeSystemSetting', () => {
  it('keeps a valid boolean', () => {
    expect(normalizeSystemSetting('maintenance_mode', true)).toBe(true);
  });

  it('falls back on wrong boolean type', () => {
    expect(normalizeSystemSetting('maintenance_mode', 'yes')).toBeUndefined();
  });

  it('keeps retention in range and rejects out of range', () => {
    expect(normalizeSystemSetting('audit_retention_days', 365)).toBe(365);
    expect(normalizeSystemSetting('audit_retention_days', 29)).toBeUndefined();
    expect(normalizeSystemSetting('audit_retention_days', 3651)).toBeUndefined();
    expect(normalizeSystemSetting('audit_retention_days', 30.5)).toBeUndefined();
  });

  it('keeps the fixed org literal only', () => {
    expect(normalizeSystemSetting('import_default_org', 'huangua')).toBe('huangua');
    expect(normalizeSystemSetting('import_default_org', 'other')).toBeUndefined();
  });
});

describe('defaults', () => {
  it('matches the plan allowlist', () => {
    expect(DEFAULTS_EXPOSED_FOR_TEST).toEqual({
      maintenance_mode: false,
      audit_retention_days: 365,
      import_default_org: 'huangua',
    });
  });
});
