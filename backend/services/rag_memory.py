"""
services/rag_memory.py
-----------------------
Persistent AI Memory using ChromaDB.
DEPLOY FIX: Uses DefaultEmbeddingFunction to avoid 400MB sentence-transformers
model download that crashes Render's free-tier RAM limit (512MB).
"""

import chromadb
from chromadb.utils import embedding_functions
import uuid
import logging
import os

logger = logging.getLogger("cloudiq.rag")

DB_DIR = os.path.join(os.path.dirname(__file__), "..", "chroma_db")

# Use ChromaDB's built-in lightweight embedding (no sentence-transformers needed).
# On Render/cloud: simple character-level hash for similarity.
# Trades deep semantic accuracy for zero-download cloud compatibility.
_default_ef = embedding_functions.DefaultEmbeddingFunction()

try:
    os.makedirs(DB_DIR, exist_ok=True)
    chroma_client = chromadb.PersistentClient(path=DB_DIR)
    chat_collection = chroma_client.get_or_create_collection(
        name="chat_history",
        embedding_function=_default_ef,   # ← explicit lightweight embedding
    )
    logger.info("[RAG] ChromaDB initialized with default embedding function")
except Exception as e:
    logger.error(f"[RAG] Failed to initialize ChromaDB: {e}")
    chat_collection = None


def store_interaction(user_message: str, ai_response: str, metadata: dict = None):
    """Store an interaction in the RAG memory."""
    if chat_collection is None:
        return

    doc_id = str(uuid.uuid4())
    document = f"User asked: {user_message}\nAI responded: {ai_response}"
    meta = metadata or {}
    meta["type"] = "chat_interaction"

    try:
        chat_collection.add(
            documents=[document],
            metadatas=[meta],
            ids=[doc_id]
        )
        logger.info(f"[RAG] Stored interaction {doc_id}")
    except Exception as e:
        logger.error(f"[RAG] Failed to store interaction: {e}")


def retrieve_relevant_history(query: str, n_results: int = 3) -> list:
    """Retrieve top relevant past interactions based on similarity search."""
    if chat_collection is None:
        return []

    try:
        if chat_collection.count() == 0:
            return []

        results = chat_collection.query(
            query_texts=[query],
            n_results=min(n_results, chat_collection.count())
        )
        if results and results["documents"] and results["documents"][0]:
            return results["documents"][0]
        return []
    except Exception as e:
        logger.error(f"[RAG] Failed to retrieve history: {e}")
        return []


def clear_memory():
    """Clear all stored interactions in the RAG memory."""
    global chat_collection
    if chat_collection is None:
        return
    try:
        try:
            chroma_client.delete_collection(name="chat_history")
        except Exception:
            pass
        chat_collection = chroma_client.get_or_create_collection(
            name="chat_history",
            embedding_function=_default_ef,
        )
        logger.info("[RAG] Cleared ChromaDB chat history successfully")
    except Exception as e:
        logger.error(f"[RAG] Failed to clear ChromaDB chat history: {e}")
