"""Regresi M109 — tunnel ngrok tahan gangguan jaringan sesaat.

KEJADIAN NYATA (16 Agu 2026 22:16:58, terminal user):
    failed to dial ngrok server with address "connect.ngrok-agent.com:443":
    dial tcp: lookup connect.ngrok-agent.com: no such host
Lalu: `Application startup complete` — backend HIDUP di :5056 TANPA tunnel,
selamanya, sampai ada manusia yang sadar dan me-restart.

DNS-nya sendiri BAIK-BAIK SAJA (diperiksa setelahnya: resolver lokal DAN
8.8.8.8 sama-sama menjawab, TCP ke 54.255.3.198:443 connect_ex=0). Jadi
gangguannya SESAAT — dan cacat yang benar-benar milik kita adalah: satu kali
gagal = tunnel mati permanen, tanpa tanda apa pun setelahnya.

Tes ini memakai pyngrok TIRUAN yang disuntik ke sys.modules — bukan menambah
fungsi khusus-tes ke implementasi. Yang diuji adalah PERILAKU start_tunnel()
apa adanya.

Run: python tests/test_ngrok_tunnel.py
"""

from __future__ import annotations

import importlib
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

pass_count = 0
fail_count = 0


def ok(label: str, cond: bool, extra: str = "") -> None:
    global pass_count, fail_count
    if cond:
        pass_count += 1
        print(f"  [OK]   {label}")
    else:
        fail_count += 1
        print(f"  [FAIL] {label} {extra}")


# Pesan galat PERSIS dari terminal user.
REAL_DNS_ERROR = (
    'The ngrok process errored on start: failed to dial ngrok server with '
    'address "connect.ngrok-agent.com:443": dial tcp: lookup '
    'connect.ngrok-agent.com: no such host.'
)


class _FakeTunnel:
    def __init__(self, url: str) -> None:
        self.public_url = url


class _FakeNgrok:
    """pyngrok tiruan: gagal N kali dulu, lalu berhasil."""

    def __init__(self, fail_times: int = 0, error: str = REAL_DNS_ERROR,
                 url: str = "http://fake-python.ngrok-free.dev") -> None:
        self.fail_times = fail_times
        self.error = error
        self.url = url
        self.attempts = 0
        self.disconnected: list[str] = []

    def connect(self, *_args, **_kwargs):
        self.attempts += 1
        if self.attempts <= self.fail_times:
            raise RuntimeError(self.error)
        return _FakeTunnel(self.url)

    def disconnect(self, url: str) -> None:
        self.disconnected.append(url)


def install_fake_pyngrok(fake: _FakeNgrok) -> None:
    """Suntik paket pyngrok tiruan ke sys.modules."""
    conf_obj = types.SimpleNamespace(auth_token=None, region=None)
    conf_mod = types.SimpleNamespace(get_default=lambda: conf_obj)
    pkg = types.ModuleType("pyngrok")
    pkg.conf = conf_mod          # type: ignore[attr-defined]
    pkg.ngrok = fake             # type: ignore[attr-defined]
    sys.modules["pyngrok"] = pkg
    sys.modules["pyngrok.conf"] = conf_mod  # type: ignore[assignment]
    sys.modules["pyngrok.ngrok"] = fake     # type: ignore[assignment]


def fresh_module(fake: _FakeNgrok):
    """pyngrok tiruan + modul tunnel yang state-nya bersih.

    Sengaja memakai importlib.reload, BUKAN fungsi reset khusus-tes di
    implementasi: kode produksi tidak boleh menumbuhkan permukaan yang hanya
    ada demi pengujian.
    """
    install_fake_pyngrok(fake)
    import app.core.ngrok_tunnel as mod
    return importlib.reload(mod)


