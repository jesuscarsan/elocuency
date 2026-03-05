"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeaderMetadataRegistry = exports.HeaderMetadataKeys = void 0;
exports.HeaderMetadataKeys = {
    Score: "score",
    Difficulty: "difficulty",
    Importance: "importance",
    Attempts: "attempts",
};
exports.HeaderMetadataRegistry = {
    [exports.HeaderMetadataKeys.Score]: {
        key: exports.HeaderMetadataKeys.Score,
        description: "Puntuación asociada al contenido",
        type: 'number',
        defaultValue: 0
    },
    [exports.HeaderMetadataKeys.Difficulty]: {
        key: exports.HeaderMetadataKeys.Difficulty,
        description: "Nivel de dificultad",
        type: 'number',
        defaultValue: 0
    },
    [exports.HeaderMetadataKeys.Importance]: {
        key: exports.HeaderMetadataKeys.Importance,
        description: "Nivel de importancia",
        type: 'number',
        defaultValue: 0
    },
    [exports.HeaderMetadataKeys.Attempts]: {
        key: exports.HeaderMetadataKeys.Attempts,
        description: "Número de intentos",
        type: 'number',
        defaultValue: 0
    }
};
