# Documentation Structure Rule

This rule enforces a consistent documentation structure across the monorepo and its projects (apps/libs).

## Rule

1.  **Documentation Location**:
    - All detailed documentation MUST be placed in a `/docs` directory.
    - There should be a general `/docs` directory at the root of the monorepo for monorepo-wide documentation.
    - Each application (`apps/*`) and library (`libs/*`) MUST have its own `/docs` directory for project-specific documentation.

2.  **README.md**:
    - The root of the monorepo and the root of each project (app/lib) MUST contain a `README.md` file.
    - This `README.md` file should provide:
        - Basic context about the project.
        - Instructions on how to use the basics.
        - Links to the detailed documentation files located in the corresponding `/docs` directory.

## Examples

### Monorepo Root
- `/README.md`: Contains general overview and links to `/docs/architecture.md`, `/docs/setup.md`, etc.
- `/docs/architecture.md`
- `/docs/setup.md`

### App/Lib
- `/apps/my-app/README.md`: Contains app overview and links to `/apps/my-app/docs/configuration.md`, etc.
- `/apps/my-app/docs/configuration.md`
