#!/bin/bash
set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

MONOREPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}      Elo Workbench Unified Setup       ${NC}"
echo -e "${GREEN}========================================${NC}"

# 1. Security Check (.gitignore)
if ! grep -q "^\.env" "$MONOREPO_ROOT/.gitignore" 2>/dev/null; then
    echo -e "\n${YELLOW}[1/4] Hardening security (.gitignore)...${NC}"
    echo -e ".env\n.env.*" >> "$MONOREPO_ROOT/.gitignore"
    echo "  - Added .env to .gitignore."
fi

# 2. Setup Environment File
ENV_FILE="$MONOREPO_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env file..."
    touch "$ENV_FILE"
fi
# Ensure the file ends with a newline to prevent merged appended variables
echo "" >> "$ENV_FILE"

prompt_var() {
    local var_name=$1
    local prompt_text=$2
    local default_value=$3
    local is_sensitive=${4:-false}
    local current_value
    local input_value

    current_value=$(grep "^${var_name}=" "$ENV_FILE" | cut -d '=' -f2- || true)

    if [ -n "$current_value" ]; then
        if [ "$is_sensitive" = "true" ]; then
            echo -ne "  $prompt_text (already set, enter to keep hidden value, or type new): "
        else
            echo -ne "  $prompt_text [$current_value]: "
        fi
    else
        echo -ne "  $prompt_text"
        if [ -n "$default_value" ] && [ "$is_sensitive" = "false" ]; then
            echo -ne " [$default_value]"
        fi
        echo -ne ": "
    fi

    if [ "$is_sensitive" = "true" ]; then
        read -rs input_value || true
        echo "" # New line after hidden input
    else
        read -r input_value || true
    fi

    if [ -z "$input_value" ]; then
        if [ -n "$current_value" ]; then
            input_value="$current_value"
        elif [ -n "$default_value" ]; then
            input_value="$default_value"
        fi
    fi

    if [ -n "$input_value" ]; then
        if grep -q "^${var_name}=" "$ENV_FILE"; then
            sed -i.bak "s|^${var_name}=.*|${var_name}=${input_value}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
        else
            echo "$var_name=$input_value" >> "$ENV_FILE"
        fi
    else
         echo -e "${RED}  ! Warning: $var_name remains empty.${NC}"
    fi
}

# 3. Runtime Mode Selection
echo -e "\n${YELLOW}[2/4] Select Runtime Environment...${NC}"
echo "  1) Docker (Recommended if you have Docker Desktop installed)"
echo "  2) Native (Node.js/npm directly on your OS)"
echo -ne "Choose [1/2]: "
read -r runtime_choice || runtime_choice="1"

if [ "$runtime_choice" == "2" ]; then
    # Native Runtime
    if grep -q "^ELO_RUNTIME_MODE=" "$ENV_FILE"; then
        sed -i.bak 's/^ELO_RUNTIME_MODE=.*/ELO_RUNTIME_MODE=native/' "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
    else
        echo -e "\nELO_RUNTIME_MODE=native" >> "$ENV_FILE"
    fi

    echo -e "\n${YELLOW}[3/4] Configure Native Services & API Keys...${NC}"
    echo "Elo-server will always be enabled."
    
    prompt_var "BASIC_AI_MODEL" "Enter default AI model for simple prompts" "gemini-2.0-flash" "false"
    prompt_var "GOOGLE_AI_API_KEY" "Enter Google AI API Key" "" "true"
    prompt_var "OPENAI_API_KEY" "Enter OpenAI API Key" "" "true"
    prompt_var "OBSIDIAN_API_KEY" "Enter Obsidian API Key" "obsidian-secret-key" "true"
    prompt_var "OBSIDIAN_URL" "Enter Obsidian URL" "http://localhost:27124"
    prompt_var "DATABASE_URL" "Enter PostgreSQL Vector DB URL" "postgresql://elo_user:elo_password@localhost:5432/elo_db" "true"
    
    prompt_var "LOCAL_N8N_ENABLED" "Do you want to enable n8n locally? (true/false)" "false" "false"
    
    if grep -q "^LOCAL_N8N_ENABLED=true" "$ENV_FILE"; then
        prompt_var "LOCAL_CADDY_NGROK_ENABLED" "Do you want to enable caddy & ngrok locally for n8n webhooks? (true/false)" "false" "false"
        if grep -q "^LOCAL_CADDY_NGROK_ENABLED=true" "$ENV_FILE"; then
            prompt_var "NGROK_AUTHTOKEN" "Enter Ngrok Authtoken" "" "true"
        fi
    fi
