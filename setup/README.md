# Elo Server Distribution

This folder contains everything you need to run **Elo Server** easily on Linux, macOS, and Windows (via WSL2).

## Prerequisites

- **Docker Desktop** or **Docker Engine** installed and running.
- **Git** (recommended to clone the repository).

### Windows Users

Please ensure you are running these commands inside **WSL2** (Windows Subsystem for Linux).

1.  Install WSL2: `wsl --install` in PowerShell.
2.  Install Docker Desktop and enable WSL2 integration.
3.  Open your WSL terminal (e.g., Ubuntu).

## Quick Start

1.  Open your terminal in this directory (`install/`).
2.  Run the setup script:

    ```bash
    ./elo-setup.sh
    ```

3.  Follow the interactive prompts to configure your API keys and Vault path.

The script will:

- Check for Docker.
- Create/Update your `.env` configuration file.
- Build the local Docker images.
- Start the server and automation engine.

## Google Cloud Configuration

To use the Google Maps and AI features, you must configure your API key in the [Google Cloud Console](https://console.cloud.google.com/):

1.  **Enable APIs**:
    - **Geocoding API**: Required for address lookups.
    - **Places API**: Required for POI search (schools, businesses, etc.).
    - **Generative Language API**: Required for Gemini AI features.
2.  **Configure API Key Restrictions**:
    - Go to **APIs & Services > Credentials**.
    - Edit your API Key.
    - Under **API restrictions**, either select **"Don't restrict key"** (easiest for development) or ensure all three APIs mentioned above are explicitly allowed.
3.  **Propagation**: Changes may take up to 5 minutes to take effect. If you see `REQUEST_DENIED` errors in the logs, double-check these settings.

## Configuration

Your configuration is stored in `.env` inside this directory. You can edit it manually if needed.
To add new tools or modify agent settings, edit `elo.config.json` or add tool scripts to the `workspace/` folder (created after first run).

## Updating

To update the server (if you pulled new code):

1.  Run `./elo-setup.sh` again. It will rebuild the images.

## Troubleshooting

- **Permissions**: If you get permission errors on Linux, ensure your user is in the `docker` group (`sudo usermod -aG docker $USER`) or run with `sudo`.
- **Ports**: The server uses ports `8001` (API) and `5678` (n8n). Ensure they are free.
