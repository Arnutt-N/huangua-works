import { describe, expect, it } from 'vitest';
import { validateEnv, isPlaceholder } from '../../../scripts/verify-env';

const VALID_DEV_ENV: Record<string, string> = {
  AUTH_SECRET: 'a'.repeat(32),
  AUTH_URL: 'http://localhost:3000',
  UPSTASH_REDIS_REST_URL: 'https://test-redis.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'token-test-16chars',
  CID_HMAC_KEY: 'b'.repeat(32),
  LINE_ID_HMAC_KEY: 'c'.repeat(32),
  CRON_SECRET: 'd'.repeat(16),
};

describe('isPlaceholder', () => {
  it('detects standard placeholders and supabase password brackets', () => {
    expect(isPlaceholder('YOUR_SECRET_KEY')).toBe(true);
    expect(isPlaceholder('CHANGE_ME_PASSWORD')).toBe(true);
    expect(
      isPlaceholder(
        'postgresql://postgres.huangua:[YOUR-PASSWORD]@pooler.supabase.com:6543/postgres',
      ),
    ).toBe(true);
    expect(
      isPlaceholder(
        'postgresql://postgres.huangua:[YOUR_PASSWORD]@pooler.supabase.com:6543/postgres',
      ),
    ).toBe(true);
    expect(
      isPlaceholder('postgresql://postgres.huangua:<PASSWORD>@pooler.supabase.com:6543/postgres'),
    ).toBe(true);
    expect(isPlaceholder('real-production-secret-value-12345')).toBe(false);
  });
});

describe('validateEnv', () => {
  it('passes on valid dev environment', () => {
    const { errors, warnings } = validateEnv(VALID_DEV_ENV, false);
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('fails when required keys are missing or empty', () => {
    const { errors } = validateEnv({}, false);
    expect(errors.length).toBeGreaterThanOrEqual(7);
    expect(errors.some((e) => e.includes('AUTH_SECRET'))).toBe(true);
    expect(errors.some((e) => e.includes('UPSTASH_REDIS_REST_URL'))).toBe(true);
    expect(errors.some((e) => e.includes('CID_HMAC_KEY'))).toBe(true);
    expect(errors.some((e) => e.includes('LINE_ID_HMAC_KEY'))).toBe(true);
    expect(errors.some((e) => e.includes('CRON_SECRET'))).toBe(true);
  });

  it('fails when keys contain placeholder values', () => {
    const env = {
      ...VALID_DEV_ENV,
      AUTH_SECRET: 'CHANGE_ME_paste_32plus_random_chars',
    };
    const { errors } = validateEnv(env, false);
    expect(errors.some((e) => e.includes('AUTH_SECRET') && e.includes('placeholder'))).toBe(true);
  });

  it('fails when keys do not meet minimum length requirement', () => {
    const env = {
      ...VALID_DEV_ENV,
      AUTH_SECRET: 'short',
      UPSTASH_REDIS_REST_TOKEN: 'short',
      CID_HMAC_KEY: 'short',
      LINE_ID_HMAC_KEY: 'short',
      CRON_SECRET: 'short',
    };
    const { errors } = validateEnv(env, false);
    expect(errors.filter((e) => e.includes('สั้นเกิน'))).toHaveLength(5);
  });

  it('validates optional groups correctly (none, full, and partial)', () => {
    // None set: pass
    const resNone = validateEnv(VALID_DEV_ENV, false);
    expect(resNone.errors).toHaveLength(0);

    // Full set: pass
    const envFullS3 = {
      ...VALID_DEV_ENV,
      S3_ACCESS_KEY_ID: 'access-key',
      S3_ENDPOINT: 'https://storage.example.com',
      S3_SECRET_ACCESS_KEY: 'secret-key',
    };
    const resFull = validateEnv(envFullS3, false);
    expect(resFull.errors).toHaveLength(0);

    // Partial set: fail
    const envPartialS3 = {
      ...VALID_DEV_ENV,
      S3_ACCESS_KEY_ID: 'access-key',
    };
    const resPartial = validateEnv(envPartialS3, false);
    expect(resPartial.errors.some((e) => e.includes('config S3 ครึ่งเดียว'))).toBe(true);
  });

  it('enforces production rules on AUTH_URL and yields warning on missing SMTP_HOST', () => {
    // Localhost in production: fail
    const resProdLocalhost = validateEnv(VALID_DEV_ENV, true);
    expect(
      resProdLocalhost.errors.some(
        (e) => e.includes('AUTH_URL') && e.includes('ห้ามใช้ localhost'),
      ),
    ).toBe(true);
    // Missing SMTP_HOST in production: warning only, not error
    expect(resProdLocalhost.warnings.some((w) => w.includes('SMTP_HOST'))).toBe(true);

    // Valid HTTPS production URL
    const envProdValid = {
      ...VALID_DEV_ENV,
      AUTH_URL: 'https://huangua.vercel.app',
      SMTP_HOST: 'smtp.resend.com',
    };
    const resProdValid = validateEnv(envProdValid, true);
    expect(resProdValid.errors).toHaveLength(0);
    expect(resProdValid.warnings).toHaveLength(0);
  });
});
