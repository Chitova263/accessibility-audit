import { z } from 'zod';

export const screenReaderTypeSchema = z.enum(['nvda', 'virtual', 'voiceover']);
export type ScreenReaderType = z.infer<typeof screenReaderTypeSchema>;

export const reportFormatSchema = z.enum(['html', 'json']);
export type ReportFormat = z.infer<typeof reportFormatSchema>;

export const urlSchema = z.string().url('Must be a valid URL');

export const auditOptionsSchema = z.object({
    outputDir: z.string().optional(),
    maxSteps: z.coerce.number().int().positive().default(500),
    reader: screenReaderTypeSchema,
    verbose: z.boolean().default(false),
});
export type AuditOptions = z.infer<typeof auditOptionsSchema>;

export const auditInputSchema = z.object({
    url: urlSchema,
    options: auditOptionsSchema,
});
export type AuditInput = z.infer<typeof auditInputSchema>;

export const reportOptionsSchema = z.object({
    dir: z.string().optional(),
    llmResponse: z.string().optional(),
    violations: z.string().optional(),
    transcript: z.string().optional(),
    format: reportFormatSchema.default('html'),
    output: z.string().optional(),
    verbose: z.boolean().default(false),
});
export type ReportOptions = z.infer<typeof reportOptionsSchema>;

/**
 * Parse and validate CLI options with Zod.
 * Exits with error message on validation failure.
 */
export function parseOptions<T>(schema: z.ZodSchema<T>, rawOptions: unknown, commandName: string): T {
    const result = schema.safeParse(rawOptions);

    if (!result.success) {
        const errors = result.error.issues
            .map((e) => {
                const path = e.path.join('.');
                const prefix = path ? `--${path}: ` : '';
                return `  ${prefix}${e.message}`;
            })
            .join('\n');
        console.error(`Invalid options for '${commandName}':\n${errors}`);
        process.exit(1);
    }

    return result.data;
}

/**
 * Parse and validate audit command input (URL + options).
 * Exits with error message on validation failure.
 */
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
        console.error(`Invalid input for 'a11y audit':\n${errors}`);
        process.exit(1);
    }

    return result.data;
}