def main() -> None:
    from app.core import ngrok_diagnostics as diag
    import app.core.ngrok_tunnel as T

    print("== Group 1: klasifikasi galat (murni, tanpa I/O) ==")
    d = diag.classify_error(REAL_DNS_ERROR)
    ok("galat DNS asli → TRANSIENT", d.kind == diag.TRANSIENT, f"{d.kind}/{d.reason}")
    ok("galat DNS diberi alasan 'dns'", d.reason == "dns", d.reason)
    ok("galat DNS punya saran perbaikan", bool(d.remedy.strip()))

    for msg, why in [
        ("ERR_NGROK_4018: authentication failed", "auth"),
        ("The authtoken you specified is invalid", "auth"),
    ]:
        c = diag.classify_error(msg)
        ok(f"auth PERMANENT ({why}): {msg[:34]}", c.kind == diag.PERMANENT, c.kind)

    for msg in [
        "ERR_NGROK_334: the domain is already in use",
        "ERR_NGROK_108: your account is limited to 1 simultaneous session",
    ]:
        c = diag.classify_error(msg)
        ok(f"konflik domain PERMANENT: {msg[:34]}", c.kind == diag.PERMANENT, c.kind)
        ok("  saran menyebut Node.js / domain",
           "domain" in c.remedy.lower() or "node" in c.remedy.lower(), c.remedy[:60])

    for msg in ["dial tcp 54.255.3.198:443: i/o timeout",
                "read: connection reset by peer",
                "failed to reconnect session"]:
        ok(f"jaringan TRANSIENT: {msg[:34]}",
           diag.classify_error(msg).kind == diag.TRANSIENT)

    # Galat tak dikenal HARUS transient: mencoba lagi itu murah, menyerah mahal.
    ok("galat tak dikenal → TRANSIENT (default aman)",
       diag.classify_error("beberapa galat yang belum pernah kita lihat").kind
       == diag.TRANSIENT)

    print("\n== Group 2: gangguan SESAAT dicoba lagi (inti bug) ==")
    fake = _FakeNgrok(fail_times=2)          # gagal 2x, lalu sukses
    T = fresh_module(fake)
    url = T.start_tunnel()
    ok("tunnel akhirnya TERBUKA walau 2x gagal", url is not None, str(url))
    ok("URL dipaksa https", (url or "").startswith("https://"), str(url))
    ok("dicoba ulang, bukan menyerah sekali", fake.attempts == 3, f"attempts={fake.attempts}")
    ok("public_url() konsisten dengan hasil", T.public_url() == url)
    ok("status: aktif", T.tunnel_status().get("active") is True, str(T.tunnel_status()))
    T.stop_tunnel()

    print("\n== Group 3: galat PERMANEN gagal cepat, TIDAK diulang ==")
    fake = _FakeNgrok(fail_times=99, error="ERR_NGROK_4018: authentication failed")
    T = fresh_module(fake)
    url = T.start_tunnel()
    ok("tidak ada tunnel", url is None, str(url))
    ok("HANYA satu percobaan (tidak buang waktu)", fake.attempts == 1,
       f"attempts={fake.attempts}")
    ok("status: tidak aktif", T.tunnel_status().get("active") is False)
    ok("status memuat alasan 'auth'", T.tunnel_status().get("reason") == "auth",
       str(T.tunnel_status()))
    ok("status TIDAK menjadwalkan percobaan ulang",
       T.tunnel_status().get("retrying") is False, str(T.tunnel_status()))
    T.stop_tunnel()

    print("\n== Group 4: transient habis jatah → sembuh sendiri di latar ==")
    fake = _FakeNgrok(fail_times=99)          # DNS terus gagal
    T = fresh_module(fake)
    url = T.start_tunnel()
    ok("startup tidak diblokir (kembali None)", url is None, str(url))
    ok("mencoba sebanyak jatah startup", fake.attempts == T.STARTUP_ATTEMPTS,
       f"attempts={fake.attempts} vs {T.STARTUP_ATTEMPTS}")
    st = T.tunnel_status()
    ok("status: tidak aktif", st.get("active") is False)
    ok("status: MASIH akan mencoba lagi (self-heal)", st.get("retrying") is True, str(st))
    ok("alasan tercatat 'dns'", st.get("reason") == "dns", str(st))
    T.stop_tunnel()
    ok("stop_tunnel menghentikan penjadwalan ulang",
       T.tunnel_status().get("retrying") is False, str(T.tunnel_status()))

    print("\n== Group 5: kegagalan ngrok TIDAK BOLEH menjatuhkan backend ==")
    fake = _FakeNgrok(fail_times=99, error="ledakan tak terduga")
    T = fresh_module(fake)
    raised = None
    try:
        T.start_tunnel()
    except Exception as exc:  # noqa: BLE001
        raised = exc
    ok("start_tunnel tidak melempar exception", raised is None, repr(raised))
    T.stop_tunnel()

    print("\n== Group 6: gerbang konfigurasi (perilaku lama dipertahankan) ==")
    from app.config import get_settings
    s = get_settings()

    fake = _FakeNgrok()
    T = fresh_module(fake)
    orig_enabled = s.ENABLE_NGROK
    try:
        s.ENABLE_NGROK = False
        ok("ENABLE_NGROK=false → tidak ada percobaan", T.start_tunnel() is None)
        ok("  benar-benar 0 panggilan connect", fake.attempts == 0, str(fake.attempts))
    finally:
        s.ENABLE_NGROK = orig_enabled

    fake = _FakeNgrok()
    T = fresh_module(fake)
    orig_token = s.NGROK_AUTHTOKEN
    try:
        s.NGROK_AUTHTOKEN = ""
        ok("authtoken kosong → tidak ada percobaan", T.start_tunnel() is None)
        ok("  benar-benar 0 panggilan connect", fake.attempts == 0, str(fake.attempts))
        ok("  alasan tercatat 'no_authtoken'",
           T.tunnel_status().get("reason") == "no_authtoken", str(T.tunnel_status()))
    finally:
        s.NGROK_AUTHTOKEN = orig_token
    T.stop_tunnel()

    print("\n== Group 7: preflight NYATA terhadap jaringan sekarang ==")
    pf = diag.preflight()
    ok("preflight melaporkan host", pf.get("host") == "connect.ngrok-agent.com", str(pf))
    ok("preflight melaporkan ipv4 (bool)", isinstance(pf.get("ipv4_ok"), bool), str(pf))
    ok("preflight melaporkan ipv6 (bool)", isinstance(pf.get("ipv6_ok"), bool), str(pf))
    ok("preflight tidak melempar & punya ringkasan", bool(pf.get("summary")), str(pf))
    print(f"       (jaringan saat ini: {pf.get('summary')})")

    sys.modules.pop("pyngrok", None)
    sys.modules.pop("pyngrok.conf", None)
    sys.modules.pop("pyngrok.ngrok", None)

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()
