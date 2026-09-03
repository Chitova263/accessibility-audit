import type { ScreenReaderType } from './screen-reader-type';
import type { NavigationStrategy, StrategyResult, NavigationContext } from './strategies/navigation-strategy';
import type { GetFullAXTreeResult } from '../types/cdp';
import type { Violation } from '../analysis/core/violation';
import { BrowserTarget, type BrowserSource } from './browser-target';
import { ScreenReaderSession } from './screen-reader-session';
import { runRules } from '../analysis/rules/runner';
import { attachScreenshots } from '../analysis/utils/screenshot-capture';
import { Logger } from '../utils/logger';
import { delay } from '../utils/delay';

/** Settling time between strategies so the reader is quiet before the next traversal. */
const INTER_STRATEGY_DELAY_MS = 2000;

/**
 * Configuration for creating an audit session.
 */
export interface AuditSessionConfig {
    /** URL to audit */
    url: string;
    /** Screen reader to use */
    screenReader: ScreenReaderType;
    /** Navigation strategies to run */
    strategies: NavigationStrategy[];
    /** Output directory for screenshots (if not provided, screenshots are skipped) */
    outputDir?: string;
    /** Where the browser comes from (default: connect to Chrome on port 9222) */
    browser?: BrowserSource;
}

/**
 * Result of running an audit session.
 */
export interface AuditResult {
    /** URL that was audited */
    url: string;
    /** Page title */
    title: string;
    /** Full HTML content of the page */
    html: string;
    /** Results from each navigation strategy */
    transcript: StrategyResult[];
    /** Violations found, with screenshots attached if outputDir was provided */
    violations: Violation[];
}

export interface PageContext {
    url: string;
    title: string;
}

/**
 * Orchestrates one audit: drive the page with a screen reader, run the rules over
 * the resulting transcript, and attach screenshots.
 *
 * It composes exactly two collaborators - a {@link BrowserTarget} (everything on the
 * browser side) and a {@link ScreenReaderSession} (everything on the reader side).
 * Neither overlaps the other, and the session owns both lifetimes.
 */
export class AuditSession {
    private readonly log = Logger.context('AuditSession');
    private closed = false;

    private constructor(
        private readonly config: AuditSessionConfig,
        private readonly target: BrowserTarget,
        private readonly screenReader: ScreenReaderSession
    ) {}

    /**
     * Create and initialize an audit session.
     * Connects to Chrome, navigates to the URL, and starts the screen reader.
     */
    static async create(config: AuditSessionConfig): Promise<AuditSession> {
        const target = await BrowserTarget.open({
            url: config.url,
            ...(config.browser !== undefined ? { source: config.browser } : {}),
        });

        try {
            const screenReader = await ScreenReaderSession.start(config.screenReader, target);
            const session = new AuditSession(config, target, screenReader);
            session.log.info(`Session created for ${config.url}`);
            return session;
        } catch (error) {
            await target.close();
            throw error;
        }
    }

    /**
     * Run the complete audit: navigation strategies, rule analysis, and screenshot capture.
     */
    async run(): Promise<AuditResult> {
        this.ensureOpen();

        this.log.debug('Fetching accessibility tree');
        const axTree = await this.target.getFullAXTreeSnapshot();

        const transcript = await this.runStrategies(axTree);

        Logger.section('Running Analysis Rules');
        const { violations: ruleViolations, byRule } = await runRules({
            transcript,
            screenReader: this.config.screenReader,
        });
        this.log.info(`Found ${ruleViolations.length} violations from ${byRule.size} rules`);

        let violations: Violation[] = ruleViolations;
        if (this.config.outputDir) {
            this.log.debug('Capturing screenshots for violations...');
            violations = await attachScreenshots(
                ruleViolations,
                this.target.page,
                this.target.cdp,
                this.config.outputDir
            );
        }

        const [html, title] = await Promise.all([this.target.content(), this.target.title()]);

        return {
            url: this.config.url,
            title,
            html,
            transcript,
            violations,
        };
    }

    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;

        this.log.debug('Closing session');
        await this.screenReader.stop();
        await this.target.close();
        this.log.info('Session closed');
    }

    private async runStrategies(axTree: GetFullAXTreeResult): Promise<StrategyResult[]> {
        const transcript: StrategyResult[] = [];
        const strategies = this.config.strategies;
        const context = this.buildContext(axTree);

        this.log.info(`Running ${strategies.length} navigation strategies`);

        for (let i = 0; i < strategies.length; i++) {
            const strategy = strategies[i]!;
            Logger.progress(i + 1, strategies.length, `Running ${strategy.meta.name}`);

            const startTime = Date.now();
            const result = await strategy.execute(context);
            const duration = Date.now() - startTime;

            this.log.debug(`${strategy.meta.name}: ${result.navigationSteps.length} steps in ${duration}ms`);
            transcript.push(result);

            // Strategies share one cursor, so rewind to the top before handing it to the next one.
            await this.screenReader.cursor.reset();
            await delay(INTER_STRATEGY_DELAY_MS);
        }

        this.log.info(`Completed: ${transcript.reduce((sum, r) => sum + r.navigationSteps.length, 0)} total steps`);
        return transcript;
    }

    private ensureOpen(): void {
        if (this.closed) {
            throw new Error('AuditSession has been closed');
        }
    }

    private buildContext(axTree: GetFullAXTreeResult): NavigationContext {
        return {
            virtualCursor: this.screenReader.cursor,
            accessibility: {
                tree: axTree,
                getNodeOuterHtml: (nodeId) => this.target.getNodeOuterHtml(nodeId),
                getFocusedHtmlElementBackendNodeId: () => this.target.getFocusedHtmlElementBackendNodeId(),
                getFocusedNodeHtml: () => this.target.getFocusedNodeHtml(),
                getDocumentHasFocus: () => this.target.getDocumentHasFocus(),
            },
        };
    }
}
