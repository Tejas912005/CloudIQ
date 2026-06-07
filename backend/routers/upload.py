"""
backend/routers/upload.py
--------------------------
POST /api/assistant/upload
Upload a document or image, extract its text, and return it for use in the chat pipeline.

Supported types:
  .pdf          → text extraction via pypdf
  .docx         → text extraction via python-docx
  .txt .md .csv .json → read directly as UTF-8
  images (jpg/png/gif/webp) → description placeholder (routed to Gemini vision)
  other         → metadata-only response
"""
from __future__ import annotations
import io
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from core.auth import verify_api_key

router = APIRouter(prefix="/api", tags=["Assistant Upload"])

# Accepted MIME types for text extraction
TEXT_MIMES = {
    "text/plain", "text/markdown", "text/csv",
    "application/json", "application/xml",
}
IMAGE_MIMES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
}


@router.post("/assistant/upload", dependencies=[Depends(verify_api_key)])
async def upload(file: UploadFile = File(...)):
    filename  = file.filename or "uploaded_file"
    mime_type = file.content_type or "application/octet-stream"
    raw_bytes = await file.read()

    extracted_text = _extract_text(filename, mime_type, raw_bytes)

    return {
        "filename":       filename,
        "mime_type":      mime_type,
        "size_bytes":     len(raw_bytes),
        "extracted_text": extracted_text,
    }


def _extract_text(filename: str, mime_type: str, data: bytes) -> str:
    """Route to the correct extractor based on mime type and file extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # ── PDF ──────────────────────────────────────────────────────────────────
    if mime_type == "application/pdf" or ext == "pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            pages  = [p.extract_text() or "" for p in reader.pages]
            text   = "\n\n".join(p.strip() for p in pages if p.strip())
            if not text:
                return "[PDF uploaded but contained no extractable text — may be scanned/image-based]"
            return text[:8000]  # cap at 8K chars for prompt safety
        except Exception as e:
            return f"[PDF received but extraction failed: {str(e)}]"

    # ── Word Document ─────────────────────────────────────────────────────────
    if mime_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ) or ext in ("docx", "doc"):
        try:
            from docx import Document
            doc  = Document(io.BytesIO(data))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            if not text:
                return "[Word document uploaded but contained no extractable text]"
            return text[:8000]
        except Exception as e:
            return f"[Word document received but extraction failed: {str(e)}]"

    # ── Plain Text / JSON / CSV / Markdown ────────────────────────────────────
    if mime_type in TEXT_MIMES or ext in ("txt", "md", "csv", "json", "xml", "log"):
        try:
            text = data.decode("utf-8", errors="replace")
            return text[:8000]
        except Exception:
            return "[Text file received but could not be decoded]"

    # ── Images ────────────────────────────────────────────────────────────────
    if mime_type in IMAGE_MIMES or ext in ("jpg", "jpeg", "png", "gif", "webp"):
        return (
            f"[Image file uploaded: {filename} ({len(data) // 1024}KB). "
            "The AI assistant will analyse its visual content directly.]"
        )

    # ── Fallback ──────────────────────────────────────────────────────────────
    return (
        f"[File received: {filename} ({mime_type}, {len(data) // 1024}KB). "
        "Direct text extraction is not supported for this file type. "
        "Describe its contents to the assistant for analysis.]"
    )
