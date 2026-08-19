"""
app/core/ngrok_tunnel.py — tunnel publik untuk pengembangan/uji manual Python.

Adaptasi dari Integra_Assistance/backend/app/core/ngrok_tunnel.py (M97,
15 Agu 2026), dipicu oleh permintaan: "NGROK belum jalan di terminal. Buat
jalan di terminal saat run python."

⚠️ TUNNEL INI MENYENTUH TRAFIK PRODUKSI. Sejak M105/M106 Python punya
`/api/kirimi/webhook`, `/api/fonnte/webhook`, DAN `POST /`, dan dengan
PYTHON_AI_REPLY_ENABLED=true ia benar-benar MEMBALAS customer. (Docstring ini
dulu menyatakan sebaliknya — "belum punya webhook, POST akan 404" — dan
catatan usang itu membuat tunnel ini terkesan tidak berbahaya. Tidak lagi.)

⚠️⚠️ SATU DOMAIN UNTUK SELURUH AKUN (diverifikasi langsung 15 Agu 2026, diuji
3× terpisah: ngrok CLI, ngrokService.js, dan pyngrok TANPA domain — ketiganya
mendarat di hostname yang PERSIS SAMA). Jadi mengosongkan
`PYTHON_NGROK_DOMAIN` TIDAK memberi subdomain acak yang aman: ia memakai
satu-satunya domain akun ini, yaitu domain produksi Node.js yang terdaftar di
dashboard Kirimi. Akibatnya tunnel Python dan tunnel produksi TIDAK BISA hidup
bersamaan — yang start belakangan merebut domain dari yang duluan. JANGAN
jalankan dengan ENABLE_NGROK=true saat Node.js sedang melayani customer.
Solusi permanen (di luar cakupan kode ini): paket ngrok berbayar, atau akun
terpisah untuk Python. Karena itu modul ini memakai `PYTHON_NGROK_DOMAIN`,
bukan `NGROK_DOMAIN` milik produksi (M94).

KEGAGALAN NGROK TIDAK BOLEH MENGGAGALKAN BACKEND — server tetap harus bisa
menjawab di localhost walau tunnel gagal terbuka.

⚠️ TAHAN GANGGUAN SESAAT (M109, 16 Agu 2026). Versi sebelumnya mencoba PERSIS
SEKALI saat startup. Malam itu DNS ngadat beberapa detik:
    lookup connect.ngrok-agent.com: no such host
dan itu cukup untuk mematikan tunnel SELAMA SELURUH UMUR PROSES — sementara
uvicorn tetap mengumumkan "Application startup complete" dan port 5056 tetap
terbuka. Backend terlihat sehat padahal tak satu pun webhook bisa sampai.
DNS-nya pulih sendiri; yang tidak pulih adalah kode ini.

Sekarang galat dipilah dulu (ngrok_diagnostics): yang SESAAT dicoba lagi dengan
jeda menaik lalu diteruskan thread latar sampai berhasil — sembuh tanpa
restart; yang PERMANEN (token salah, domain bentrok) berhenti setelah SATU
percobaan dengan pesan cara memperbaikinya, karena mengulang tidak akan
mengubah hasilnya.
"""

from __future__ import annotations

import logging
import socket
import threading

from app.config import get_settings
from app.core.ngrok_diagnostics import PERMANENT, classify_error, preflight

logger = logging.getLogger(__name__)

# Jatah percobaan saat startup. Sengaja kecil: boot tidak boleh tertahan lama —
# sisa usahanya diserahkan ke thread latar yang tidak menghalangi siapa pun.
STARTUP_ATTEMPTS = 3
STARTUP_BACKOFF = (2.0, 5.0)     # jeda setelah percobaan ke-1 dan ke-2
RETRY_INTERVAL = 60.0            # jeda percobaan di latar

_public_url: str | None = None
_status_reason: str | None = None
_status_detail: str = ""
_retry_thread: threading.Thread | None = None
_stop_retry = threading.Event()

# Port default Node.js (backend/.env PORT). Dicek langsung, bukan diasumsikan
# dari config — Python TIDAK membaca PORT Node.js dari Settings ini.
_NODE_PORT = 5055


def public_url() -> str | None:
    """URL publik aktif, atau None bila ngrok tidak dipakai/gagal."""
    return _public_url


def tunnel_status() -> dict:
    """Keadaan tunnel apa adanya — dipakai /health.

    "Application startup complete" TIDAK berarti backend bisa dihubungi dari
    luar. Selisih itu harus bisa dilihat tanpa menggulir log terminal.
    """
    return {
        "active": _public_url is not None,
        "url": _public_url,
        "reason": _status_reason,
        "detail": _status_detail,
        "retrying": bool(_retry_thread and _retry_thread.is_alive()),
    }


