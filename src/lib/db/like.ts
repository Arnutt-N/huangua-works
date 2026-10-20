/** escape LIKE metacharacters — กัน q ที่มี % / _ / \ ทำ pattern เพี้ยน */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
