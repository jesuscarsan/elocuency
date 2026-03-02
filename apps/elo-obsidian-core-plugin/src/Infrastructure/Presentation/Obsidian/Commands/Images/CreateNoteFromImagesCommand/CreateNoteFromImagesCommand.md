# Create Note From Images Command

Este comando permite crear contenido en la nota activa a partir del análisis de imágenes, sin usar una plantilla específica.

## ¿Cómo funciona?

1.  **Selección de Imágenes**: Pide al usuario imágenes (Portapapeles, Carpeta, Archivos).
2.  **Procesamiento**: Convierte las imágenes a formato compatible para la IA.
3.  **Análisis Gemini**: Envía las imágenes a Gemini solicitando dos cosas:
    *   **Transcripción Literal**: Texto extraído de la imagen (OCR avanzado).
    *   **Análisis**: Descripción o interpretación de la imagen.
4.  **Salida**: Añade el resultado al final de la nota activa con el formato:
    ```markdown
    ## Transcripción Literal (NombreFuente)
    ...
    ## Análisis (NombreFuente)
    ...
    ```

## Diferencias con "Apply Template from Image"

*   Este comando **no** usa plantillas ni modifica el frontmatter estructuradamente.
*   Simplemente "vuelca" lo que ve la IA en el cuerpo de la nota.
*   Útil para OCR rápido o describir imágenes sin necesidad de catalogarlas.
