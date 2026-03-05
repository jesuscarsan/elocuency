import os
import pytest
from src.infrastructure.config import load_config

def test_load_config_defaults():
    # Act
    config = load_config()

    # Assert
    assert config is not None
    assert config.server.host == "0.0.0.0"
    assert config.server.port == 8001
    assert config.paths.root is not None
    assert config.paths.workspace is not None

def test_load_config_env_vars(monkeypatch):
    # Arrange
    monkeypatch.setenv("SERVER_PORT", "9000")
    monkeypatch.setenv("GOOGLE_API_KEY", "env-key")

    # Act
    config = load_config()

    # Assert
    assert config.server.port == 9000
    assert config.ai.api_key == "env-key"

def test_load_config_prioritize_ai_key(monkeypatch):
    # Arrange
    monkeypatch.setenv("GOOGLE_API_KEY", "old-key")
    monkeypatch.setenv("GOOGLE_AI_API_KEY", "new-key")

    # Act
    config = load_config()

    # Assert
    assert config.ai.api_key == "new-key"