def _node_backend_is_running() -> bool:
    """True bila sesuatu sedang mendengarkan di port Node.js (5055)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex(("127.0.0.1", _NODE_PORT)) == 0


def start_tunnel() -> str | None:
    """Buka tunnel ngrok ke PYTHON_PORT bila ENABLE_NGROK=true. Dipanggil sekali di lifespan startup."""
    global _public_url, _status_reason, _status_detail

    settings = get_settings()

    if not settings.ngrok_enabled:
        _status_reason = "disabled"
        _status_detail = "ENABLE_NGROK=false"
        logger.info("[NGROK] ENABLE_NGROK=false — tunnel Python tidak dibuka")
        return None

    # ⚠️ Python SENGAJA TIDAK diblokir oleh status Node.js (diminta eksplisit
    # 15 Agu 2026 — "Python harus berdiri sendiri, dilarang bergantung pada
    # Node.js"). Peringatan tetap dicetak karena kendalanya NYATA dan
    # terverifikasi (satu domain per akun, bukan asumsi) — tapi keputusan
    # untuk lanjut ada di tangan yang menjalankan, bukan diblokir kode.
    if not (settings.PYTHON_NGROK_DOMAIN or "").strip() and _node_backend_is_running():
        logger.warning(
            "[NGROK] ⚠️  Node.js terdeteksi hidup di port %s DAN "
            "PYTHON_NGROK_DOMAIN kosong. Akun ngrok ini hanya punya SATU "
            "domain reserved (diverifikasi langsung, lihat docstring modul "
            "ini) — tunnel Python berikut akan MEREBUT domain itu dari "
            "Node.js, dan webhook produksi Kirimi akan berhenti menerima "
            "pesan customer sampai tunnel ini ditutup. Lanjut karena diminta "
            "eksplisit; TIDAK diblokir otomatis.",
            _NODE_PORT,
        )

    try:
        from pyngrok import conf, ngrok  # noqa: F401  (dicek di sini, dipakai di _open_tunnel)
    except ImportError:
        _status_reason = "pyngrok_missing"
        _status_detail = "paket pyngrok belum terpasang"
        logger.error(
            "[NGROK] ENABLE_NGROK=true tapi paket 'pyngrok' belum terpasang. "
            "Jalankan: .venv\\Scripts\\python.exe -m pip install pyngrok"
        )
        return None

    authtoken = (settings.NGROK_AUTHTOKEN or "").strip()
    if not authtoken:
        _status_reason = "no_authtoken"
        _status_detail = "NGROK_AUTHTOKEN kosong"
        logger.error(
            "[NGROK] ENABLE_NGROK=true tapi NGROK_AUTHTOKEN kosong di backend/.env — "
            "ngrok v3 menolak membuka tunnel tanpa ini."
        )
        return None

    return _attempt_with_retry(attempts=STARTUP_ATTEMPTS, allow_background=True)


def _open_tunnel() -> str:
    """SATU percobaan membuka tunnel. Melempar bila gagal — pemanggil yang memilah."""
    global _public_url

    from pyngrok import conf, ngrok

    settings = get_settings()

    conf.get_default().auth_token = (settings.NGROK_AUTHTOKEN or "").strip()
    region = (settings.NGROK_REGION or "").strip()
    if region:
        conf.get_default().region = region

    connect_kwargs: dict = {}
    domain = (settings.PYTHON_NGROK_DOMAIN or "").strip()
    if domain:
        connect_kwargs["domain"] = domain

    tunnel = ngrok.connect(settings.PYTHON_PORT, "http", **connect_kwargs)
    _public_url = tunnel.public_url.replace("http://", "https://", 1)
    _log_active_banner(domain=domain, settings=settings)
    return _public_url


def _log_active_banner(*, domain: str, settings) -> None:
    logger.info("=" * 70)
    logger.info("[NGROK] Tunnel Python (DEV/UJI) aktif: %s", _public_url)
    if not domain:
        logger.warning(
            "[NGROK] ⚠️  Akun ngrok ini HANYA punya SATU domain statis (bukan "
            "satu per tunnel, diverifikasi M97) — URL di atas KEMUNGKINAN BESAR "
            "sama persis dengan domain produksi Node.js yang terdaftar di "
            "dashboard Kirimi, BUKAN URL acak/terpisah."
        )
    # Banner WAJIB mencerminkan keadaan SEBENARNYA. Versi lama selalu
    # berkata "TIDAK membalas" — setelah M105 itu bisa jadi bohong, dan
    # banner yang berbohong lebih berbahaya daripada tidak ada banner.
    if settings.python_reply_enabled:
        logger.info("[NGROK] ✅ MODE: PYTHON MEMBALAS CUSTOMER (PYTHON_AI_REPLY_ENABLED=true)")
        logger.info("[NGROK] Pesan yang masuk lewat URL ini akan DIJAWAB oleh Python.")
        logger.info("[NGROK] ⚠️  PASTIKAN Node.js TIDAK ikut melayani webhook yang sama,")
        logger.info("[NGROK]     kalau tidak customer menerima DUA balasan.")
    else:
        logger.info("[NGROK] ⏸️  MODE: OBSERVASI (PYTHON_AI_REPLY_ENABLED=false)")
        logger.info("[NGROK] Pesan diterima, disimpan, dan balasannya disusun +")
        logger.info("[NGROK] ditampilkan di terminal — TAPI TIDAK dikirim ke customer.")
        logger.info("[NGROK] ⚠️  Bila URL ini domain produksi DAN Node.js mati, pesan")
        logger.info("[NGROK]     customer TIDAK akan pernah dibalas siapa pun.")
    logger.info("=" * 70)


def _attempt_with_retry(*, attempts: int, allow_background: bool) -> str | None:
    """Coba buka tunnel; ulangi hanya untuk galat SESAAT.

    Mengembalikan URL bila berhasil, None bila tidak. TIDAK PERNAH melempar —
    backend harus tetap melayani localhost apa pun yang terjadi pada tunnel.
    """
    global _public_url, _status_reason, _status_detail

    for i in range(1, max(1, attempts) + 1):
        try:
            url = _open_tunnel()
            _status_reason = None
            _status_detail = ""
            return url
        except Exception as exc:  # noqa: BLE001
            _public_url = None
            diag = classify_error(exc)
            _status_reason, _status_detail = diag.reason, str(exc)

            if diag.kind == PERMANENT:
                # Mengulang tidak akan mengubah hasilnya — yang dibutuhkan
                # manusia adalah tahu APA yang harus dibetulkan.
                logger.error("[NGROK] ❌ gagal permanen (%s): %s", diag.reason, exc)
                logger.error("[NGROK] 👉 %s", diag.remedy)
                return None

            logger.warning("[NGROK] percobaan %s/%s gagal (%s): %s",
                           i, attempts, diag.reason, exc)
            if i < attempts:
                delay = STARTUP_BACKOFF[min(i - 1, len(STARTUP_BACKOFF) - 1)]
                if _stop_retry.wait(delay):
                    return None

    _log_degraded_banner()
    if allow_background:
        _start_background_retry()
    return None


def _log_degraded_banner() -> None:
    """Tanpa tunnel, backend TERLIHAT sehat padahal tak terjangkau. Katakan itu."""
    net = preflight()
    logger.error("=" * 70)
    logger.error("[NGROK] ❌ TUNNEL TIDAK AKTIF — backend hanya bisa diakses via localhost.")
    logger.error("[NGROK]    Webhook Kirimi/Fonnte TIDAK AKAN sampai ke Python.")
    logger.error("[NGROK]    Penyebab terakhir: %s", _status_detail or _status_reason)
    logger.error("[NGROK]    Jaringan ke %s: %s", net["host"], net["summary"])
    logger.error("=" * 70)


def _start_background_retry() -> None:
    """Terus coba di latar sampai tunnel terbuka — tanpa restart backend."""
    global _retry_thread

    if _retry_thread and _retry_thread.is_alive():
        return

    def loop() -> None:
        while not _stop_retry.wait(RETRY_INTERVAL):
            if _public_url is not None:
                return
            logger.info("[NGROK] mencoba membuka tunnel lagi...")
            if _attempt_with_retry(attempts=1, allow_background=False):
                logger.info("[NGROK] ✅ tunnel pulih sendiri tanpa restart.")
                return

    _stop_retry.clear()
    _retry_thread = threading.Thread(target=loop, name="ngrok-retry", daemon=True)
    _retry_thread.start()
    logger.info("[NGROK] 🔁 akan mencoba lagi otomatis tiap %.0f detik.", RETRY_INTERVAL)


def stop_tunnel() -> None:
    """Tutup tunnel saat aplikasi berhenti (dan hentikan percobaan di latar)."""
    global _public_url, _retry_thread

    # Dihentikan LEBIH DULU: thread latar yang masih hidup bisa membuka tunnel
    # baru tepat setelah kita menutup yang lama.
    _stop_retry.set()
    if _retry_thread and _retry_thread.is_alive():
        _retry_thread.join(timeout=2.0)
    _retry_thread = None

    if _public_url is None:
        return
    try:
        from pyngrok import ngrok

        ngrok.disconnect(_public_url.replace("https://", "http://", 1))
    except Exception as exc:  # noqa: BLE001
        logger.warning("[NGROK] gagal menutup tunnel Python dengan bersih: %s", exc)
    finally:
        _public_url = None
