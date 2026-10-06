# CLAUDE.md

Svar på dansk. Repoet er både websiden (GitHub Pages fra `main`, live ~1 min efter push) og Chrome-udvidelsen
(`manifest.json`, popup = `index.html`). Al logik ligger i `checker.js`. Ingen inline-scripts i `index.html` (udvidelser tillader dem ikke).
Ny API-host → tilføj den under `host_permissions` i `manifest.json`, og bump `version`.

- Reglerne kommer fra `memecoin/rugpull-checklist.md` i `realinktattooherning/realink-chatbot`, og `index.html` skal give
  samme resultat som `memecoin/tools/coin.py` + `deep.py` dér (samme tærskler, samme score). Ændres én, ændres begge.
- Kæder: Solana (Rugcheck + pump.fun + Solana RPC) og EVM/0x (honeypot.is + GoPlus), begge med DexScreener + GeckoTerminal.
  EVM-delen findes kun her, ikke i coin.py. `➖` (SKIP) = reglen gælder ikke denne coin; tæller hverken som ok eller mangler.
- Popup'en starter aldrig selv et tjek; coinen fra den åbne fane tilbydes kun som knap.
- Et ⬜ (ikke scannet) må aldrig vises som ok. Mangler et tjek, skal siden sige UFULDSTÆNDIG.
- Ingen nøgler, tokens eller wallet-data i repoet — det er offentligt.
- Wallet-sikkerhed: siden må kun læse data. Aldrig noget der forbinder, godkender eller signerer en wallet.
