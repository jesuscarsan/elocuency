"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrontmatterRegistry = exports.FrontmatterKeys = void 0;
const CommandIds_1 = require("./CommandIds");
exports.FrontmatterKeys = {
    EloCommands: "!!commands",
    EloPrompt: "!!prompt",
    EloPromptUrl: "!!promptUrl",
    EloImages: "!!images",
    EloAppleContactId: "!!appleContactId",
    Municipio: "Municipio",
    Provincia: "Provincia",
    LugarId: "Lugar Id",
    Region: "Región",
    Pais: "País",
    Paises: "Países",
    Lugares: "Lugares",
    Lugar: "Lugar",
    SedePrincipal: "Sede principal",
    Latitud: "Latitud",
    Longitud: "Longitud",
    Url: "Url",
    SpotifyUri: "Spotify uri",
    Capital: "Capital",
    Tags: "tags",
    Conocidos: "Conocidos",
    Hijos: "Hijos",
    Padres: "Padres",
    Pareja: "Pareja",
    Exparejas: "Exparejas",
    Hermanos: "Hermanos",
    Familiares: "Familiares",
    CompanerosTrabajo: "Compañeros de trabajo",
    Jefes: "Jefes",
    Empleados: "Empleados",
    EstilosMusicales: "Estilos musicales",
    SpotifyPopularity: "Spotify popularidad",
    Telefono: "Teléfono",
    Email: "Email",
    Cumpleanos: "Cumpleaños",
    Apodo: "Apodo",
    Puesto: "Puesto de trabajo",
    Empresa: "Empresa",
    Direcciones: "Direcciones",
    Urls: "Urls",
    Eventos: "Eventos",
    Relaciones: "Relaciones",
    Genero: "Género",
    Ocupaciones: "Ocupaciones",
    Intereses: "Intereses",
    Habilidades: "Habilidades",
    Residencias: "Residencias",
};
exports.FrontmatterRegistry = {
    // Internal fields:
    [exports.FrontmatterKeys.EloCommands]: {
        key: exports.FrontmatterKeys.EloCommands,
        description: "Comandos adicionales para la IA",
        type: 'array'
    },
    [exports.FrontmatterKeys.EloPrompt]: {
        key: exports.FrontmatterKeys.EloPrompt,
        description: "Prompt personalizado para la IA",
        type: 'string'
    },
    [exports.FrontmatterKeys.EloPromptUrl]: {
        key: exports.FrontmatterKeys.EloPromptUrl,
        description: "URL de contexto para el prompt",
        type: 'string'
    },
    // User fields:
    [exports.FrontmatterKeys.Municipio]: {
        key: exports.FrontmatterKeys.Municipio,
        description: "Nombre del municipio, ciudad o pueblo",
        type: 'string',
        asLink: true
    },
    [exports.FrontmatterKeys.Provincia]: {
        key: exports.FrontmatterKeys.Provincia,
        description: "Nombre de la provincia administrativa",
        type: 'string',
        asLink: true
    },
    [exports.FrontmatterKeys.Region]: {
        key: exports.FrontmatterKeys.Region,
        description: "Comunidad autónoma o región",
        type: 'string',
        asLink: true
    },
    [exports.FrontmatterKeys.Pais]: {
        key: exports.FrontmatterKeys.Pais,
        description: "País",
        type: 'string',
        isRelocateField: true,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.RelocateNoteByLinkField]
    },
    [exports.FrontmatterKeys.Paises]: {
        key: exports.FrontmatterKeys.Paises,
        description: "Países",
        type: 'array',
        isRelocateField: true,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.RelocateNoteByLinkField]
    },
    [exports.FrontmatterKeys.LugarId]: {
        key: exports.FrontmatterKeys.LugarId,
        description: "Identificador único del lugar (ej. Google Place ID)",
        type: 'string',
        commands: [CommandIds_1.CommandEnum.RelocateNoteByLinkField]
    },
    [exports.FrontmatterKeys.Lugar]: {
        key: exports.FrontmatterKeys.Lugar,
        description: "Lugar relacionado",
        type: 'string',
        isRelocateField: true,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.RelocateNoteByLinkField]
    },
    [exports.FrontmatterKeys.Lugares]: {
        key: exports.FrontmatterKeys.Lugares,
        description: "Lugares relacionados",
        type: 'array',
        isRelocateField: true,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.RelocateNoteByLinkField]
    },
    [exports.FrontmatterKeys.SedePrincipal]: {
        key: exports.FrontmatterKeys.SedePrincipal,
        description: "Sede principal",
        isRelocateField: true,
        type: 'string',
        asLink: true
    },
    [exports.FrontmatterKeys.Latitud]: {
        key: exports.FrontmatterKeys.Latitud,
        description: "Coordenada de latitud geográfica",
        type: 'number'
    },
    [exports.FrontmatterKeys.Longitud]: {
        key: exports.FrontmatterKeys.Longitud,
        description: "Coordenada de longitud geográfica",
        type: 'number'
    },
    [exports.FrontmatterKeys.Url]: {
        key: exports.FrontmatterKeys.Url,
        description: "URL de la web, video, streaming, ...",
        type: 'string',
    },
    [exports.FrontmatterKeys.SpotifyUri]: {
        key: exports.FrontmatterKeys.SpotifyUri,
        description: "URI de Spotify",
        type: 'string'
    },
    [exports.FrontmatterKeys.Capital]: {
        key: exports.FrontmatterKeys.Capital,
        description: "Capital del país (si aplica)",
        type: 'string',
        asLink: true
    },
    [exports.FrontmatterKeys.Tags]: {
        key: exports.FrontmatterKeys.Tags,
        description: "Etiquetas",
        type: 'array'
    },
    [exports.FrontmatterKeys.Conocidos]: {
        key: exports.FrontmatterKeys.Conocidos,
        description: "Lista de conocidos",
        type: 'array',
        reciprocityField: exports.FrontmatterKeys.Conocidos,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.CreateReciprocityLinksNotes]
    },
    [exports.FrontmatterKeys.Hijos]: {
        key: exports.FrontmatterKeys.Hijos,
        description: "Hijos de la persona",
        type: 'array',
        reciprocityField: exports.FrontmatterKeys.Padres,
        amongField: exports.FrontmatterKeys.Hermanos,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.CreateReciprocityLinksNotes]
    },
    [exports.FrontmatterKeys.Padres]: {
        key: exports.FrontmatterKeys.Padres,
        description: "Padres de la persona",
        type: 'array',
        reciprocityField: exports.FrontmatterKeys.Hijos,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.CreateReciprocityLinksNotes]
    },
    [exports.FrontmatterKeys.Pareja]: {
        key: exports.FrontmatterKeys.Pareja,
        description: "Pareja actual",
        type: 'array',
        reciprocityField: exports.FrontmatterKeys.Pareja,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.CreateReciprocityLinksNotes]
    },
    [exports.FrontmatterKeys.Exparejas]: {
        key: exports.FrontmatterKeys.Exparejas,
        description: "Exparejas",
        type: 'array',
        reciprocityField: exports.FrontmatterKeys.Exparejas,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.CreateReciprocityLinksNotes]
    },
    [exports.FrontmatterKeys.Hermanos]: {
        key: exports.FrontmatterKeys.Hermanos,
        description: "Hermanos",
        type: 'array',
        reciprocityField: exports.FrontmatterKeys.Hermanos,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.CreateReciprocityLinksNotes]
    },
    [exports.FrontmatterKeys.Familiares]: {
        key: exports.FrontmatterKeys.Familiares,
        description: "Otros familiares",
        type: 'array',
        reciprocityField: exports.FrontmatterKeys.Familiares,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.CreateReciprocityLinksNotes]
    },
    [exports.FrontmatterKeys.CompanerosTrabajo]: {
        key: exports.FrontmatterKeys.CompanerosTrabajo,
        description: "Compañeros de trabajo",
        type: 'array',
        reciprocityField: exports.FrontmatterKeys.CompanerosTrabajo,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.CreateReciprocityLinksNotes]
    },
    [exports.FrontmatterKeys.Jefes]: {
        key: exports.FrontmatterKeys.Jefes,
        description: "Jefes directos",
        type: 'array',
        reciprocityField: exports.FrontmatterKeys.Empleados,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.CreateReciprocityLinksNotes]
    },
    [exports.FrontmatterKeys.Empleados]: {
        key: exports.FrontmatterKeys.Empleados,
        description: "Empleados a cargo",
        type: 'array',
        reciprocityField: exports.FrontmatterKeys.Jefes,
        asLink: true,
        commands: [CommandIds_1.CommandEnum.CreateReciprocityLinksNotes]
    },
    [exports.FrontmatterKeys.EstilosMusicales]: {
        key: exports.FrontmatterKeys.EstilosMusicales,
        description: "Estilos musicales del artista",
        type: 'array'
    },
    [exports.FrontmatterKeys.SpotifyPopularity]: {
        key: exports.FrontmatterKeys.SpotifyPopularity,
        description: "Popularidad del artista en Spotify (0-100)",
        type: 'number'
    },
    [exports.FrontmatterKeys.EloImages]: {
        key: exports.FrontmatterKeys.EloImages,
        description: "Lista de fotos enlazadas (elo-bridge)",
        type: 'array'
    },
    [exports.FrontmatterKeys.Telefono]: {
        key: exports.FrontmatterKeys.Telefono,
        description: "Teléfono de contacto",
        type: 'string'
    },
    [exports.FrontmatterKeys.Email]: {
        key: exports.FrontmatterKeys.Email,
        description: "Email de contacto",
        type: 'string'
    },
    [exports.FrontmatterKeys.Cumpleanos]: {
        key: exports.FrontmatterKeys.Cumpleanos,
        description: "Cumpleaños (YYYY-MM-DD)",
        type: 'date'
    },
    [exports.FrontmatterKeys.EloAppleContactId]: {
        key: exports.FrontmatterKeys.EloAppleContactId,
        description: "ID de contacto en Apple (elo-bridge)",
        type: 'string'
    },
    [exports.FrontmatterKeys.Apodo]: {
        key: exports.FrontmatterKeys.Apodo,
        description: "Apodo o nombre corto",
        type: 'string'
    },
    [exports.FrontmatterKeys.Puesto]: {
        key: exports.FrontmatterKeys.Puesto,
        description: "Puesto de trabajo o cargo",
        type: 'string'
    },
    [exports.FrontmatterKeys.Empresa]: {
        key: exports.FrontmatterKeys.Empresa,
        description: "Empresa u organización",
        type: 'string'
    },
    [exports.FrontmatterKeys.Direcciones]: {
        key: exports.FrontmatterKeys.Direcciones,
        description: "Direcciones postales",
        type: 'array'
    },
    [exports.FrontmatterKeys.Urls]: {
        key: exports.FrontmatterKeys.Urls,
        description: "Sitios web y enlaces",
        type: 'array'
    },
    [exports.FrontmatterKeys.Eventos]: {
        key: exports.FrontmatterKeys.Eventos,
        description: "Eventos o fechas importantes",
        type: 'array'
    },
    [exports.FrontmatterKeys.Relaciones]: {
        key: exports.FrontmatterKeys.Relaciones,
        description: "Relaciones con otras personas",
        type: 'array'
    },
    [exports.FrontmatterKeys.Genero]: {
        key: exports.FrontmatterKeys.Genero,
        description: "Género",
        type: 'string'
    },
    [exports.FrontmatterKeys.Ocupaciones]: {
        key: exports.FrontmatterKeys.Ocupaciones,
        description: "Ocupaciones (adicionales al puesto)",
        type: 'array'
    },
    [exports.FrontmatterKeys.Intereses]: {
        key: exports.FrontmatterKeys.Intereses,
        description: "Intereses",
        type: 'array'
    },
    [exports.FrontmatterKeys.Habilidades]: {
        key: exports.FrontmatterKeys.Habilidades,
        description: "Habilidades",
        type: 'array'
    },
    [exports.FrontmatterKeys.Residencias]: {
        key: exports.FrontmatterKeys.Residencias,
        description: "Residencias o lugares de vivienda",
        type: 'array'
    }
};
