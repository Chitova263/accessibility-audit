import { nvda } from '@guidepup/guidepup';
import { ScreenReader } from './screen-reader';

export class NvdaScreenReader extends ScreenReader {
    public constructor() {
        super(nvda);
    }
}
