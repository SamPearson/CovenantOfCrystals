/** Small utility helpers shared across core modules. */

export function uuid(): string {
  return crypto.randomUUID()
}
