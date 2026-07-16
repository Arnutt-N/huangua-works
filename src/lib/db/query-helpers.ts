/**
 * Query helpers — wraps repeated `(await query.limit(1))[0]` pattern
 * (project ใช้ Drizzle core query builder ตรง ไม่ใช่ relational query API, จึงไม่มี findFirst() ในตัว)
 */
export async function firstOrUndefined<T>(rows: Promise<T[]>): Promise<T | undefined> {
  return (await rows)[0];
}
