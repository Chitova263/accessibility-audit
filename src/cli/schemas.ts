import { z } from 'zod';
import type { ScreenReaderType } from '../screen-reader/screen-reader-type';

const screenReaderTypeSchema = z.enum(['nvda', 'virtual', 'voiceover'] as const satisfies readonly ScreenReaderType[]);

const reportFormatSchema = z.enum(['html', 'json']);
const urlSchema = z.string().url('Must be a valid URL');

const auditOptionsSchema = z
    .object({
        outputDir: z.string().optional(),
        maxSteps: z.coerce.number().int().positive().default(500),
        reader: screenReaderTypeSchema,
        launch: z.boolean().default(false),
        port: z.coerce.number().int().min(1).max(65535).optional(),
        verbose: z.boolean().default(false),
    })
    .refine((o) => !(o.launch && o.port !== undefined), {
        message: '--port cannot be combined with --launch (a launched browser needs no debugging port)',
        path: ['port'],
    });

const auditInputSchema = z.object({
    url: urlSchema,
    options: auditOptionsSchema,
});
export type AuditInput = z.infer<typeof auditInputSchema>;

const reportOptionsSchema = z.object({
    dir: z.string().optional(),
    llmResponse: z.string().optional(),
    violations: z.string().optional(),
    transcript: z.string().optional(),
    format: reportFormatSchema.default('html'),
    output: z.string().optional(),
    verbose: z.boolean().default(false),
});
type ReportOptions = z.infer<typeof reportOptionsSchema>;

export function parseReportOptions(rawOptions: unknown): ReportOptions {
    const result = reportOptionsSchema.safeParse(rawOptions);

    if (!result.success) {
        const errors = result.error.issues
            .map((e) => {
                const path = e.path.join('.');
                const prefix = path ? `--${path}: ` : '';
                return `  ${prefix}${e.message}`;
            })
            .join('\n');
        console.error(`Invalid options for 'ally report':\n${errors}`);
        process.exit(1);
    }

    return result.data;
}

export function parseAuditInput(url: string | undefined, rawOptions: unknown): AuditInput {
    const result = auditInputSchema.safeParse({ url, options: rawOptions });

    if (!result.success) {
        const errors = result.error.issues
            .map((e) => {
                const path = e.path.join('.');
                if (path === 'url') return `  <url>: ${e.message}`;
                if (path.startsWith('options.')) return `  --${path.replace('options.', '')}: ${e.message}`;
                return `  ${e.message}`;
            })
            .join('\n');
        console.error(`Invalid input for 'ally audit':\n${errors}`);
        process.exit(1);
    }

    return result.data;
}
