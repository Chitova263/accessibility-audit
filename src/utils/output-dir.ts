import * as fs from 'fs/promises';
import * as path from 'path';

function slugifyUrl(url: string): string {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return url
            .replace(/[^a-z0-9.-]/gi, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    const raw = parsed.hostname + parsed.pathname;

    return raw
        .replace(/[^a-z0-9.]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
}

function formatTimestamp(date: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}-${minutes}`;
}

export async function resolveOutputDir(options: {
    explicitDir?: string;
    url: string;
    baseDir?: string;
    now?: Date;
}): Promise<string> {
    const { explicitDir, url, baseDir = './audit-results', now = new Date() } = options;

    const dir = explicitDir
        ? path.resolve(explicitDir)
        : path.resolve(path.join(baseDir, `${slugifyUrl(url)}-${formatTimestamp(now)}`));

    await fs.mkdir(dir, { recursive: true });

    return dir;
}
