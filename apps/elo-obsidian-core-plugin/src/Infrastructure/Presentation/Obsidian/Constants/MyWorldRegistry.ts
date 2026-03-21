export interface PlaceTypeConfig {
    geocodingSuffix?: string;
}

export interface MyWorldConfig {
    placesTagsNameStart: string;
    placeSuffixes: string[];
    placeTypes?: Record<string, PlaceTypeConfig>;
}

let _config: MyWorldConfig | null = null;

export const MyWorldRegistry = new Proxy({} as MyWorldConfig, {
    get: function (target, prop) {
        if (!_config) {
            throw new Error(`MyWorldRegistry accessed before initialization! Property: ${String(prop)}`);
        }
        return (_config as any)[prop];
    }
});

export function setMyWorldConfig(config: Partial<MyWorldConfig>) {
    if (!config.placesTagsNameStart) {
        throw new Error("placesTagsNameStart is strictly required in elo-config.json's myWorldPath");
    }

    if (!_config) {
        _config = {
            placesTagsNameStart: config.placesTagsNameStart,
            placeSuffixes: []
        };
    } else {
        _config.placesTagsNameStart = config.placesTagsNameStart;
    }
    if (config.placeSuffixes && Array.isArray(config.placeSuffixes)) {
        _config.placeSuffixes = config.placeSuffixes;
    }
    if (config.placeTypes && typeof config.placeTypes === 'object') {
        _config.placeTypes = config.placeTypes;
    }
}
