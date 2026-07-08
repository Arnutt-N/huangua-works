import { v7 as uuidv7 } from 'uuid';

/**
 * UUID v7 generator (timestamp-ordered, monotonic)
 * ใช้แทน UUID v4 เพื่อ index performance ดีกว่า (B-tree friendly)
 */

export function generateId(): string {
  return uuidv7();
}
