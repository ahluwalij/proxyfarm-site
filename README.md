# ProxyFarm customer portal

This standalone frontend provides the ProxyFarm sign-in and credential workspace.

- Standard-format ISP and residential proxy credentials generated on demand
- Discord OAuth identity flow with the `identify` scope only
- Browser-session account state with no persistent access token
- Working credential refresh, proxy generation, plan requests, copy, and CSV export
- Plan and booster requests open as pre-addressed support emails
- No card details are requested or stored by the portal

From this directory, run `python3 -m http.server 4173`.
