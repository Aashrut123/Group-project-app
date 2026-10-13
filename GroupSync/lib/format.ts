export function formatDate(value: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return 'No due date';
  const date = new Date(value);
  return date.toLocaleDateString(undefined, options || { month: 'short', day: 'numeric' });
}

export function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function dateInputValue(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
