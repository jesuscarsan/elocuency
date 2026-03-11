import { MyWorldRegistry } from './MyWorldRegistry';

export function getPlaceTypes(): string[] {
    const prefix = MyWorldRegistry.placesTagsNameStart;
    return [
        ...MyWorldRegistry.placeSuffixes.map(suffix => `${prefix}${suffix}`),
    ];
}

export interface PlaceTypeConfig {
    geocodingSuffix?: string;
}

export function getPlaceTypeRegistry(): Partial<Record<string, PlaceTypeConfig>> {
    const prefix = MyWorldRegistry.placesTagsNameStart;
    return {
        [`${prefix}Provincias`]: { geocodingSuffix: "Provincia" },
        [`${prefix}Regiones`]: { geocodingSuffix: "Region" },
        [`${prefix}Países`]: { geocodingSuffix: "Pais" },
        [`${prefix}Municipios`]: { geocodingSuffix: "Municipio" },
        [`${prefix}Ciudades`]: { geocodingSuffix: "Ciudad" },
    };
}