else
    # Docker Runtime
    if grep -q "^ELO_RUNTIME_MODE=" "$ENV_FILE"; then
        sed -i.bak 's/^ELO_RUNTIME_MODE=.*/ELO_RUNTIME_MODE=docker/' "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
    else
        echo -e "\nELO_RUNTIME_MODE=docker" >> "$ENV_FILE"
    fi

    echo -e "\n${YELLOW}[3/4] Configure Docker Services & API Keys...${NC}"
    prompt_var "BASIC_AI_MODEL" "Enter default AI model for simple prompts" "gemini-2.0-flash" "false"
    prompt_var "GOOGLE_AI_API_KEY" "Enter Google AI API Key" "" "true"
    prompt_var "OPENAI_API_KEY" "Enter OpenAI API Key" "" "true"
    prompt_var "OBSIDIAN_API_KEY" "Enter Obsidian API Key" "obsidian-secret-key" "true"
    prompt_var "OBSIDIAN_URL" "Enter Obsidian URL" "http://host.docker.internal:27124"
    prompt_var "DATABASE_URL" "Enter PostgreSQL Vector DB URL" "postgresql://elo_user:elo_password@pgvector:5432/elo_db" "true"
    
    prompt_var "LOCAL_N8N_ENABLED" "Do you want to enable n8n, caddy, and ngrok locally (via Docker)? (true/false)" "false" "false"
    
    if grep -q "^LOCAL_N8N_ENABLED=true" "$ENV_FILE"; then
        prompt_var "NGROK_AUTHTOKEN" "Enter Ngrok Authtoken for n8n webhooks" "" "true"
    fi
fi

# Workspace Handling (Applies to both)
prompt_var "ELO_WORKSPACE_PATH" "Enter absolute path to ELO Workspace" "${MONOREPO_ROOT}/elo-workspace"

WS_PATH=$(grep "^ELO_WORKSPACE_PATH=" "$ENV_FILE" | cut -d '=' -f2-)
if [ -z "$WS_PATH" ]; then WS_PATH="${MONOREPO_ROOT}/elo-workspace"; fi

if [ -d "$MONOREPO_ROOT/workspace" ] && [ ! -d "$WS_PATH" ]; then
    echo -e "\n${YELLOW}Migrating: Moving existing 'workspace/' to '$WS_PATH'...${NC}"
    mkdir -p "$(dirname "$WS_PATH")"
    mv "$MONOREPO_ROOT/workspace" "$WS_PATH"
fi

prompt_var "VAULT_PATH" "Enter absolute path to your Obsidian Vault" ""

echo "Preparing folders in $WS_PATH..."
mkdir -p "$WS_PATH/logs/caddy" "$WS_PATH/logs/elo-server" 
mkdir -p "$WS_PATH/n8n/workflows" "$WS_PATH/n8n/data"
mkdir -p "$WS_PATH/caddy_data" "$WS_PATH/caddy_config"

# 4. Finalize Installation
echo -e "\n${YELLOW}[4/4] Finalizing Installation...${NC}"

if [ "$runtime_choice" == "2" ]; then
    echo "Installing native dependencies..."
    cd "$MONOREPO_ROOT"
    if command -v pnpm &> /dev/null; then 
        pnpm install
    elif command -v npm &> /dev/null; then 
        npm install
    else
        echo -e "${RED}Error: Neither pnpm nor npm is installed. Please install Node.js and a package manager.${NC}"
        exit 1
    fi

    echo "Starting PostgreSQL Vector DB..."
    if command -v docker &> /dev/null; then
        docker-compose -f "$MONOREPO_ROOT/docker-compose.yml" up -d pgvector
    else
        echo -e "${YELLOW}Warning: Docker not installed. You will need to start your Postgres DB manually.${NC}"
    fi

    echo -e "\n${GREEN}Setup complete! Run 'elo server start' to start native services.${NC}"
