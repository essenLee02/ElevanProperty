"""Konfigurasi aplikasi — membaca `python_backend/.env` MILIK SENDIRI (M100).

SEBELUMNYA modul ini membaca `backend/.env` milik Node.js supaya tidak ada dua
sumber kebenaran. Diubah 15 Agu 2026 atas permintaan eksplisit pemilik produk:
"Perbaiki python_backend, agar menggunakan konfigurasi pada python_backend\\.env
sebagai acuan setting website dan terminal."

⚠️⚠️ DUA NILAI DI `.env` ITU SENGAJA TIDAK DIPAKAI — MEMBACANYA AKAN
MEMATIKAN PRODUKSI. Berkas `python_backend/.env` adalah SALINAN UTUH dari
`backend/.env`, jadi ia ikut memuat:

  • `PORT=5055`  → itu port PRODUKSI Node.js. Bila Python ikut bind ke sana,
    salah satu proses gagal start (EADDRINUSE) — dan bila Python yang menang,
    SELURUH webhook customer berhenti dibalas. Python memakai field TERPISAH
    `PYTHON_PORT` (default 5056) yang TIDAK pernah diisi dari `PORT`.
    pydantic-settings memetakan nama field ke nama env var; karena tidak ada
    field bernama `PORT`, nilai itu hanya diabaikan (`extra="ignore"`).

  • `NGROK_DOMAIN=spotter-dragging-sporting...` → domain reserved SATU-SATUNYA
    milik akun ini, terdaftar di dashboard Kirimi sebagai webhook produksi.
    Python HANYA membaca `PYTHON_NGROK_DOMAIN` (lihat app/core/ngrok_tunnel.py
    dan V8 §5 M97 — insiden nyata 15 Agu 2026: customer tidak dibalas karena
    tunnel Python merebut domain ini).

Keduanya diverifikasi lewat `tests/test_config_isolation.py` — kontrol negatif
yang GAGAL bila suatu saat seseorang "merapikan" config ini dengan menambah
field `PORT` atau `NGROK_DOMAIN`.

Nama variabel lain dipertahankan PERSIS seperti di Node.js supaya kedua berkas
tetap bisa dibandingkan baris-per-baris saat mencari desync.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# python_backend/app/config.py → naik 2 tingkat = python_backend/
PYTHON_BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = PYTHON_BACKEND_ROOT.parent
PYTHON_ENV_FILE = PYTHON_BACKEND_ROOT / ".env"
# Fallback: bila python_backend/.env belum dibuat, pakai milik Node.js supaya
# backend tetap bisa start (perilaku lama) — BUKAN crash saat boot.
NODE_ENV_FILE = PROJECT_ROOT / "backend" / ".env"
ACTIVE_ENV_FILE = PYTHON_ENV_FILE if PYTHON_ENV_FILE.exists() else NODE_ENV_FILE


class Settings(BaseSettings):
    """Nilai konfigurasi runtime.

    Semua field memakai nama env Node.js apa adanya. Default dipilih agar
    aplikasi tetap bisa start untuk pengembangan/tes walau .env belum lengkap —
    KECUALI kredensial, yang sengaja dibiarkan kosong dan divalidasi di titik
    pakai (fail-open pada gate non-kritis, sesuai prinsip proyek).
    """

    model_config = SettingsConfigDict(
        env_file=str(ACTIVE_ENV_FILE),
        env_file_encoding="utf-8",
        # ⚠️ extra="ignore" BUKAN sekadar kerapian — inilah yang membuat
        # `PORT=5055` dan `NGROK_DOMAIN` di .env DIABAIKAN dengan aman
        # (lihat docstring modul). JANGAN ubah ke "forbid".
        extra="ignore",
        case_sensitive=False,
    )

    # ── Inti ────────────────────────────────────────────────────────────────
    APP_NAME: str = "Elevan Property"
    APP_URL: str = "http://localhost"
    # ⚠️ SENGAJA `PYTHON_PORT`, BUKAN `PORT`. `.env` memuat PORT=5055 (produksi
    # Node.js) — memakainya akan membunuh webhook customer. Lihat docstring.
    PYTHON_PORT: int = 5056

    # ── Database — db_property YANG SAMA, tanpa migrasi ────────────────────
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "db_property"

    # ── Provider AI ─────────────────────────────────────────────────────────
    AI_PRIMARY_PROVIDER: str = "chatgpt"
    CHAT_GPT_API_KEY: str = ""
    CHAT_GPT_MODEL: str = "gpt-4o-mini"
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = ""
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_MODEL: str = ""
    KIMI_API_KEY: str = ""
    KIMI_MODEL: str = ""
    KIMI_BASE_URL: str = "https://api.moonshot.ai/v1"
    QWEN_API_KEY: str = ""
    QWEN_MODEL: str = ""
    QWEN_BASE_URL: str = ""

    # ── Mode chatbot ────────────────────────────────────────────────────────
    RESPOND_CATALOG_RUN: str = "OFF"
    AI_HISTORY_WINDOW: int = 60
    AI_PROMPT_DISPLAY_TURNS: int = 20
    AI_COOKIE_RESPONSE_TIMER: int = 12000

    # ── Terminal WhatsApp ───────────────────────────────────────────────────
    MESSAGE_TERMINAL: str = "KIRIMI"
    # ⚠️ EJAAN SALAH "MASSEGE" DIPERTAHANKAN DENGAN SENGAJA. Itu nama variabel
    # yang BENAR-BENAR dipakai di .env dan di Node.js (utils/terminalSwitch.js).
    # Memperbaiki ejaannya di sini akan membuat field ini tidak pernah terisi
    # dari .env — log terminal diam-diam mati. Perbaiki di KEDUA sisi sekaligus
    # atau tidak sama sekali.
    MASSEGE_TERMINAL: str = "KIRIMI"
    KIRIMI_USER_CODE: str = ""
    KIRIMI_SECRET: str = ""
    KIRIMI_API_URL: str = "https://api.kirimi.id"
    KIRIMI_SEND_FAST: str = "false"
    KIRIMI_TIMEOUT_MS: int = 30000
    KIRIMI_RETRY_COUNT: int = 3
    KIRIMI_RETRY_DELAY_MS: int = 3000
    FONNTE_TOKEN: str = ""
    FONNTE_TIMEOUT_MS: int = 30000
    FONNTE_RETRY_COUNT: int = 3
    FONNTE_RETRY_DELAY_MS: int = 3000
    AI_PRIMARY_TAG: str = ""
    ENABLE_AI_WHATSAPP: str = "true"
    # ⚠️ SAKELAR "PYTHON BOLEH MEMBALAS CUSTOMER" (M105). Default MATI.
    # Menyalakannya membuat python_backend benar-benar MENGIRIM WhatsApp ke
    # customer sungguhan. JANGAN nyalakan bersamaan dengan Node.js yang juga
    # melayani webhook yang sama — customer akan menerima DUA balasan.
    # Lihat inbound_message_service.process_inbound() untuk pengamannya.
    PYTHON_AI_REPLY_ENABLED: str = "false"

    # ── Auth (verifikasi token terbitan Node.js) ────────────────────────────
    ACCESS_TOKEN_SECRET: str = ""
    PAGINATION_ROWS: int = 10

    # ── RAG (lihat V8 §5 M92 — OFF secara default) ──────────────────────────
    RAG_ENABLED: str = "OFF"
    RAG_EMBEDDING_MODE: str = ""
    RAG_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # ── ngrok — HANYA untuk dev/uji manual Python (M97) ─────────────────────
    # ⚠️ SENGAJA TIDAK memakai NGROK_DOMAIN — variabel itu adalah domain
    # RESERVED produksi milik Node.js (terdaftar di dashboard Kirimi). Bila
    # Python memakai domain yang SAMA, dua proses akan berebut satu domain:
    # siapa pun yang start belakangan gagal terbuka, ATAU — lebih berbahaya —
    # kalau Python start duluan, tunnel produksi Node.js nanti GAGAL terbuka
    # tanpa disadari. Ini persis kelas insiden yang terjadi 15 Agu 2026 (ngrok
    # manual sempat mengarah ke python_backend yang belum punya webhook,
    # pesan customer 404 tanpa balasan). `PYTHON_NGROK_DOMAIN` terpisah —
    # kosong berarti subdomain ACAK setiap start (aman, tidak bisa bentrok).
    ENABLE_NGROK: str = "false"
    NGROK_AUTHTOKEN: str = ""
    PYTHON_NGROK_DOMAIN: str = ""
    NGROK_REGION: str = ""

    # ── Hugging Face Router (M95) ────────────────────────────────────────────
    # BUKAN vLLM self-hosted — lihat app/services/huggingface_service.py untuk
    # alasan lengkap (tidak ada GPU NVIDIA di mesin ini).
    HF_TOKEN: str = ""
    HF_MODEL: str = "openai/gpt-oss-20b:groq"
    HF_BASE_URL: str = "https://router.huggingface.co/v1"
    HF_MAX_TOKENS: int = 4096
    HF_TEMPERATURE: float = 1.0
    HF_TOP_P: float = 1.0

    @field_validator("AI_PRIMARY_PROVIDER", "MESSAGE_TERMINAL", mode="after")
    @classmethod
    def _lower_strip(cls, v: str) -> str:
        return (v or "").strip().lower()

    # ── Turunan ─────────────────────────────────────────────────────────────
    @property
    def database_url(self) -> str:
        """DSN async SQLAlchemy untuk MySQL yang sama dengan Node.js."""
        pwd = self.DB_PASSWORD
        return (
            f"mysql+aiomysql://{self.DB_USER}:{pwd}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    @property
    def catalog_run_enabled(self) -> bool:
        return (self.RESPOND_CATALOG_RUN or "").strip().upper() == "ON"

    @property
    def rag_enabled(self) -> bool:
        return (self.RAG_ENABLED or "").strip().upper() == "ON"

    @property
    def ngrok_enabled(self) -> bool:
        return (self.ENABLE_NGROK or "").strip().lower() in ("true", "on", "1")

    @property
    def python_reply_enabled(self) -> bool:
        """Boleh MENGIRIM balasan ke customer sungguhan? Default False."""
        return (self.PYTHON_AI_REPLY_ENABLED or "").strip().lower() in ("true", "on", "1")

    def terminal_active(self, name: str) -> bool:
        """Apakah terminal `name` (KIRIMI/FONNTE/TIMELINESAI) menampilkan log?

        Port `utils/terminalSwitch.js` — `MASSEGE_TERMINAL` boleh berisi
        beberapa nilai dipisah koma ("FONNTE,KIRIMI"). Kosong = semua aktif
        (fail-open: lebih baik log berlebih daripada diam total saat salah
        ketik — diamnya log terlihat seperti webhook tidak masuk sama sekali).
        """
        raw = (self.MASSEGE_TERMINAL or "").strip()
        if not raw:
            return True
        allowed = {p.strip().upper() for p in raw.split(",") if p.strip()}
        return name.strip().upper() in allowed


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Settings tunggal (cached) — dipakai lewat dependency FastAPI."""
    return Settings()
