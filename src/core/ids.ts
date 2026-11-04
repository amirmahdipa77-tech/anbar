/** Short, sortable-enough, collision-resistant ids without extra dependencies. */
export function newId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}
