# ProxyFarm static dashboard

This standalone frontend recreates the ProxyFarm customer dashboard as an interactive product demo.

- Production-shaped ISP and residential proxy credentials generated locally
- Discord OAuth identity flow with the `identify` scope only
- Browser-session account state with no persistent access token
- Interactive credential rotation, proxy generation, plan selection, copy, and CSV export
- No payment collection, customer database, or connected proxy network

From this directory, run `python3 -m http.server 4173`.
