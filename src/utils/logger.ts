export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4,
};

export interface LoggerOptions {
    timestamps?: boolean;
    levelPrefix?: boolean;
}

export interface ContextLogger {
    debug(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
}

/**
 * Static logger with configurable levels and contextual prefixes.
 */
export const Logger = {
    _level: 'info' as LogLevel,
    _options: {
        timestamps: false,
        levelPrefix: false,
    } as LoggerOptions,

    setLevel(level: LogLevel): void {
        Logger._level = level;
    },

    getLevel(): LogLevel {
        return Logger._level;
    },

    configure(options: Partial<LoggerOptions>): void {
        Logger._options = { ...Logger._options, ...options };
    },

    isLevelEnabled(level: LogLevel): boolean {
        return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[Logger._level];
    },

    _formatPrefix(level: LogLevel, context?: string): string {
        const parts: string[] = [];

        if (Logger._options.timestamps) {
            const now = new Date();
            const time = now.toTimeString().split(' ')[0];
            const ms = now.getMilliseconds().toString().padStart(3, '0');
            parts.push(`[${time}.${ms}]`);
        }

        if (Logger._options.levelPrefix) {
            parts.push(`[${level.toUpperCase()}]`);
        }

        if (context) {
            parts.push(`[${context}]`);
        }

        return parts.length > 0 ? parts.join(' ') + ' ' : '';
    },

    _log(level: LogLevel, message: string, data?: unknown, context?: string): void {
        if (!Logger.isLevelEnabled(level)) {
            return;
        }

        const prefix = Logger._formatPrefix(level, context);
        const fullMessage = prefix + message;

        const consoleFn =
            level === 'debug'
                ? console.debug
                : level === 'info'
                  ? console.info
                  : level === 'warn'
                    ? console.warn
                    : console.error;

        if (data !== undefined) {
            consoleFn(fullMessage, data);
        } else {
            consoleFn(fullMessage);
        }
    },

    debug(message: string, data?: unknown): void {
        Logger._log('debug', message, data);
    },

    info(message: string, data?: unknown): void {
        Logger._log('info', message, data);
    },

    warn(message: string, data?: unknown): void {
        Logger._log('warn', message, data);
    },

    error(message: string, data?: unknown): void {
        Logger._log('error', message, data);
    },

    context(name: string): ContextLogger {
        return {
            debug: (message: string, data?: unknown) => Logger._log('debug', message, data, name),
            info: (message: string, data?: unknown) => Logger._log('info', message, data, name),
            warn: (message: string, data?: unknown) => Logger._log('warn', message, data, name),
            error: (message: string, data?: unknown) => Logger._log('error', message, data, name),
        };
    },

    section(title: string): void {
        if (!Logger.isLevelEnabled('info')) {
            return;
        }
        console.info(`\n=== ${title} ===`);
    },

    progress(current: number, total: number | undefined, message: string): void {
        if (!Logger.isLevelEnabled('info')) {
            return;
        }
        const progress = total ? `[${current}/${total}]` : `[${current}]`;
        console.info(`${progress} ${message}`);
    },
};
