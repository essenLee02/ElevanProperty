"""Orkestrasi balasan WhatsApp: RAG → prompt → provider (M101).

Alur satu giliran:
    pesan customer
      → RAG: ambil listing NYATA milik agent ini + referensi gaya
      → prompt: identitas + aturan + konteks + riwayat
      → provider AI (primary)
      → balasan

FAIL-SAFE BERLAPIS — TIDAK ADA satu pun kegagalan yang boleh membuat customer
menerima pesan rusak atau tidak menerima apa-apa tanpa jejak:
  • RAG gagal / indeks kosong → prompt tetap dibangun tanpa blok listing
    (AI akan mengatakan akan dicek dulu, bukan mengarang).
  • Provider gagal → `AIReplyResult.ok=False` + alasan, pemanggil yang
    memutuskan (webhook Python fase ini TIDAK mengirim apa pun ke customer).

⚠️ `generate_reply()` HANYA MENYUSUN TEKS. Ia TIDAK mengirim WhatsApp dan
TIDAK menulis ke DB — itu urusan pemanggil. Pemisahan ini disengaja supaya
jalur uji (`/internal/ai-preview`) bisa memakai fungsi yang PERSIS SAMA dengan
jalur produksi nanti, tanpa risiko mengirim pesan ke customer sungguhan.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Sequence

import re

from app.config import get_settings
from app.core import qualification_state as qs
from app.core.reply_humanizer import humanize_reply, last_ai_message
from app.core.session_boundary import compute_boundary
from app.core.property_keyword_filter import (
    extract_property_type_from_message,
    extract_transaction_type_from_message,
)
from app.services import rag_service
from app.services.ai_prompt_builder import build_system_prompt, build_user_prompt
from app.services.chatgpt_service import ChatGPTError
from app.services.chatgpt_service import generate_reply as chatgpt_generate
from app.services.private_agent_service import build_private_reply
from app.services.huggingface_service import HuggingFaceProviderError, call_huggingface_chat

logger = logging.getLogger(__name__)


@dataclass
class AIReplyResult:
    ok: bool
    reply: str = ""
    provider: str = ""
    context_source: str = "none"
    error: str = ""
    catalog_hits: int = 0
    reference_hits: int = 0
    debug: dict[str, Any] = field(default_factory=dict)


def _primary_provider() -> str:
    return (get_settings().AI_PRIMARY_PROVIDER or "chatgpt").strip().lower()


# Angka + satuan Indonesia: "700 juta", "1,5 miliar", "750jt", "5 jt".
_MONEY_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(miliar|milyar|m\b|juta|jt\b|ribu|rb\b)", re.IGNORECASE
)
_UNIT_MULTIPLIER = {
    "miliar": 1_000_000_000, "milyar": 1_000_000_000, "m": 1_000_000_000,
    "juta": 1_000_000, "jt": 1_000_000,
    "ribu": 1_000, "rb": 1_000,
}


def extract_budget_range(text: str) -> tuple[float | None, float | None]:
    """Perkiraan rentang anggaran dari teks percakapan.

    Dipakai HANYA untuk MEMPERSEMPIT kandidat RAG, bukan untuk menyatakan
    fakta ke customer — jadi salah tafsir menghasilkan hasil kurang tajam,
    bukan informasi salah. Toleransi ±15% dipakai saat customer menyebut satu
    angka ("sekitar 700 juta"): batas kaku akan membuang listing Rp 699 juta
    yang jelas masih relevan.
    """
    matches = _MONEY_RE.findall(str(text or ""))
    values: list[float] = []
    for raw_num, raw_unit in matches:
        try:
            num = float(raw_num.replace(",", "."))
        except ValueError:
            continue
        mult = _UNIT_MULTIPLIER.get(raw_unit.strip().lower())
        if mult:
            values.append(num * mult)

    if not values:
        return None, None
    if len(values) == 1:
        v = values[0]
        return v * 0.85, v * 1.15
    return min(values) * 0.9, max(values) * 1.1


def detect_customer_style(message: str, history: Sequence[Any] | None = None) -> str:
    """Kondisi customer → dipakai memilih CONTOH percakapan yang sepadan (M102).

    Label mengikuti korpus `Real-Estate/*.md` yang memang sudah mengelompokkan
    case per kondisi ("Malas Ketik", "Marah", "Info Terbatas", …), jadi ini
    pencocokan ke label yang SUDAH ADA, bukan taksonomi baru yang dikarang.
    """
    text = str(message or "").strip()
    low = text.lower()

    if re.search(r"\b(kesal|capek|cape|frustrasi|marah|parah|payah|gak jelas|nggak jelas|"
                 r"kok ditanya|udah dijawab|berkali-kali)\b", low):
        return "angry"
    if re.search(r"\b(bingung|gak tau|ga tau|nggak tau|belum tau|gimana ya|bedanya apa|"
                 r"pertama kali|baru pertama)\b", low):
        return "unsure"
    # Pertanyaan harga muncul dalam BANYAK bentuk di korpus: "berapa harganya",
    # "berapa per malam", "harga ... berapa", "berapaan". Dicek sebelum "lazy"
    # supaya pertanyaan harga yang pendek tetap dikenali sebagai tanya-harga.
    if re.search(
        r"(berapa\s+(harga|harganya|sewa|sewanya|per\s+\w+|biaya|budget)"
        r"|harga\w*\s+(nya\s+)?berapa"
        r"|\bberapaan\b|kisaran harga|range harga"
        # "Harga rumah di Tangerang Selatan sekarang berapa?" — kata di antara
        # "harga" dan "berapa" bisa panjang, jadi jendelanya dilebarkan.
        r"|\b(harga|sewa|tarif)\b[^?]{0,60}\?)",
        low,
    ):
        return "asking_price"

    # "Malas ketik" = pesan sangat pendek ATAU padat singkatan/tanpa spasi rapi.
    words = [w for w in re.split(r"\s+", low) if w]
    if len(text) <= 25 or len(words) <= 4:
        return "lazy"
    if re.search(r"\b(sby|jkt|bdg|mlg|kt\b|jt\b|rb\b|thn|bln|km\b|lt\b|dkt|deket|gk|gak|dr\b)\b", low) \
            and len(words) <= 12:
        return "lazy"

    return "normal"


def _derive_filters(customer_message: str, history: Sequence[Any] | None) -> dict[str, Any]:
    """Batasan keras (tipe/transaksi/harga) dari SELURUH percakapan.

    Dibaca dari belakang ke depan: penyebutan TERBARU menang. Tipe dan budget
    biasanya disebut sekali di awal lalu keluar dari pesan-pesan berikutnya —
    membacanya hanya dari pesan terakhir membuat filter hilang justru saat
    percakapan makin dalam.
    """
    texts: list[str] = []
    for item in list(history or []):
        if isinstance(item, dict):
            role = str(item.get("role") or "")
            text = str(item.get("message") or "")
        else:
            role = str(getattr(item, "role", "") or "")
            text = str(getattr(item, "message", "") or "")
        # HANYA pesan customer — kalimat AI memuat contoh ("Contoh: 3-7 juta")
        # yang akan terbaca sebagai anggaran customer bila ikut dipindai.
        if role in ("user", "customer") and text.strip():
            texts.append(text)
    texts.append(str(customer_message or ""))

    building_type = None
    transaction_type = None
    price_min = price_max = None

    for text in reversed(texts):
        if building_type is None:
            building_type = extract_property_type_from_message(text) or None
        if transaction_type is None:
            transaction_type = extract_transaction_type_from_message(text) or None
        if price_min is None and price_max is None:
            price_min, price_max = extract_budget_range(text)
        if building_type and transaction_type and price_min is not None:
            break

    return {
        "building_type": building_type,
        # Metadata indeks menyimpan "Sale"/"Rent"; ekstraktor mengembalikan
        # "sale"/"rent". Perbandingan di rag_service sudah lowercase keduanya.
        "transaction_type": transaction_type,
        "price_min": price_min,
        "price_max": price_max,
    }


async def _call_provider(provider: str, system_prompt: str, user_prompt: str) -> str:
    if provider in ("huggingface", "hf"):
        return await call_huggingface_chat(user_prompt, system_prompt=system_prompt)
    # Default: chatgpt. Provider lain (claude/qwen/deepseek/kimi) belum diport
    # ke Python — lihat MIGRATION_PLAN.md langkah "Provider AI — 5 sisanya".
    return await chatgpt_generate(system_prompt, user_prompt)


async def generate_whatsapp_reply(
    customer_message: str,
    *,
    agent_name: str,
    agent_user_id: str,
    history: Sequence[Any] | None = None,
    customer_name: str = "",
) -> AIReplyResult:
    """Susun balasan WhatsApp untuk satu pesan customer."""
    settings = get_settings()
    msg = (customer_message or "").strip()
    if not msg:
        return AIReplyResult(ok=False, error="Pesan customer kosong")

    # ⚠️ BATAS SESI (M110) dihitung PALING AWAL, dan potongan aktifnya dipakai
    # oleh SEMUA yang membaca percakapan — kueri RAG, filter, gaya, daftar slot,
    # dan transkrip yang ditempel ke prompt. Kalau hanya sebagian yang dipotong,
    # pencarian lama tetap bocor lewat jalur yang terlewat: memotong slot saja
    # tidak menolong bila transkrip lamanya masih dikirim, karena model membaca
    # "Senayan"/"300-500 juta" di sana lalu menyalinnya kembali.
    boundary = compute_boundary(history or [], msg)
    scoped_history = list(history or [])[boundary.start:]

    catalog_block = ""
    reference_block = ""
    cases_block = ""
    catalog_hits: list[Any] = []
    reference_hits: list[Any] = []
    case_hits: list[Any] = []
    context_source = "none"
    style = detect_customer_style(msg, scoped_history)

    # ⚠️ Kueri RAG dibangun dari PERCAKAPAN, bukan hanya pesan terakhir.
    # Jawaban pendek ("Ada rekomendasi yg cocok?") tidak memuat kota/budget/
    # tipe — meng-embed-nya sendirian membuat retrieval meleset total dan AI
    # keliru menyimpulkan "tidak ada listing". Lihat build_query_text().
    rag_query = rag_service.build_query_text(msg, scoped_history)

    filters = _derive_filters(msg, scoped_history)

    if settings.rag_enabled:
        try:
            catalog_hits = await rag_service.retrieve_catalog(
                rag_query, agent_user_id, **filters,
            )
            # Filter ketat bisa menghasilkan NOL kandidat (mis. agent memang
            # tidak punya tipe itu di rentang harga itu). Coba ulang tanpa
            # batasan harga supaya AI tetap punya bahan untuk menawarkan
            # alternatif terdekat — lebih berguna daripada "tidak ada apa-apa",
            # dan AI tetap dilarang mengklaim harganya sesuai.
            if not catalog_hits and (filters.get("price_min") or filters.get("price_max")):
                relaxed = {**filters, "price_min": None, "price_max": None}
                catalog_hits = await rag_service.retrieve_catalog(
                    rag_query, agent_user_id, **relaxed,
                )
                if catalog_hits:
                    logger.info("[AI] filter harga dilonggarkan — %s kandidat alternatif",
                                len(catalog_hits))
            catalog_block = rag_service.format_catalog_for_prompt(catalog_hits)
            if catalog_block:
                context_source = "rag_catalog"
        except Exception as exc:  # noqa: BLE001
            # Fail-open: RAG TIDAK BOLEH memutus percakapan.
            logger.warning("[AI] RAG katalog gagal (%s) — lanjut tanpa blok listing", exc)

        try:
            reference_hits = await rag_service.retrieve_skill_reference(rag_query)
            reference_block = rag_service.format_reference_for_prompt(reference_hits)
            if reference_block and context_source == "none":
                context_source = "rag_reference"
            elif reference_block:
                context_source = "rag_catalog+reference"
        except Exception as exc:  # noqa: BLE001
            logger.warning("[AI] RAG referensi gagal (%s) — lanjut tanpa blok referensi", exc)

        # ── CONTOH GAYA (M102) — jawaban atas "LLM-nya kaku" ────────────────
        try:
            case_hits = await rag_service.retrieve_skill_cases(
                rag_query,
                property_type=filters.get("building_type"),
                transaction_type=filters.get("transaction_type"),
                style=style,
            )
            cases_block = rag_service.format_skill_cases_for_prompt(case_hits)
            if cases_block:
                context_source += "+cases"
        except Exception as exc:  # noqa: BLE001
            logger.warning("[AI] RAG contoh gaya gagal (%s) — lanjut tanpa contoh", exc)
    else:
        logger.info("[AI] RAG_ENABLED=OFF — balasan disusun tanpa konteks katalog")

    # ── STATUS KUALIFIKASI (M107) ───────────────────────────────────────────
    # Inilah yang menghentikan pertanyaan berulang DAN memicu ringkasan.
    # Model tidak lagi menebak dari transkrip panjang — ia diberi daftar
    # tegas slot mana ✅ terisi dan mana ❓ kosong, plus satu instruksi:
    # tanya slot berikutnya, ATAU (bila lengkap) buat ringkasan.
    state = qs.extract_state(history or [], msg)
    state_block = qs.build_state_block(state)
    directive = qs.build_directive(
        state, agent_name=agent_name, app_name=settings.APP_NAME,
        boundary=boundary,
    )
    missing = qs.missing_mandatory(state)

    system_prompt = build_system_prompt(agent_name, style=style)
    user_prompt = build_user_prompt(
        msg, history=scoped_history, catalog_block=catalog_block,
        reference_block=reference_block, cases_block=cases_block,
        customer_name=customer_name,
        state_block=state_block, directive=directive,
    )

    provider = _primary_provider()
    try:
        reply = await _call_provider(provider, system_prompt, user_prompt)
    except (ChatGPTError, HuggingFaceProviderError, Exception) as exc:  # noqa: BLE001
        # ⚠️ AGEN PRIVAT (M116). Sebelumnya kegagalan provider berarti customer
        # TIDAK MENERIMA APA PUN — terlihat nyata 17 Agu 23:18 saat kredit
        # OpenAI habis: "Saya mau beli gudang" tidak dibalas sama sekali.
        # Sekarang percakapan tetap maju tanpa API berbayar: slot berikutnya
        # tetap ditanyakan, ringkasan tetap bisa dibuat. Yang hilang hanya
        # keluwesan bahasa model, bukan layanannya.
        logger.error("[AI] provider %s gagal: %s — beralih ke agen privat", provider, exc)
        fallback = build_private_reply(
            state,
            agent_name=agent_name,
            app_name=settings.APP_NAME,
            turn=len(scoped_history),
        )
        human_fb = humanize_reply(
            fallback, agent_name=agent_name, app_name=settings.APP_NAME,
            previous_ai_message=last_ai_message(scoped_history),
        )
        if human_fb.blocked:
            # Agen privat pun tidak layak kirim — sangat tidak mungkin (tidak
            # ada placeholder di template), tapi jangan pernah kirim yang cacat.
            return AIReplyResult(ok=False, provider=provider, error=str(exc),
                                 context_source=context_source,
                                 catalog_hits=len(catalog_hits),
                                 reference_hits=len(reference_hits))
        return AIReplyResult(
            ok=True, reply=human_fb.text, provider="private_agent",
            context_source=context_source,
            catalog_hits=len(catalog_hits), reference_hits=len(reference_hits),
            debug={
                "fallback": "private_agent",
                "provider_error": str(exc),
                "phase": "summary" if not missing else "asking",
                "missing": [label for _, label in missing],
                "boundary": boundary.reason,
            },
        )

    # ── PENJAGA KELUARAN (M111) ─────────────────────────────────────────────
    # Dijalankan pada SETIAP balasan, setelah provider dan sebelum pemanggil
    # mengirimnya. Aturan prompt sudah melarang semua ini dan tetap dilanggar
    # (terbukti di 9 transkrip produksi), jadi penjaganya harus deterministik.
    human = humanize_reply(
        reply,
        agent_name=agent_name,
        app_name=settings.APP_NAME,
        previous_ai_message=last_ai_message(scoped_history),
    )
    if human.issues:
        logger.warning("[AI] balasan dibersihkan (%s)", ", ".join(human.issues))

    if human.blocked:
        # Lebih baik TIDAK mengirim daripada mengirim kerangka template atau
        # harga karangan. Pemanggil memutuskan (retry/eskalasi), sama seperti
        # kegagalan provider.
        logger.error("[AI] balasan DITOLAK sebelum dikirim: %s", ", ".join(human.issues))
        return AIReplyResult(
            ok=False, provider=provider, context_source=context_source,
            error=f"balasan tidak layak kirim: {', '.join(human.issues)}",
            catalog_hits=len(catalog_hits), reference_hits=len(reference_hits),
            debug={"humanizer_issues": list(human.issues), "raw_reply": reply},
        )

    return AIReplyResult(
        ok=True, reply=human.text, provider=provider, context_source=context_source,
        catalog_hits=len(catalog_hits), reference_hits=len(reference_hits),
        debug={
            "prompt_chars": len(user_prompt) + len(system_prompt),
            "style": style,
            "case_hits": len(case_hits),
            "slots_filled": sum(1 for v in state.as_dict().values() if v),
            "missing": [label for _, label in missing],
            "phase": "summary" if not missing else "asking",
            "humanizer_issues": list(human.issues),
            "boundary": boundary.reason,
        },
    )


__all__ = ["generate_whatsapp_reply", "AIReplyResult"]
