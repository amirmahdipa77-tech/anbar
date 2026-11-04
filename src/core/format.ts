export function relativeTime(ts: number, now = Date.now()): string {
  const seconds = Math.max(1, Math.round((now - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : pluralForm ?? `${singular}s`}`;
}

export function bytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function shortId(id: string): string {
  return id.slice(0, 7);
}

export function dateTime(ts: number): string {
  const date = new Date(ts);
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function extOf(path: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(path);
  return match ? match[1].toLowerCase() : '';
}

/** Language tag for the syntax colouring pass. */
export function languageOf(path: string): string {
  const ext = extOf(path);
  const map: Record<string, string> = {
    js: 'js', jsx: 'js', mjs: 'js', cjs: 'js',
    ts: 'ts', tsx: 'ts',
    kt: 'kt', kts: 'kt',
    java: 'java',
    py: 'py',
    json: 'json',
    md: 'md',
    css: 'css',
    scss: 'css',
    html: 'html',
    sh: 'sh',
    yml: 'yaml',
    yaml: 'yaml',
    txt: 'text',
  };
  return map[ext] ?? 'text';
}
