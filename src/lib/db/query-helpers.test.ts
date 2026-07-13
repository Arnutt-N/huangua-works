import { describe, expect, test } from 'vitest';
import { firstOrUndefined } from './query-helpers';

describe('firstOrUndefined', () => {
  test('returns the first element when the resolved array has items', async () => {
    const result = await firstOrUndefined(Promise.resolve([{ id: 1 }, { id: 2 }]));
    expect(result).toEqual({ id: 1 });
  });

  test('returns undefined when the resolved array is empty', async () => {
    const result = await firstOrUndefined(Promise.resolve([]));
    expect(result).toBeUndefined();
  });

  test('propagates rejection from the underlying promise', async () => {
    await expect(firstOrUndefined(Promise.reject(new Error('query failed')))).rejects.toThrow(
      'query failed'
    );
  });
});
