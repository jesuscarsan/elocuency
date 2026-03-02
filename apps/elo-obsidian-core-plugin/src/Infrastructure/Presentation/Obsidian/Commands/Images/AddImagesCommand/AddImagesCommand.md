# Add Images Command

Este comando busca y añade imágenes automáticamente a la nota actual basándose en su título.

## ¿Cómo funciona?

1.  **Lectura del Título**: Utiliza el nombre del archivo (nota) como término de búsqueda.
2.  **Verificación Previa**: Comprueba si la nota ya tiene imágenes en el campo `"!!images"` del frontmatter. Si ya tiene, se detiene para evitar duplicados.
3.  **Búsqueda de Imágenes**: Utiliza Google Custom Search para encontrar imágenes relacionadas con el título.
4.  **Actualización del Frontmatter**: Añade las URLs de las 3 primeras imágenes encontradas al campo `"!!images"`.

## Requisitos

*   Tener configurada la API Key de Google Custom Search en los ajustes del plugin.
*   Tener configurado el Search Engine ID en los ajustes del plugin.
*   La nota debe ser un archivo Markdown.

## Ejemplo

Si tienes una nota llamada `[[Torre Eiffel]]`, al ejecutar el comando:
1.  Buscará "Torre Eiffel" en Google Images.
2.  Añadirá 3 enlaces de imágenes al frontmatter:
    ```yaml
    "!!images":
      - "https://ejemplo.com/imagen1.jpg"
      - "https://ejemplo.com/imagen2.jpg"
      - "https://ejemplo.com/imagen3.jpg"
    ```
