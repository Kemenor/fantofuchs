import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const CACHE_DIR = process.env.SCRAPE_CACHE ?? '.cache/http';
const UA = 'fantofuchs/0.1 (+https://github.com/Kemenor/fantofuchs) personal schedule planner';

/** Fetch with an on-disk cache, so re-runs during development cost nothing. */
export async function get(url: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const key = join(CACHE_DIR, createHash('sha1').update(url).digest('hex') + '.html');
  if (existsSync(key) && !process.env.NO_CACHE) return readFileSync(key, 'utf8');

  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const body = await res.text();
  writeFileSync(key, body);
  return body;
}

/** Run `worker` over `items` with bounded concurrency, in order. */
export async function pool<T, R>(items: T[], limit: number, worker: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (let i = next++; i < items.length; i = next++) out[i] = await worker(items[i], i);
    }),
  );
  return out;
}
