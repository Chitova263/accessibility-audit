import { describe, it, expect } from 'vitest';
import { slugifyUrl, formatTimestamp } from './output-dir';

describe('slugifyUrl', () => {
    it('converts a full URL to a slug', () => {
        expect(slugifyUrl('https://www.example.com/shop/products/step/1')).toBe('www.example.com-shop-products-step-1');
    });

    it('handles root path', () => {
        expect(slugifyUrl('https://example.com/')).toBe('example.com');
    });

    it('handles URL with no path', () => {
        expect(slugifyUrl('https://example.com')).toBe('example.com');
    });

    it('collapses consecutive hyphens', () => {
        expect(slugifyUrl('https://example.com/foo//bar')).toBe('example.com-foo-bar');
    });

    it('truncates long URLs to 80 chars', () => {
        const longUrl = 'https://example.com/' + 'a'.repeat(200);
        expect(slugifyUrl(longUrl).length).toBeLessThanOrEqual(80);
    });

    it('handles invalid URL gracefully', () => {
        const result = slugifyUrl('not-a-url');
        expect(result).toBeTruthy();
        expect(result).not.toMatch(/[^a-z0-9.-]/i);
    });
});

describe('formatTimestamp', () => {
    it('formats a date as YYYY-MM-DDTHH-MM', () => {
        const date = new Date(2026, 8, 1, 13, 9, 45); // Sep 1 2026 13:09:45
        expect(formatTimestamp(date)).toBe('2026-09-01T13-09');
    });

    it('pads single-digit month and day', () => {
        const date = new Date(2026, 0, 5, 8, 3, 0); // Jan 5 2026 08:03
        expect(formatTimestamp(date)).toBe('2026-01-05T08-03');
    });
});
