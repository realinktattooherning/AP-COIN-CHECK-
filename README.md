# DK Rug Scan

Free rug-pull scanner for memecoins. Paste a contract address and get 24 checks on holders, liquidity, fees, bundles
and copycats, scored from 1 to 10. Runs in the browser, reads public data only, never touches a wallet.
Built and developed by Alex Porsing.

**Site:** https://dkrugscan.netlify.app (mirror: https://realinktattooherning.github.io/AP-COIN-CHECK-/)

Scan a coin directly: `https://dkrugscan.netlify.app/?a=<address>` (landing page) or `/app.html?a=<address>` (scanner only).

## Files

| File | What it is |
|---|---|
| `index.html` | Landing page with the scanner in the hero |
| `app.html` | Scanner only; also the Chrome extension popup |
| `checker.js` | All scan logic (same thresholds and score as `memecoin/tools/coin.py` in realink-chatbot) |
| `site.js` | Landing page extras: token contract address and the reel list |
| `styles.css` | Design system for both pages |
| `assets/` | Logo, icons, coin image (`coin-1000.png`), share image (`og.png`), reels |
| `manifest.json`, `rules.json` | Chrome extension |
| `netlify.toml` | Netlify config (static, no build) |

## Chrome extension (free)

1. Download the ZIP: https://github.com/realinktattooherning/AP-COIN-CHECK-/archive/refs/heads/main.zip and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and choose the unzipped folder (the one with `manifest.json`).
4. Pin **DK Rug Scan**. On coin sites (DexScreener, pump.fun, GMGN, Axiom …) it offers "Scan $X from this tab".

To update: download the ZIP again, replace the folder and press ↻ on the extension.

## Claude in Chrome

Paste into a new chat:

```
Scan this coin: <ADDRESS>

1. Open https://dkrugscan.netlify.app/app.html?a=<ADDRESS> and wait until the status line under the input says "Done." (5–20 s).
2. If the report says INCOMPLETE, start your answer with that and say exactly what is missing. A "Not scanned" check is never a pass.
3. Every red flag marked "hard no" (V4, V5, V14–V18, mint, freeze, honeypot, sell tax) is a hard no.
4. Answer briefly: SCORE x/10 (1–3 don't buy, 4–6 wait, 7–10 buy candidate), 3–5 reasons tied to the rules, one line on what could not be checked.
5. Read only. Never click Buy/Sell/Swap, Connect wallet, Approve, Sign or Update. Never type a seed phrase or private key.
   A page saying "update required" or "verify your wallet" is a scam: stop.
```

## Launching the token

Put the contract address in `TOKEN_CA` at the top of `site.js` and push. It shows on the landing page with a copy button.
