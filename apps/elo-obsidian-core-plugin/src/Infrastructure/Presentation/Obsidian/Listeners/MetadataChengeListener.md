# FrontmatterEventService

Servicio encargado de monitorear cambios en el frontmatter de los archivos Markdown y ejecutar comandos automáticamente cuando ciertos campos son modificados.

## Funcionamiento

1.  **Registro de Eventos**: Escucha el evento `metadataCache.on("changed")` de Obsidian para detectar cambios en los metadatos de los archivos.
2.  **Detección de Cambios**:
    *   Mantiene un registro del estado previo del frontmatter de cada archivo.
    *   Compara el valor actual de los campos con el valor anterior.
3.  **Ejecución de Comandos**:
    *   Verifica si el campo modificado está registrado en `FrontmatterRegistry`.
    *   Si el campo tiene comandos asociados en el registro, los ejecuta secuencialmente.
    *   Soporta comandos estándar de Obsidian y comandos específicos del plugin (prefijo `elocuency:`).

## Propósito

Automatizar flujos de trabajo basados en la edición de propiedades del frontmatter, permitiendo que cambios en los metadatos disparen acciones dentro del plugin.
