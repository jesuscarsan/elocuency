import pytest
from unittest.mock import AsyncMock, MagicMock
from src.domain.ports.ai_port import AIPort
from src.infrastructure.config import AppConfig, AIConfig, ObsidianConfig, ServerConfig, PathsConfig

@pytest.fixture
def mock_ai_port():
    return AsyncMock(spec=AIPort)

@pytest.fixture
def mock_config():
    paths = PathsConfig(
        root="/app",
        workspace="/app/workspace",
        assets="/app/assets",
        mcps=["/app/workspace/mcps"],
        local_tools=[]
    )
    return AppConfig(
        server=ServerConfig(),
        ai=AIConfig(api_key="test-key"),
        obsidian=ObsidianConfig(),
        paths=paths
    )
