import io
p='services/aiPromptBuilderService.js'
s=io.open(p,encoding='utf-8').read()
n=0
def rep(a,b):
    global s,n
    assert a in s, 'MISS: '+a[:60]
    s=s.replace(a,b,1); n+=1

# 1) district loop: reject adjectives after kawasan/area/daerah
rep("""        if (/^(lain|lainnya|sekitar|sekitarnya|mana|manapun|tertentu|itu|ini)$/i.test(cand)) continue;
        if (_isJustTheCity(cand, state.city)) continue;
        state.district = cand;   // pesan terbaru menimpa yang lama""",
"""        if (/^(lain|lainnya|sekitar|sekitarnya|mana|manapun|tertentu|itu|ini)$/i.test(cand)) continue;
        if (_isJustTheCity(cand, state.city)) continue;
        if (_isAreaQualityWord(cand)) continue;   // M186: "kawasan asri" bukan area "Asri"
        state.district = cand;   // pesan terbaru menimpa yang lama""")

# 2) asked-Q5 branch: split mixed sentence instead of dumping raw
rep("""        if (!state.preferences) state.preferences = custResp;
      } else {
        state.redFlags = custResp;
      }
    }""",
"""        if (!state.preferences) state.preferences = custResp;
      } else {
        // M186: kalimat campuran ("tdk banjir, udaranya segar, kawasan asri")
        // dipecah — Hindari hanya klausa bernegasi, sisanya jadi Prefer.
        const split = _splitAvoidAndPrefer(custResp);
        state.redFlags = split.avoid || custResp;
        if (split.prefer && !state.preferences) state.preferences = split.prefer;
      }
    }""")

# 3) volunteered red-flag branch: same split
rep("""      const avoidHits = (custResp.match(/\b(?:tidak|tdk|ga|gak|gk|nggak|ngga|enggak|jangan|hindari|anti|bukan|tanpa)\s+\S+/gi) || []).length;
      const explicitAvoid = /\b(hindari|dihindari|jangan|jauh\s+dari|anti)\b/i.test(custResp);
      if (avoidHits >= 2 || explicitAvoid) state.redFlags = custResp;""",
"""      const avoidHits = (custResp.match(/\b(?:tidak|tdk|ga|gak|gk|nggak|ngga|enggak|jangan|hindari|anti|bukan|tanpa)\s+\S+/gi) || []).length;
      const explicitAvoid = /\b(hindari|dihindari|jangan|jauh\s+dari|anti)\b/i.test(custResp);
      if (avoidHits >= 2 || explicitAvoid) {
        // M186: pisahkan keinginan dari penghindaran — "udaranya segar" bukan red flag.
        const split = _splitAvoidAndPrefer(custResp);
        state.redFlags = split.avoid || custResp;
        if (split.prefer && !state.preferences) state.preferences = split.prefer;
      }""")

io.open(p,'w',encoding='utf-8',newline='').write(s)
print('patched',n,'sites')
