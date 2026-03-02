# Generate Missing Notes Command

Este comando ayuda a mantener la integridad de la bóveda creando automáticamente notas para enlaces rotos (unresolved links).

## ¿Cómo funciona?

1.  **Detección**: Escanea la bóveda en busca de todos los enlaces que apuntan a notas inexistentes (ej. `[[Nota Que No Existe]]`).
2.  **Planificación**:
    *   Determina dónde debe crearse cada nota basándose en la configuración ("Junto a la nota original" o "En una carpeta fija").
    *   Sanitiza los nombres de archivo para evitar caracteres inválidos.
3.  **Creación**:
    *   Crea el archivo `.md` en la ruta destino.
    *   Si hay configurada una plantilla para "Notas faltantes", la aplica (reemplazando `{{title}}` por el nombre).

## Configuración

En los ajustes del plugin puedes definir:
*   **Estrategia de Ubicación**: Misma carpeta que el origen o carpeta centralizada.
*   **Plantilla**: Ruta a la plantilla base para nuevas notas.
