"""Aplikasi FastAPI — backend Python Elevan Property.

Berjalan di port 5056, BERDAMPINGAN dengan Node.js (5055) selama migrasi.
Belum menerima trafik WhatsApp produksi: webhook baru dialihkan setelah
harness paritas (`tests/parity/`) membuktikan perilakunya setara.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import Depends, FastAPI, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core import ngrok_tunnel
from app.core.startup_guard import build_stamp
from app.core import property_keyword_filter as gate
from app.db import check_connection, dispose_engine, get_db, get_session_factory
from app.routers.chatbot_private import router as chatbot_private_router
from app.routers.fonnte_webhook import fonnte_webhook
from app.routers.fonnte_webhook import router as fonnte_webhook_router
from app.routers.kirimi_webhook import kirimi_webhook
from app.routers.kirimi_webhook import router as kirimi_webhook_router
from app.routers.master import all_master_routers
from app.services.huggingface_service import HuggingFaceProviderError, call_huggingface_chat, check_huggingface_config

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(asctime)s %(name)s — %(message)s",
)
logger = logging.getLogger("elevan.python")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    logger.info("Backend Python start — port %s", settings.PYTHON_PORT)
    logger.info("Provider AI utama: %s", settings.AI_PRIMARY_PROVIDER)
    logger.info("Terminal WhatsApp : %s", settings.MESSAGE_TERMINAL)
    logger.info("Stempel kode      : %s", build_stamp())

    db = await check_connection()
    if db["connected"]:
        logger.info("Database  : terhubung (%s)", settings.DB_NAME)
        # Mirror Node.js initLocationCache() — gagal-diam ke fallback statis,
        # TIDAK PERNAH menggagalkan startup (lihat property_keyword_filter.py).
        async with get_session_factory()() as _session:
            await gate.init_location_cache(_session)
    else:
        # Fail-open: proses tetap hidup supaya /health bisa melaporkan
        # penyebabnya. Mati saat boot hanya menyembunyikan informasi.
        logger.warning("Database  : GAGAL — %s", db["error"])

    ngrok_tunnel.start_tunnel()

    yield

    ngrok_tunnel.stop_tunnel()
    await dispose_engine()
    logger.info("Backend Python berhenti — koneksi DB ditutup.")


app = FastAPI(
    title="Elevan Property — Backend Python",
    description=(
        "Migrasi bertahap dari Node.js. Berjalan berdampingan; webhook "
        "produksi dialihkan hanya setelah paritas terbukti."
    ),
    version="0.1.0",
    lifespan=lifespan,
)


# Master data: 5 modul × 6 endpoint. Rute & bentuk respons dijaga identik
# dengan Node.js supaya frontend Vue yang sama bisa menunjuk ke backend mana pun.
for _router in all_master_routers():
    app.include_router(_router)

# Webhook WhatsApp sisi Python (M98/M100/M105) — menerima, menyaring,
# menyimpan, menyusun balasan, dan (bila PYTHON_AI_REPLY_ENABLED=true) MENGIRIM.
# Keduanya memakai app/services/inbound_message_service.py yang sama.
app.include_router(kirimi_webhook_router)
app.include_router(fonnte_webhook_router)

# Chat website (M113) — port chatbotPrivateController.js. Memakai orkestrator
# AI yang SAMA dengan WhatsApp, jadi perbaikan anti-ulang/batas sesi berlaku
# untuk kedua kanal sekaligus.
app.include_router(chatbot_private_router)


@app.post("/", tags=["webhook"])
async def root_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Webhook di ROOT — port `app.post('/')` milik server.js (M106).

    ⚠️ INI PENYEBAB "Python tidak membalas & terminal kosong" pada 15 Agu 2026.
    Dashboard Kirimi di akun ini dikonfigurasi ke BASE URL saja
    (`https://<domain>/`), TANPA path `/api/kirimi/webhook`. Node.js sudah lama
    punya handler root ini sehingga tetap bekerja; Python belum, jadi setiap
    pesan customer dijawab **404 Not Found** — terlihat di log sebagai
    `"POST / HTTP/1.1" 404 Not Found`, dan dari sisi customer terlihat seperti
    AI diam saja.

    Routing mengikuti `MASSEGE_TERMINAL` di .env, sama persis dengan Node.js.
    Menambahkan handler ini membuat Python bekerja dengan konfigurasi dashboard
    APA PUN — dengan path maupun tanpa path — sehingga tidak ada lagi kelas
    kegagalan diam yang bergantung pada isi dashboard.
    """
    body = await request.json()
    active = (get_settings().MASSEGE_TERMINAL or "KIRIMI").upper().split(",")[0].strip()

    logger.info("[ROOT WEBHOOK] POST / diterima — routing ke: %s", active)

    if active == "FONNTE":
        return await fonnte_webhook(request, db, prefetched_body=body)
    if active in ("KIRIMI", ""):
        return await kirimi_webhook(request, db, prefetched_body=body)

    # TIMELINESAI belum diport ke Python — jawab 200 supaya platform tidak
    # menganggap webhook rusak, tapi katakan apa adanya di log.
    logger.warning("[ROOT WEBHOOK] MASSEGE_TERMINAL='%s' belum didukung di Python", active)
    return {
        "status": True,
        "message": f"Webhook diterima. Terminal '{active}' belum didukung python_backend.",
    }


