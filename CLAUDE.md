# CLAUDE.md

**Ny session? Læs `HANDOFF.md` i `realinktattooherning/realink-chatbot` (gren `claude/nice-einstein-quw63i`) først.**

**Udviklingsflow (brugerens krav):** Claude og Codex arbejder begge via GitHub på en hvilken som helst gren; se `AGENTS.md` for den fælles
arbejdsgang (hent først, push bagefter, log i HANDOFF.md, nye regler i CLAUDE.md). `main` = live hjemmeside og kilden til udvidelsens
opdateringstjek. Launch = flet ind i `main` når brugeren beder om det, og bump `version` i `manifest.json`.

Svar på dansk. Selve siden er på engelsk (brand: **DK Rug Scan**, token **$DKRUGSCAN**, bygget af Alex Porsing).
Repoet er både websiden (Netlify `dkrugscan.netlify.app` + GitHub Pages fra `main`, live ~1 min efter push) og Chrome-udvidelsen
(`manifest.json`, popup = `app.html`). `index.html` = landingsside med scanneren i heroen, `app.html` = kun scanneren.
Al scan-logik ligger i `checker.js`; adresse-finderen (side → token, bruges af popup og stream-panel) i `resolve.js`; stream-panelet (sidepanel, OCR + "find på åben fane", fra Codex 3.5) i `screen.html`/`screen.js`/`screen-core.js` + `research-*.js`, `market-context.js`, `vendor/ocr/`. Popup = scanneren først, stream-panelet åbnes med knappen "Stream mode"; landingssidens ekstra (token-CA, reels) i `site.js`; vandmand-scenen (2D-canvas, coinens DexScreener-chart bagved) i `stage.js`, som får data fra `render()` via `stageUpdate()`; design i `styles.css`.
Forsiden: vandmanden tegnes af `jelly.js` (bruges af `stage.js` og `hub.js`); `hub.js` = vandmand i toppen, den roterende fire-vejs-menu
(kort drejer ved scroll, valgt kort viser sit panel: rules / narrative / extension / finder) og live-papirhandlen.
Papirhandel: `.github/workflows/paper.yml` kører `paper/run.mjs` ca. hver 30. min på GitHub Actions (samme scanner via headless browser,
samme pool, $100/position, +100 % / −50 % / 24 t / likviditet væk) og skriver `state.json` til grenen `paper-data`
(kun seneste tilstand; den eneste gren der må force-pushes, og kun af botten). Siden læser den via raw.githubusercontent.com.
Ingen inline-scripts i HTML (udvidelser tillader dem ikke). Ny API-host → tilføj den under `host_permissions` i `manifest.json`, og bump `version`.

- Reglerne kommer fra `memecoin/rugpull-checklist.md` i `realinktattooherning/realink-chatbot`, og siden skal give
  samme resultat som `memecoin/tools/coin.py` + `deep.py` dér (samme tærskler, samme score). Ændres én, ændres begge.
  Regelnavne er på engelsk her og dansk i Python; `HARD_NO`/`TIMING` matcher på de engelske præfikser.
- Kæder: Solana (Rugcheck + pump.fun + Solana RPC) og EVM/0x (honeypot.is + GoPlus), begge med DexScreener + GeckoTerminal.
  EVM-delen findes kun her, ikke i coin.py. `SKIP` = reglen gælder ikke denne coin; tæller hverken som ok eller mangler.
- Popup'en starter aldrig selv et tjek; coinen fra den åbne fane tilbydes kun som knap.
- Et ikke-scannet tjek må aldrig vises som ok. Mangler et tjek, skal siden sige INCOMPLETE og scoren er højst 3.
- Reel-værktøjet (`alexporsing/tools/coin_reel.mjs` i realink-chatbot) læser rapporten via `#txt`, `.chk[data-rule]` og
  "Done." i `#log` — ændres markup'en, så ret værktøjet med.
- Tal på landingssiden (track record) skal komme fra `memecoin/paper/report.md` og være ærlige; ingen løfter om gevinst.
- Ingen nøgler, tokens eller wallet-data i repoet — det er offentligt.
- Wallet-sikkerhed: siden må kun læse data. Aldrig noget der forbinder, godkender eller signerer en wallet. Ingen købsknap.
