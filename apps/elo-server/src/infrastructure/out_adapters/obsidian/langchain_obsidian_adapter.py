import os
import json
import logging
import httpx
import urllib.parse
from datetime import datetime
from typing import List, Optional

# Suppress Chroma telemetry and other noise
os.environ["ANONYMIZED_TELEMETRY"] = "False"
logging.getLogger("chromadb").setLevel(logging.ERROR)

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from chromadb.config import Settings
from src.domain.ports.obsidian_port import ObsidianPort
from src.infrastructure.config import ObsidianConfig, update_obsidian_last_index

class LangChainObsidianAdapter(ObsidianPort):
    def __init__(self, obsidian_config: ObsidianConfig, google_api_key: str, config_path: str):
        self.obs_config = obsidian_config
        self.google_api_key = google_api_key
        self.config_path = config_path
        self.persist_directory = obsidian_config.persist_directory
        
        # Initialize HTTP Client
        self.client = httpx.Client(
            base_url=obsidian_config.url,
            headers={"Authorization": f"Bearer {obsidian_config.api_key}"},
            verify=False,
            timeout=30.0
        )
        
        self.last_sync_attempt = None
        self.sync_cooldown_seconds = 300 # 5 minutes
        
        # 1. Initialize Embeddings
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=google_api_key,
            task_type="retrieval_document"
        )
        
        self.vector_store = self._initialize_vector_store()

    def _initialize_vector_store(self):
        # 1. Load or Create Chroma
        vector_store = None
        if os.path.exists(self.persist_directory) and os.listdir(self.persist_directory):
            try:
                vector_store = Chroma(
                    persist_directory=self.persist_directory,
                    embedding_function=self.embeddings,
                    client_settings=Settings(anonymized_telemetry=False)
                )
            except Exception as e:
                logging.warning(f"Could not load existing ChromaDB: {e}")

        if not vector_store:
            logging.info(f"Creating new ChromaDB at {self.persist_directory}")
            vector_store = Chroma(
                embedding_function=self.embeddings,
                persist_directory=self.persist_directory,
                client_settings=Settings(anonymized_telemetry=False)
            )

        # 2. Sync Index (Initial)
        self.sync(force=True, vector_store=vector_store)
        
        return vector_store

    def sync(self, force: bool = False, vector_store: Optional[Chroma] = None) -> None:
        """
        Exposed sync method with cooldown to prevent hammering the API.
        """
        now = datetime.now()
        if not force and self.last_sync_attempt:
            elapsed = (now - self.last_sync_attempt).total_seconds()
            if elapsed < self.sync_cooldown_seconds:
                logging.info(f"Skipping semantic sync (cooldown: {int(self.sync_cooldown_seconds - elapsed)}s remaining)")
                return

        self.last_sync_attempt = now
        v_store = vector_store or self.vector_store
        if v_store:
            self._sync_index_internal(v_store)

    def _sync_index_internal(self, vector_store: Chroma):
        logging.info("Checking for Obsidian notes updates via API...")
        
        last_sync = self.obs_config.last_index_datetime
        
        # Build DQL
        if last_sync and last_sync.strip():
            # Filter by mtime > last_sync
            dql = f'TABLE file.mtime WHERE file.mtime > date("{last_sync}")'
        else:
            # Full scan
            dql = 'TABLE file.mtime WHERE file.name != ""'
            
        logging.info(f"Syncing with DQL: {dql}")
        
        try:
            response = self.client.post(
                "/search/",
                content=dql,
                headers={"Content-Type": "application/vnd.olrapi.dataview.dql+txt"}
            )
            response.raise_for_status()
            changes = response.json()
        except Exception as e:
            logging.error(f"Failed to fetch changes from Obsidian API: {e}")
            return

        if not changes:
            logging.info("No new or modified notes found since last sync.")
            return

        logging.info(f"Syncing {len(changes)} modified/new files...")
        
        all_new_documents = []
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        
        for item in changes:
            path = item.get("filename")
            if not path: continue
            
            # Fetch content via API
            content = self._fetch_note_content(path)
            if not content:
                continue
                
            # Create LangChain Document
            doc = Document(
                page_content=content,
                metadata={"path": path, "source": path}
            )
            
            # Split and add
            splits = text_splitter.split_documents([doc])
            all_new_documents.extend(splits)
            logging.info(f" Prepared {len(splits)} chunks for: {path}")

        if all_new_documents:
            try:
                # To avoid duplicates in simple implementation, we'd delete by path first
                # But since Chroma LC add_documents doesn't easily support 'delete by metadata' 
                # without IDs, for now we just add. 
                # Better: In the future, use IDs based on path.
                
                vector_store.add_documents(all_new_documents)
                logging.info(f"Successfully synchronized {len(all_new_documents)} chunks.")
                
                # Update persistent config
                new_timestamp = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
                update_obsidian_last_index(self.config_path, new_timestamp)
                logging.info(f"Updated lastIndexDatetime to {new_timestamp}")
                
            except Exception as e:
                logging.error(f"Error updating vector store: {e}")

    def _fetch_note_content(self, path: str) -> Optional[str]:
        try:
            encoded_path = urllib.parse.quote(path)
            response = self.client.get(f"/vault/{encoded_path}")
            response.raise_for_status()
            return response.text
        except Exception as e:
            logging.error(f"Error fetching content for {path}: {e}")
            return None

    def query(self, question: str) -> str:
        return "Query method is deprecated. Use semantic search tool instead."

    def search(self, query: str, k: int = 5) -> List[dict]:
        """Performs a semantic similarity search and returns raw document snippets."""
        try:
            docs = self.vector_store.similarity_search(query, k=k)
            return [
                {
                    "content": d.page_content, 
                    "path": d.metadata.get("path", "unknown"),
                    "source": d.metadata.get("source", "unknown")
                } 
                for d in docs
            ]
        except Exception as e:
            logging.error(f"Error performing semantic search: {e}")
            return []
