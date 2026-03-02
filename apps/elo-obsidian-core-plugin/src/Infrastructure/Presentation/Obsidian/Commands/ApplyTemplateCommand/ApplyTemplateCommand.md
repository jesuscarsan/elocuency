# Apply Template Command

Este es el comando principal para aplicar plantillas inteligentes a las notas.

## ¿Cómo funciona?

1.  **Selección de Plantilla**:
    - Escanea la carpeta de plantillas configurada.
    - Si hay múltiples plantillas, muestra un buscador difuso para elegir una.
2.  **Fusión (Merge)**: Combina el contenido de la plantilla con el de la nota actual (sin sobreescribir lo que ya exista, fusionando frontmatter).
3.  **Enriquecimiento con IA (Opcional)**:
    - Si la plantilla define un `!!prompt` en su configuración, envía este prompt junto con el título y frontmatter de la nota a Gemini.
    - Gemini devuelve sugerencias para rellenar campos del frontmatter y contenido para el cuerpo.
4.  **Imágenes (Opcional)**: Si tras el proceso el campo `"!!images"` está vacío, busca imágenes automáticamente (similar a [Add Images Command](./../Images/AddImagesCommand/AddImagesCommand.md)).
5.  **Organización y Post-procesado**:
    - Si la plantilla define `!!path`, mueve la nota a esa ruta.
    - Si la plantilla define `!!commands`, ejecuta esos comandos de Obsidian secuencialmente.
    - Si la plantila define `"!!images"`, ejecuta el command "AddImages".

## Configuración de Plantillas

Las plantillas pueden tener claves especiales en su frontmatter (que se eliminan de la nota final):

- `!!prompt`: Instrucción para la IA.
- `!!path`: Ruta destino para mover la nota.
- `!!commands`: Lista de IDs de comandos a ejecutar.
- `"!!images"`: Lista de URLs de imágenes.

## Ejemplo

Usar una plantilla "Persona" que tiene un prompt "Extrae fecha de nacimiento y profesión".

1.  Creas nota `[[Elon Musk]]`.
2.  Aplicas plantilla "Persona".
3.  Gemini rellena `Fecha nacimiento: 1971-06-28` y `Profesion: Empresario`.
