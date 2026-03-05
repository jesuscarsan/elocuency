# Elo Configuration Documentation (`elo.config.json`)

This document describes the structure and available settings for the `elo.config.json` file, which centralizes the configuration for the Elocuency v3 ecosystem.

## Configuration Structure

The file uses JSON format and contains the following top-level keys:

### `markdownVaults`

- **Type**: `string[]`
- **Description**: A list of absolute paths to the Obsidian vaults that the system should be aware of or index for semantic search.
- **Example**:
  ```json
  "markdownVaults": [
      "/Users/joshua/my-docs/KBs/JACS",
      "/Users/joshua/my-docs/KBs/Cocina"
  ]
  ```

### `mcps` (Model Context Protocol)

- **Type**: `object[]`
- **Description**: Configuration for MCP servers.
- **Fields**:
  - `name`: Identifier for the MCP server.
  - `active`: Boolean flag to enable or disable the MCP server.

### `langchainTools`

- **Type**: `object[]`
- **Description**: Configuration for LangChain tools.
- **Fields**:
  - `name`: Name of the tool (e.g., `n8n_workflows`).
  - `active`: Boolean flag to enable or disable the tool.

### `ai`

- **Type**: `object`
- **Description**: General AI settings.
- **Fields**:
  - `model`: The AI model to be used by the server (e.g., `gemini-2.0-flash`).

### `obsidian`

- **Type**: `object`
- **Description**: Specific configuration for Obsidian integration.
- **Fields**:
  - `url`: The local API URL for the Obsidian server (usually via the Local REST API plugin).
  - `lastIndexDatetime`: ISO timestamp of the last time the vaults were indexed for semantic search.
