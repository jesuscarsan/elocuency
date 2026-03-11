# Agent Rules: Runtime Environment & Docker

This document defines the rules for interacting with the execution environment of the project.

## 1. Execution Environment: Docker

Both **Python** (`elo-server`) and **Node.js/TypeScript** applications (CLI, etc.) are executed within Docker containers.

### 1.1 Command Execution
- ⛔️ **NEVER** assume that running `python3` or `node` directly on the host will work or affect the running system.
- ✅ **ALWAYS** use `docker exec [container-name] [command]` when you need to run scripts, verify installations, or interact with the running process.
- Common containers:
  - `setup-elo-server-1`: For Python backend logic and LangChain tools.
  - `elo-cli`: For command-line utilities.

### 1.2 Dependency Management
- Python dependencies are managed in `apps/elo-server/requirements.txt`.
- Node dependencies are managed in their respective `package.json` files.
- ✅ When adding a dependency, update the file and, if possible, install it inside the running container using `docker exec ... pip install` to avoid downtime.
- ✅ Remind the user to run `docker-compose build` periodically to persist changes in the images.

### 1.3 File System & Volumes
- The project root is typically mounted at `/elo-workbench` inside the containers.
- ✅ Be aware of path mappings (Host vs. Container). When providing paths for internal commands, use the container-relative paths.

---

> [!IMPORTANT]
> If you are unsure about the container name or status, use `docker ps` to verify the environment before attempting any execution.
