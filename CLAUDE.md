# CLAUDE.md

Svar på dansk. `index.html` er brugerens coin-tjekker, hostet på GitHub Pages fra `main`. Push til `main` = live efter ~1 min.

- Reglerne kommer fra `memecoin/rugpull-checklist.md` i `realinktattooherning/realink-chatbot`, og `index.html` skal give
  samme resultat som `memecoin/tools/coin.py` + `deep.py` dér (samme tærskler, samme score). Ændres én, ændres begge.
- Et ⬜ (ikke scannet) må aldrig vises som ok. Mangler et tjek, skal siden sige UFULDSTÆNDIG.
- Ingen nøgler, tokens eller wallet-data i repoet — det er offentligt.
- Wallet-sikkerhed: siden må kun læse data. Aldrig noget der forbinder, godkender eller signerer en wallet.
