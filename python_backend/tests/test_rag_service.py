"""Regresi M101 — RAG hibrida + ISOLASI ANTAR-AGENT.

⚠️ Group 2 adalah TES KEAMANAN, bukan tes fitur. Namespace `agent_catalog`
memuat listing 6 agent berbeda dalam satu indeks. Bila filter `user_id`
rusak/dihapus, agent A akan merekomendasikan properti milik agent B kepada
customernya — kebocoran data lintas-tenant yang TIDAK terlihat sebagai error,
hanya sebagai "rekomendasi yang agak aneh".

Run: python tests/test_rag_service.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import rag_service as rag  # noqa: E402

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


def agents_in_index() -> dict[str, int]:
    ns = rag._store()[rag.NS_CATALOG]
    counts: dict[str, int] = {}
    for e in ns.entries:
        uid = str((e.get("metadata") or {}).get("user_id") or "").strip()
        if uid:
            counts[uid] = counts.get(uid, 0) + 1
    return counts


async def main() -> None:
    print("== Group 1: indeks termuat ==")
    st = rag.stats()
    cat = st["namespaces"].get(rag.NS_CATALOG, {})
    ok("namespace agent_catalog termuat", cat.get("chunks", 0) > 0, str(cat))
    ok("vektor termuat (bukan hanya teks)", cat.get("vectors_loaded") is True)
    ok("model = text-embedding-3-small (sama dgn Node.js)",
       cat.get("model") == "text-embedding-3-small", str(cat.get("model")))

    counts = agents_in_index()
    ok("indeks memuat >1 agent (isolasi jadi bermakna)", len(counts) > 1, str(counts))

    print("\n== Group 2: ISOLASI ANTAR-AGENT (KEAMANAN) ==")
    uids = sorted(counts, key=lambda u: counts[u], reverse=True)
    agent_a, agent_b = uids[0], uids[1]

    hits_a = await rag.retrieve_catalog("rumah di Surabaya", agent_a, top_k=8)
    ok(f"agent A ({agent_a}) dapat hasil", len(hits_a) > 0, f"{len(hits_a)} hit")
    leaked_a = [h for h in hits_a
                if str((h.metadata or {}).get("user_id") or "").strip() != agent_a]
    ok("SEMUA hasil agent A milik agent A (0 bocor)", not leaked_a,
       f"{len(leaked_a)} listing bocor dari agent lain")

    hits_b = await rag.retrieve_catalog("rumah di Surabaya", agent_b, top_k=8)
    leaked_b = [h for h in hits_b
                if str((h.metadata or {}).get("user_id") or "").strip() != agent_b]
    ok("SEMUA hasil agent B milik agent B (0 bocor)", not leaked_b,
       f"{len(leaked_b)} listing bocor dari agent lain")

    ids_a = {(h.metadata or {}).get("property_id") for h in hits_a}
    ids_b = {(h.metadata or {}).get("property_id") for h in hits_b}
    ok("KONTROL: hasil A dan B benar-benar BERBEDA (bukan filter kosong)",
       bool(ids_a) and bool(ids_b) and ids_a != ids_b)

    print("\n== Group 3: FAIL-CLOSED tanpa agent_user_id ==")
    for bad in ("", "   ", None):
        hits = await rag.retrieve_catalog("rumah di Surabaya", bad)  # type: ignore[arg-type]
        ok(f"agent_user_id={bad!r} → KOSONG (fail-closed)", hits == [])

    agent_ghost = await rag.retrieve_catalog("rumah", "AGENT-TIDAK-ADA-999", top_k=5)
    ok("agent tidak dikenal → kosong", agent_ghost == [])

    print("\n== Group 4: kualitas hasil (hibrida) ==")
    hits = await rag.retrieve_catalog("apartemen Surabaya 2 kamar", agent_a, top_k=3)
    ok("kueri spesifik mengembalikan hasil", len(hits) > 0)
    if hits:
        ok("skor terurut menurun", all(hits[i].score >= hits[i + 1].score for i in range(len(hits) - 1)))
        ok("skor leksikal ikut berkontribusi (BM25 hidup)",
           any(h.lexical_score > 0 for h in hits))
        ok("semua skor >= MIN_SCORE", all(h.score >= rag.MIN_SCORE for h in hits))

    print("\n== Group 5: format prompt aman ==")
    block = rag.format_catalog_for_prompt(hits)
    ok("blok katalog memuat larangan mengarang", "JANGAN mengarang" in block, block[:80])
    ok("blok kosong bila tidak ada hasil", rag.format_catalog_for_prompt([]) == "")
    ok("blok referensi kosong bila tidak ada hasil", rag.format_reference_for_prompt([]) == "")

    print("\n== Group 6: kueri kosong tidak meledak ==")
    ok("kueri kosong → kosong", await rag.retrieve_catalog("", agent_a) == [])
    ok("kueri spasi → kosong", await rag.retrieve_catalog("   ", agent_a) == [])

    print(f"\n{'=' * 60}")
    print(f"RESULT: {pass_count}/{pass_count + fail_count} passed"
          f"{' (' + str(fail_count) + ' FAILED)' if fail_count else ' ALL PASS'}")
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())
