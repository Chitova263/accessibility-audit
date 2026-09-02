import { describe, it, expect } from 'vitest';
import {
    screenReaderTypeSchema,
    reportFormatSchema,
    urlSchema,
    auditOptionsSchema,
    auditInputSchema,
    reportOptionsSchema,
} from './schemas';

describe('screenReaderTypeSchema', () => {
    it('accepts valid screen reader types', () => {
        expect(screenReaderTypeSchema.parse('nvda')).toBe('nvda');
        expect(screenReaderTypeSchema.parse('virtual')).toBe('virtual');
        expect(screenReaderTypeSchema.parse('voiceover')).toBe('voiceover');
    });

    it('rejects invalid screen reader types', () => {
        expect(() => screenReaderTypeSchema.parse('jaws')).toThrow();
        expect(() => screenReaderTypeSchema.parse('')).toThrow();
        expect(() => screenReaderTypeSchema.parse(123)).toThrow();
    });
});

describe('reportFormatSchema', () => {
    it('accepts valid formats', () => {
        expect(reportFormatSchema.parse('html')).toBe('html');
        expect(reportFormatSchema.parse('json')).toBe('json');
    });

    it('rejects invalid formats', () => {
        expect(() => reportFormatSchema.parse('pdf')).toThrow();
        expect(() => reportFormatSchema.parse('xml')).toThrow();
    });
});

describe('urlSchema', () => {
    it('accepts valid URLs', () => {
        expect(urlSchema.parse('https://example.com')).toBe('https://example.com');
        expect(urlSchema.parse('http://localhost:3000')).toBe('http://localhost:3000');
        expect(urlSchema.parse('https://example.com/path?query=1')).toBe('https://example.com/path?query=1');
    });

    it('rejects invalid URLs', () => {
        expect(() => urlSchema.parse('not-a-url')).toThrow();
        expect(() => urlSchema.parse('example.com')).toThrow(); // missing protocol
        expect(() => urlSchema.parse('')).toThrow();
    });
});

describe('auditOptionsSchema', () => {
    it('applies defaults for missing options', () => {
        const result = auditOptionsSchema.parse({});
        expect(result).toEqual({
            maxSteps: 500,
            reader: 'nvda',
            speech: false,
            verbose: false,
        });
    });

    it('coerces maxSteps from string to number', () => {
        const result = auditOptionsSchema.parse({ maxSteps: '1000' });
        expect(result.maxSteps).toBe(1000);
        expect(typeof result.maxSteps).toBe('number');
    });

    it('accepts valid options', () => {
        const result = auditOptionsSchema.parse({
            outputDir: './output',
            maxSteps: 200,
            reader: 'virtual',
            speech: true,
            verbose: true,
        });
        expect(result).toEqual({
            outputDir: './output',
            maxSteps: 200,
            reader: 'virtual',
            speech: true,
            verbose: true,
        });
    });

    it('rejects invalid maxSteps', () => {
        expect(() => auditOptionsSchema.parse({ maxSteps: -1 })).toThrow();
        expect(() => auditOptionsSchema.parse({ maxSteps: 0 })).toThrow();
        expect(() => auditOptionsSchema.parse({ maxSteps: 'abc' })).toThrow();
    });

    it('rejects invalid reader', () => {
        expect(() => auditOptionsSchema.parse({ reader: 'invalid' })).toThrow();
    });
});

describe('auditInputSchema', () => {
    it('validates complete audit input', () => {
        const result = auditInputSchema.parse({
            url: 'https://example.com',
            options: { reader: 'virtual' },
        });
        expect(result.url).toBe('https://example.com');
        expect(result.options.reader).toBe('virtual');
        expect(result.options.maxSteps).toBe(500); // default
    });

    it('rejects invalid URL', () => {
        expect(() =>
            auditInputSchema.parse({
                url: 'not-valid',
                options: {},
            })
        ).toThrow();
    });

    it('rejects missing URL', () => {
        expect(() =>
            auditInputSchema.parse({
                options: {},
            })
        ).toThrow();
    });
});

describe('reportOptionsSchema', () => {
    it('applies defaults', () => {
        const result = reportOptionsSchema.parse({});
        expect(result).toEqual({
            format: 'html',
            verbose: false,
        });
    });

    it('accepts valid options', () => {
        const result = reportOptionsSchema.parse({
            dir: './audit-results',
            llmResponse: './response.json',
            violations: './violations.json',
            transcript: './transcript.json',
            format: 'json',
            output: './report.json',
            verbose: true,
        });
        expect(result.format).toBe('json');
        expect(result.dir).toBe('./audit-results');
    });

    it('rejects invalid format', () => {
        expect(() => reportOptionsSchema.parse({ format: 'pdf' })).toThrow();
    });
});