else
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: 'docker' is not installed.${NC}"
        echo "Please install Docker Desktop or Docker Engine first."
        exit 1
    fi

    DOCKER_COMPOSE_CMD=""
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}Error: 'docker compose' is not installed.${NC}"
        exit 1
    fi

    echo "Select environment mode for Docker:"
    echo "  1) Development (hot-reload, source code volume mount)"
    echo "  2) Production (stable execution)"
    echo -ne "Choose [1/2]: "
    read -r env_choice || env_choice="1"

    COMPOSE_ARGS=("--env-file" "$ENV_FILE" "-f" "$MONOREPO_ROOT/setup/docker-compose.yml" "-f" "$MONOREPO_ROOT/docker-compose.yml")
    if [ "$env_choice" == "1" ]; then
        COMPOSE_ARGS+=("-f" "$MONOREPO_ROOT/setup/docker-compose.dev.yml")
    else
        COMPOSE_ARGS+=("-f" "$MONOREPO_ROOT/setup/docker-compose.prod.yml")
    fi

    if grep -q "^LOCAL_N8N_ENABLED=true" "$ENV_FILE"; then
        COMPOSE_ARGS+=("--profile" "n8n")
    fi

    echo "Starting Docker services..."
    export ELO_WORKSPACE_PATH="$WS_PATH"
    ${DOCKER_COMPOSE_CMD} "${COMPOSE_ARGS[@]}" up -d --build

    if [ $? -eq 0 ]; then
        echo -e "\n${GREEN}Success! Elo Server is running via Docker.${NC}"
        echo "  - Access UI/API: http://localhost/"
        echo "  - n8n Automation: http://localhost/n8n/"
        echo "  - Logs: tail -f $WS_PATH/logs/elo-server.log"
    else
        echo -e "${RED}Failed to start services.${NC}"
        exit 1
    fi
fi

# 5. Check and Install elo CLI
echo -e "\n${YELLOW}[5/5] Configuring elo CLI...${NC}"
ELO_BIN="/usr/local/bin/elo"

# Dar permisos de ejecución
chmod +x "$MONOREPO_ROOT/apps/elo-cli/elo"

if [ "$runtime_choice" != "2" ]; then
    # Docker mode chosen, build the CLI image
    echo "🔨 Building Elo CLI Docker image..."
    docker build -t elo-cli-env "$MONOREPO_ROOT/apps/elo-cli"
fi

DO_LINK=false
if [ -L "$ELO_BIN" ] && [ "$(readlink "$ELO_BIN")" != "$MONOREPO_ROOT/apps/elo-cli/elo" ]; then
    echo "  - Fixing outdated 'elo' symlink..."
    DO_LINK=true
elif [ ! -f "$ELO_BIN" ] && [ ! -L "$ELO_BIN" ]; then
    echo "  - Installing 'elo' command globally..."
    DO_LINK=true
else
    echo "  - 'elo' command is already installed correctly."
fi

if [ "$DO_LINK" = true ]; then
    if [ -w "/usr/local/bin" ]; then
        ln -sf "$MONOREPO_ROOT/apps/elo-cli/elo" "$ELO_BIN"
    else
        echo "Requiere permisos de administrador para instalar en $ELO_BIN:"
        sudo ln -sf "$MONOREPO_ROOT/apps/elo-cli/elo" "$ELO_BIN"
    fi
    echo "✅ Comando 'elo' instalado con éxito."
fi

# Configuración de autocompletado (zsh)
if [[ "$SHELL" == *"zsh"* ]]; then
    ZSH_CONFIG="$HOME/.zshrc"
    COMPLETION_LINE="source <($ELO_BIN completion zsh 2>/dev/null || elo completion zsh 2>/dev/null)"
    
    if [ -f "$ZSH_CONFIG" ]; then
        if ! grep -qF "elo completion zsh" "$ZSH_CONFIG"; then
            echo "" >> "$ZSH_CONFIG"
            echo "# Elo CLI autocompletion" >> "$ZSH_CONFIG"
            echo "$COMPLETION_LINE" >> "$ZSH_CONFIG"
            echo "✨ Autocompletado configurado en $ZSH_CONFIG"
        fi
    fi
fi
