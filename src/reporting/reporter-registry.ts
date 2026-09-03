import { HtmlReporter } from './reporters/html-reporter';
import { JsonReporter } from './reporters/json-reporter';
import type { Reporter } from './reporter';

const REPORTER_REGISTRY: Record<string, () => Reporter> = {
    html: () => new HtmlReporter(),
    json: () => new JsonReporter(),
};

export function getReporter(name: string): Reporter {
    const factory = REPORTER_REGISTRY[name.toLowerCase()];
    if (!factory) {
        const available = Object.keys(REPORTER_REGISTRY).join(', ');
        throw new Error(`Unknown reporter: ${name}. Available: ${available}`);
    }
    return factory();
}
