import { MyWorldRegistry, PlaceTypeConfig } from './MyWorldRegistry';

export function getPlaceTypes(): string[] {
    const prefix = MyWorldRegistry.placesTagsNameStart;
    return [
        ...MyWorldRegistry.placeSuffixes.map(suffix => `${prefix}${suffix}`),
    ];
}

export { PlaceTypeConfig };

export function getPlaceTypeRegistry(): Partial<Record<string, PlaceTypeConfig>> {
    const prefix = MyWorldRegistry.placesTagsNameStart;
    
    if (MyWorldRegistry.placeTypes && Object.keys(MyWorldRegistry.placeTypes).length > 0) {
        const registry: Partial<Record<string, PlaceTypeConfig>> = {};
        for (const [suffix, config] of Object.entries(MyWorldRegistry.placeTypes)) {
            registry[`${prefix}${suffix}`] = config;
        }
        return registry;
    }

    // Default Fallback
    return {
        [`${prefix}Provincias`]: { geocodingSuffix: "Provincia" },
        [`${prefix}Regiones`]: { geocodingSuffix: "Region" },
        [`${prefix}Países`]: { geocodingSuffix: "Pais" },
        [`${prefix}Municipios`]: { },
        [`${prefix}Ciudades`]: { },
    };
}
