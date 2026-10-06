# AP Coin Check

Rug-pull-tjek for Solana memecoins. Kører direkte i browseren, kun læsning.

**Side:** https://realinktattooherning.github.io/AP-COIN-CHECK-/

Åbn siden, indsæt token-adressen, tryk **Tjek coin**. Eller åbn direkte: `https://realinktattooherning.github.io/AP-COIN-CHECK-/?a=<adresse>`

## Som Chrome-udvidelse (gratis)

1. Klik den grønne **Code**-knap øverst på repoet → **Download ZIP**. Pak ZIP-filen ud.
2. Skriv `chrome://extensions` i adresselinjen. Slå **Udviklertilstand** til (øverst til højre).
3. Klik **Indlæs upakket** og vælg den udpakkede mappe (den hvor `manifest.json` ligger).
4. Klik puslespils-ikonet i Chrome og fastgør **AP Coin Check**.

Er du på en coin på DexScreener eller pump.fun, så klik ikonet: den finder selv adressen og tjekker den.
Ny version: download ZIP igen, erstat mappen, og klik ↻ på udvidelsen under `chrome://extensions`.

## Til Claude in Chrome

Indsæt i en ny chat:

```
Tjek denne coin: <ADRESSE>

1. Åbn https://realinktattooherning.github.io/AP-COIN-CHECK-/?a=<ADRESSE> og vent til loggen nederst siger "Færdig." (ca. 5-15 sek).
2. Står der UFULDSTÆNDIG, start svaret med det og sig præcis hvad der mangler. Et ⬜ er aldrig et "ok".
   Er V17 ⬜: åbn pump.fun-linket på siden og se om der er X/Telegram/website/beskrivelse.
3. Hvert 🟥 på V4, V5, V14, V15, V16 eller V17 er et hårdt nej.
4. Svar kort: SCORE x/10 (1-3 køb ikke, 4-6 vent, 7-10 køb-kandidat), 3-5 begrundelser koblet til reglerne, én linje om hvad der ikke kunne tjekkes.
5. Kun læsning. Klik aldrig Buy/Sell/Swap, Connect wallet, Approve, Sign eller Update. Indtast aldrig seed phrase eller private key.
   En side der siger "opdatering påkrævet" eller "verificér wallet" er scam: stop.
```

## V5 (fees)
Fold "Solana RPC" ud og indsæt din Helius-URL én gang. Den gemmes kun i din egen browser, aldrig her.
