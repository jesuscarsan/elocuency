# Package Manager Rules

1. **Strict Requirement**: Use `pnpm` exclusively for all package management commands across the entire monorepo.
2. ⛔️ **NEVER use `npm` or `yarn`** to install, remove, or update dependencies.
3. If you need to run a script or install a package in a specific workspace app, use the `pnpm --filter <app-name>` flag or navigate to the directory and use `pnpm`.
4. The monorepo enforces `pnpm` usage via `only-allow pnpm` preinstall scripts in every `package.json`.
