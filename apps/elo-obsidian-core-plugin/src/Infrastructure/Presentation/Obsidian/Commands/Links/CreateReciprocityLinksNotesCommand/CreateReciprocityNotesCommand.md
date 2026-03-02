# Create Reciprocity Notes Command

Este comando gestiona y crea automáticamente las relaciones bidireccionales entre personas (ej. Padre <-> Hijo).

## ¿Cómo funciona?

1.  **Escaneo de Relaciones**: Lee el frontmatter de la nota actual buscando campos definidos como recíprocos en el registro (ej. `Hijos`, `Padres`, `Exparejas`, `CompanerosTrabajo`).
2.  **Resolución de Enlaces**: Para cada persona mencionada en esos campos:
    *   Busca si ya existe una nota para ella.
    *   Si hay ambigüedad (varias notas similares) o no existe, muestra un buscador para elegir o crear una nueva.
3.  **Creación Automática**: Si se elige crear una nueva nota, utiliza la plantilla `Personas/Persona` y aplica la etiqueta `Personas`.
4.  **Vinculación Bidireccional**:
    *   **En la nota origen**: Asegura que el enlace apunte al nombre correcto del archivo.
    *   **En la nota destino**: Añade el enlace recíproco en el campo correspondiente (ej. Si en A pones `Hijos: [[B]]`, en B pone `Padres: [[A]]`).

## Ejemplo

En la nota `[[Darth Vader]]`:
```yaml
Hijos: [[Luke]]
```
Ejecutas el comando:
1.  El sistema busca "Luke". No lo encuentra exacto.
2.  Te ofrece crear `[[Luke Skywalker]]`.
3.  Crea la nota `[[Luke Skywalker]]`.
4.  Actualiza `[[Darth Vader]]`: `Hijos: [[Luke Skywalker]]`.
5.  Actualiza `[[Luke Skywalker]]`: `Padres: [[Darth Vader]]`.
