# Codex' lokale arbejde — 10. oktober 2026

Dette er en overdragelse til sammenlægning, ikke en erstatning af den nuværende 3.6-scanner.
Grenen `codex-local` er oprettet oven på den aktuelle `main`. Filerne i repo-roden er bevaret.
Ingen force-push; radar, vandmand, V21–V26 og adressefinder må ikke fjernes.

## Start her

1. Læs `HANDOFF.md` i `realink-chatbot` og `memecoin/codex-local/HANDOFF.md` på det repos `codex-local`.
2. Behold den aktuelle scanner som første visning. Integrér `stream-3.5/` som ekstra knap/fane:
   skærmbillede, lokal OCR, tokenvalg, adresse først, markedstal og risikoanalyse.
3. Brug den eksisterende `pageCandidates()`/`resolveCandidates()` ved samling af adressefinderen.
4. Sammenlæg regler efter funktion og testdata, ikke kun V-nummer: Codex' og Claudes V21/V22-numre er forskellige.
5. Kør kontrol- og paritetstest på den samlede kode før udgivelse. Denne snapshot-gren ændrer ikke produktionssiden.

## Indhold

- `stream-3.5/`: hele den testede lokale udvidelse inkl. OCR-assets, profiler, rapporter og kildebaseret research.
- `legacy-2.4/`: den oprindelige lokale rettelse af LP-status og flow-observationer til sammenligning.
- `source-manifest.json`: SHA256 for de oprindelige filer.

3.5 har samme scam-score som 3.4. De nye researchfunktioner er rådgivning:
en præcis, eksternt rapporteret creator-liste; same-pool pullback med manuelt dokumenteret narrativ;
og aktuel markedskontekst med både positive og negative/manglende sammenligninger.
Listen er ikke 25 bekræftede rugs. Videoernes 100x-/gevinstpåstande er ikke valideret.
X/TikTok-opslag overvåges ikke automatisk. Ingen wallet, signering eller handler.

## Vigtige forskelle som skal bevares under integration

- LP-status skal knyttes til valgt pool; nul likviditet må ikke blive grøn pga. `lpLockedPct=100`.
- En anden pools pris må ikke sammenkædes automatisk med entry-prisen.
- Creator-historik/roundtrips er i Codex-varianten info, ikke automatisk scam.
- `risk-profiles.js` adskiller brugerens researchprofil fra sikkerhedstjek; lempet profil må ikke skjule hårde risici.
- `market-context.js` og `research-core.js` har parrede Python-funktioner og kontroltests i det private repo.
- Den lokale 3.5-udvidelse er en separat udviklingslinje; det lavere versionsnummer gør den ikke til en komplet erstatning for 3.6.

Udvidelsen blev ikke installeret automatisk. Den eksisterende Netlify-side blev ikke deployet i denne overdragelse.
