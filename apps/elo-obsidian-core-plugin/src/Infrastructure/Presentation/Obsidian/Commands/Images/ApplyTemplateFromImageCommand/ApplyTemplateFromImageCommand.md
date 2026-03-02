# Apply Template From Image Command

Variante de [Apply Template Command](./../ApplyTemplateCommand/ApplyTemplateCommand.md) que utiliza imágenes como fuente principal de información para la IA.

## ¿Cómo funciona?

1.  **Selección de Plantilla**: El usuario elige una plantilla (debe tener `!!prompt`).
2.  **Selección de Imágenes**: Se abre un modal para elegir imágenes desde:
    - Portapapeles.
    - Una carpeta local.
    - Selección de archivos manual.
3.  **Análisis Multimodal**:
    - Envía las imágenes + el `!!prompt` de la plantilla a Gemini Vision.
    - Gemini analiza el contenido visual para rellenar el frontmatter y el cuerpo de la nota según la plantilla.
4.  **Aplicación y Post-procesado**:
    - Fusiona el resultado con la nota actual.
    - Ejecuta las mismas acciones de movimiento y comandos extra que el comando base.

## Caso de Uso

Ideal para digitalizar o catalogar elementos visuales:

- Foto de una tarjeta de visita -> Plantilla Contacto.
- Foto de un monumento -> Plantilla Lugar.
- Foto de un ticket -> Plantilla Gasto.
