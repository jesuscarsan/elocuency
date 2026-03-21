
export const FrontmatterKeys: Record<string, string> = new Proxy({}, {
    get: function (target, prop) {
        if (typeof prop === 'string') {
            if (prop === 'EloPrompt') return '!!prompt';
            if (prop === 'EloCommands') return '!!commands';
            if (prop === 'EloData') return '!!data';
            if (prop === 'EloImages') return '!!images';

            for (const key of Object.keys(FrontmatterRegistry)) {
                if (key === prop) return FrontmatterRegistry[key].key;
            }
        }
        return undefined;
    }
});

export type FrontmatterKey = string;

export interface FrontmatterFieldConfig {
    key: FrontmatterKey;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array';
    asLink?: boolean;
    reciprocityField?: FrontmatterKey;
    amongField?: FrontmatterKey;
    isRelocateField?: boolean;
    relocatePriority?: number;
    commands?: string[];
}

export const FrontmatterRegistry: Record<string, FrontmatterFieldConfig> = {};

export function setFrontmatterRegistry(config: Record<string, FrontmatterFieldConfig>) {
    for (const key of Object.keys(FrontmatterRegistry)) {
        delete FrontmatterRegistry[key];
    }
    Object.assign(FrontmatterRegistry, config);
}
