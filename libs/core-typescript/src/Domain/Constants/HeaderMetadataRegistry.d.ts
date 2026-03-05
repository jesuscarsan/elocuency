export declare const HeaderMetadataKeys: {
    readonly Score: "score";
    readonly Difficulty: "difficulty";
    readonly Importance: "importance";
    readonly Attempts: "attempts";
};
export type HeaderMetadataKey = (typeof HeaderMetadataKeys)[keyof typeof HeaderMetadataKeys];
export interface HeaderMetadataFieldConfig {
    key: HeaderMetadataKey;
    description: string;
    type: 'number' | 'string' | 'boolean';
    defaultValue: string | number | boolean;
}
export declare const HeaderMetadataRegistry: Record<string, HeaderMetadataFieldConfig>;
export interface HeaderMetadata {
    [HeaderMetadataKeys.Score]?: number;
    [HeaderMetadataKeys.Difficulty]?: number;
    [HeaderMetadataKeys.Importance]?: number;
    [HeaderMetadataKeys.Attempts]?: number;
}
