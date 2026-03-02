import { TemplateConfig } from './TemplateConfig';

export class TemplateContext {
    private static _activeConfig: TemplateConfig | null = null;

    static get activeConfig(): TemplateConfig | null {
        return this._activeConfig;
    }

    static set activeConfig(config: TemplateConfig | null) {
        this._activeConfig = config;
    }
}