class HealthResponse(BaseModel):
    status: str
    app_name: str
    ai_provider: str
    terminal: str
    database_connected: bool
    database_error: str | None = None
    # "Application startup complete" TIDAK berarti terjangkau dari luar. Tanpa
    # tunnel, backend hanya hidup di localhost dan webhook customer tidak akan
    # pernah sampai — keadaan itu harus terlihat, bukan disimpulkan dari log.
    tunnel: dict = {}
    # Sidik jari isi modul inti (M115). Menjawab "apakah server ini sudah
    # membawa perbaikan terbaru?" tanpa menebak dari perilaku chat.
    build: str = ""


@app.get("/health", response_model=HealthResponse, tags=["infra"])
async def health() -> HealthResponse:
    """Kesehatan proses + DB. Selalu 200 — status ada di body.

    Sengaja tidak mengembalikan 503 saat DB mati: proses Python-nya sendiri
    sehat, dan membedakan "aplikasi mati" dari "DB mati" mempercepat diagnosis.
    """
    settings = get_settings()
    db = await check_connection()
    return HealthResponse(
        status="ok",
        app_name=settings.APP_NAME,
        ai_provider=settings.AI_PRIMARY_PROVIDER,
        terminal=settings.MESSAGE_TERMINAL,
        database_connected=db["connected"],
        database_error=db["error"],
        tunnel=ngrok_tunnel.tunnel_status(),
        build=build_stamp(),
    )


class GateRequest(BaseModel):
    message: str


class GateResponse(BaseModel):
    message: str
    is_property_query: bool


@app.post("/internal/gate-check", response_model=GateResponse, tags=["migrasi"])
async def gate_check(payload: GateRequest) -> GateResponse:
    """Endpoint bantu migrasi: jalankan gerbang masuk versi Python.

    Dipakai untuk membandingkan langsung dengan Node.js tanpa mengalihkan
    trafik. BUKAN endpoint produksi — hapus setelah peralihan selesai.
    """
    return GateResponse(
        message=payload.message,
        is_property_query=gate.has_property_keyword(payload.message),
    )


class HfChatRequest(BaseModel):
    prompt: str
    system: str = "You are a helpful assistant."


@app.get("/internal/huggingface-config", tags=["migrasi"])
async def huggingface_config() -> dict:
    """Konfigurasi HF Router aktif (tanpa membocorkan token)."""
    return check_huggingface_config()


@app.post("/internal/huggingface-chat", tags=["migrasi"])
async def huggingface_chat(payload: HfChatRequest) -> dict:
    """Endpoint bantu migrasi: panggil HF Router versi Python langsung.

    BUKAN endpoint produksi. Dipakai untuk membuktikan port ini setara dengan
    `huggingfaceService.js` sebelum dialihkan ke jalur produksi.
    """
    try:
        reply = await call_huggingface_chat(payload.prompt, system_prompt=payload.system)
        return {"ok": True, "reply": reply}
    except HuggingFaceProviderError as exc:
        return {
            "ok": False,
            "error": str(exc),
            "status": exc.status,
            "fallback_eligible": exc.fallback_eligible,
            "config_error": exc.config_error,
        }
