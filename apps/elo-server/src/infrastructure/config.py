import json
import os
from pydantic import BaseModel, Field
from typing import Optional, List

class ServerConfig(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8001
    reload: bool = True
    auth_token: Optional[str] = None

class AIConfig(BaseModel):
    api_key: str
    model: str = "gemini-2.0-flash"
    search_api_key: Optional[str] = None
    search_engine_id: Optional[str] = None

class ObsidianConfig(BaseModel):
    vault_path: Optional[str] = None
    persist_directory: Optional[str] = None
    api_key: Optional[str] = None
    url: str = "http://host.docker.internal:27123"
    last_index_datetime: Optional[str] = None

class FilesystemConfig(BaseModel):
    allowed_paths: List[str] = Field(default_factory=list)

class N8nConfig(BaseModel):
    base_url: str = "http://localhost:5678"
    workflows_dir: str = "/elo-workspace/n8n/workflows"

class MCPConfig(BaseModel):
    name: str
    active: bool = True

class ToolConfig(BaseModel):
    name: str
    active: bool = True

class PathsConfig(BaseModel):
    root: str
    workspace: str
    assets: str
    mcps: List[str] = Field(default_factory=list)
    local_tools: List[str] = Field(default_factory=list)

class UserConfig(BaseModel):
    language: str = "es"
    locations_folder: str = "Mi mundo"
    target_folder: str = ""

class AppConfig(BaseModel):
    server: ServerConfig = Field(default_factory=ServerConfig)
    ai: AIConfig
    obsidian: ObsidianConfig
    n8n: N8nConfig
    user: UserConfig = Field(default_factory=UserConfig)
    filesystem: Optional[FilesystemConfig] = None
    paths: PathsConfig
    activated_mcps: List[MCPConfig] = Field(default_factory=list)
    activated_tools: List[ToolConfig] = Field(default_factory=list)
    config_file_path: Optional[str] = None

def load_config(config_path: Optional[str] = None) -> AppConfig:
    """
    Loads configuration by merging:
    1. Base structure from elo.config.json
    2. Sensitive data from environment variables (.env)
    3. Docker-specific path automation
    """
    # 1. Find and load elo-config.json
    target_config_path = "/elo-workbench/elo-workspace/elo-config.json"
    
    config_dict = {}
    source_path = None
    if os.path.exists(target_config_path):
        with open(target_config_path, "r") as f:
            config_dict = json.load(f)
            source_path = os.path.abspath(target_config_path)
            
    # 2. Map JSON keys to AppConfig structure (handling flattening/renaming)
    
    # User Config
    user_data = config_dict.get("user", {})
    user_config = {
        "language": user_data.get("language", "es"),
        "locations_folder": user_data.get("locationsFolder", "Mi mundo"),
        "target_folder": user_data.get("targetFolder", "")
    }
    
    # AI Config
    ai_data = config_dict.get("ai", {})
    ai_config = {
        "api_key": os.getenv("GOOGLE_AI_API_KEY", ""),
        "model": ai_data.get("model", os.getenv("AI_MODEL", "gemini-2.0-flash")),
        "search_api_key": os.getenv("GOOGLE_SEARCH_API_KEY", os.getenv("GOOGLE_AI_API_KEY")),
        "search_engine_id": ai_data.get("search_engine_id", os.getenv("GOOGLE_SEARCH_ENGINE_ID"))
    }
    
    # Obsidian Config
    obs_data = config_dict.get("obsidian", {})
    obs_config = {
        "vault_path": os.getenv("VAULT_PATH"),
        "api_key": os.getenv("OBSIDIAN_API_KEY"),
        "url": obs_data.get("url", obs_data.get("url", os.getenv("OBSIDIAN_URL", "http://host.docker.internal:27123"))),
        "persist_directory": os.getenv("PERSIST_DIRECTORY"),
        "last_index_datetime": obs_data.get("lastIndexDatetime")
    }
    
    # Server Config
    server_config = {
        "host": os.getenv("SERVER_HOST", "0.0.0.0"),
        "port": int(os.getenv("SERVER_PORT", 8001)),
        "reload": os.getenv("SERVER_RELOAD", "true").lower() == "true",
        "auth_token": os.getenv("SERVER_AUTH_TOKEN")
    }

    # n8n Config
    n8n_config = {
        "base_url": os.getenv("N8N_HOST", "http://localhost:5678"),
        "workflows_dir": os.getenv("N8N_WORKFLOWS_DIR", "/elo-workspace/n8n/workflows")
    }

    # Path Resolution Logic
    # Determine root of the project (apps/elo-server)
    # We assume this file is in src/infrastructure/config.py
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
    
    # Handle Docker paths vs Local paths
    is_docker = os.path.exists("/.dockerenv") or os.environ.get("DOCKER_CONTAINER") == "true"
    
    if is_docker:
        project_root = "/elo-workbench/apps/elo-server"
        workspace_path = "/elo-workbench/elo-workspace"
        assets_path = "/elo-workbench/apps/elo-server/assets"
    else:
        # Local development
        monorepo_root = os.path.dirname(os.path.dirname(project_root))
        workspace_path = os.path.join(monorepo_root, "elo-workspace")
        assets_path = os.path.join(project_root, "assets")

    mcps_workspace_path = os.path.join(workspace_path, "mcps")
    mcps_apps_path = os.path.join(project_root, "..")
    mcps_paths = [mcps_workspace_path, mcps_apps_path]
    
    # Tool directories
    tool_dirs = []
    
    # 1. Assets tools (git tracked)
    assets_tools = os.path.join(assets_path, "langchain", "tools")
    tool_dirs.append(assets_tools)
    
    # 2. Workspace tools (user defined)
    workspace_tools = os.path.join(workspace_path, "langchain", "tools")
    tool_dirs.append(workspace_tools)

    paths_config = {
        "root": project_root,
        "workspace": workspace_path,
        "assets": assets_path,
        "mcps": mcps_paths,
        "local_tools": tool_dirs
    }

    full_config_dict = {
        "server": server_config,
        "ai": ai_config,
        "obsidian": obs_config,
        "n8n": n8n_config,
        "user": user_config,
        "paths": paths_config,
        "activated_mcps": config_dict.get("mcps", []),
        "activated_tools": config_dict.get("langchainTools", []),
        "config_file_path": source_path
    }
    
    config = AppConfig(**full_config_dict)
    
    # 3. Automate vault_path for Docker
    if not config.obsidian.vault_path:
        if is_docker and os.path.exists("/data/vault"):
            config.obsidian.vault_path = "/data/vault"

    # 4. Automate filesystem allowed_paths for Docker
    if is_docker:
        config.filesystem = FilesystemConfig(allowed_paths=["/elo-workbench", "/data/vault"])
    elif not config.filesystem:
         # Allow workspace and assets locally
         config.filesystem = FilesystemConfig(allowed_paths=[workspace_path, assets_path])


    # 5. Automate persist_directory resolution
    if config.obsidian:
        # Default to 'workspace/chromadb' if not set
        if not config.obsidian.persist_directory:
             config.obsidian.persist_directory = os.path.join(workspace_path, "chromadb")
            
    return config

def update_obsidian_last_index(config_path: str, last_index: str):
    """
    Updates only the lastIndexDatetime field in elo.config.json.
    """
    if not os.path.exists(config_path):
        return
        
    with open(config_path, "r") as f:
        config_dict = json.load(f)
        
    if "obsidian" not in config_dict:
        config_dict["obsidian"] = {}
        
    config_dict["obsidian"]["lastIndexDatetime"] = last_index
    
    with open(config_path, "w") as f:
        json.dump(config_dict, f, indent=4)
