#!/usr/bin/env bash

# install-elo.sh
# Script de instalación para añadir 'elo' al PATH del sistema (Mac/Linux/WSL)

set -e

# Detectar el directorio donde está este script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "========================================="
echo "  Instalando Elo CLI en tu sistema..."
echo "========================================="

# Dar permisos de ejecución al script envoltorio
chmod +x "$DIR/apps/elo-cli/elo"

# Build the Docker image for elo-cli
echo "🔨 Building Elo CLI Docker image..."
docker build -t elo-cli-env "$DIR/apps/elo-cli"

# Crear enlace simbólico en /usr/local/bin
# Dependiendo del sistema, esto puede requerir sudo
DEST="/usr/local/bin/elo"

if [ -w "/usr/local/bin" ]; then
    ln -sf "$DIR/apps/elo-cli/elo" "$DEST"
    echo "✅ Instalado correctamente en $DEST"
else
    echo "Para instalar globalmente se requieren permisos de administrador."
    sudo ln -sf "$DIR/apps/elo-cli/elo" "$DEST"
    echo "✅ Instalado correctamente en $DEST usando sudo"
fi

# Configuración de autocompletado (zsh)
if [[ "$SHELL" == *"zsh"* ]]; then
    ZSH_CONFIG="$HOME/.zshrc"
    COMPLETION_LINE="source <(elo completion zsh)"
    
    if [ -f "$ZSH_CONFIG" ]; then
        if ! grep -qF "$COMPLETION_LINE" "$ZSH_CONFIG"; then
            echo "" >> "$ZSH_CONFIG"
            echo "# Elo CLI autocompletion" >> "$ZSH_CONFIG"
            echo "$COMPLETION_LINE" >> "$ZSH_CONFIG"
            echo "✨ Autocompletado configurado en $ZSH_CONFIG"
            echo "   (Reinicia tu terminal o ejecuta 'source $ZSH_CONFIG' para activarlo)"
        else
            echo "ℹ️ El autocompletado ya está configurado en $ZSH_CONFIG"
        fi
    fi
fi

echo "========================================="
echo "¡Todo listo! Ya puedes usar el comando 'elo' desde cualquier directorio."
echo "Prueba a ejecutar: elo --help"
echo "========================================="
