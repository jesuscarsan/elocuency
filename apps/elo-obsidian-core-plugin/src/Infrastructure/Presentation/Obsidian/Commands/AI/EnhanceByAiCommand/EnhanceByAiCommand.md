# Enhance By AI Command

Este comando es el motor general para mejorar notas utilizando Inteligencia Artificial.

## ¿Cómo funciona?

1.  **Determinación del Contexto**: Decide qué instrucciones (prompt) enviar a la IA siguiendo este orden de prioridad:
    *   Prompt de una plantilla activa (si se llama desde `Apply Template`).
    *   Campo `!!prompt` en el frontmatter de la nota.
    *   Campo `!!prompt` en la configuración de la plantilla (si aplica).
2.  **Ejecución**: Envía a Gemini:
    *   El prompt seleccionado.
    *   El título de la nota.
    *   El contenido actual (Frontmatter + Cuerpo).
3.  **Respuesta**: Recibe de Gemini:
    *   Sugerencias para el frontmatter (que se fusionan inteligentemente).
    *   Contenido para el cuerpo de la nota (que se añade o inserta).
4.  **Comandos Extra**: Si el frontmatter define `!!commands`, también puede desencadenar otros comandos.

## Uso Manual

Puedes añadir manualmente instrucciones a cualquier nota:
```yaml
---
!!prompt: "Analiza este texto y extrae una lista de tareas"
---
Texto de la reunión...
```
Al ejecutar "Enhance with AI", el sistema procesará esa instrucción.
