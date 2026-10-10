# AGENTS.md

Regler for Codex (og andre agenter) i dette repo. **Læs `CLAUDE.md` — alle regler dér gælder også for dig.**

## Fælles arbejdsgang for Claude og Codex (brugerens krav)

GitHub er det eneste fælles sted. Lokale sessioner og cloud-sessioner, Claude og Codex arbejder alle via GitHub, så alle kan læse hinandens ændringer og regler.

1. **Før du starter:** `git fetch --all` og læs de nyeste commits på `main` og på den gren, du arbejder på. Læs `CLAUDE.md` (projektregler, gælder også for Codex) og `HANDOFF.md` i `realinktattooherning/realink-chatbot` (status, åbne opgaver, log).
2. **Byg på en hvilken som helst gren** (`dev`, `codex-local`, `claude/…`, `codex/…`). Hent den nyeste `main` ind først.
3. **Når du er færdig:** commit og push. Skriv én linje i loggen nederst i `HANDOFF.md` (dato, hvem: Claude/Codex, gren, hvad, hvorfor).
   Ny regel eller ændret regel → skriv den i `CLAUDE.md` (eller `memecoin/rugpull-checklist.md` for coin-regler), så den anden AI også følger den.
4. **Aldrig force-push, aldrig overskrive den andens arbejde.** Ved konflikt: behold begge funktioner, spørg brugeren hvis de modsiger hinanden.
5. **Launch** = flet grenen ind i `main` i AP-COIN-CHECK-, når brugeren beder om det. Bump `version` i `manifest.json`, så installerede udvidelser viser "Update available".
6. Ingen nøgler, cookies, wallet-data eller rådata i git (rådata = release-filer, se `memecoin/data/MANIFEST.md`).
