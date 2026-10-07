"""Diagnóstico de fuentes de composición de ETFs (solo para desarrollo)."""
import urllib.request, http.cookiejar, os, re
cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
BR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
out = []
def get(url):
    with op.open(urllib.request.Request(url, headers={'User-Agent': BR, 'Accept-Language': 'en-US,en;q=0.9'}), timeout=40) as r: return r.read().decode('utf-8', 'replace')
h = get('https://www.justetf.com/en/etf-profile.html?isin=IE00B4L5Y983')
for kw in ['Countries', 'Sectors', 'Top 10 Holdings', 'Holdings', 'as of']:
    for m in list(re.finditer(kw, h))[:2]:
        out.append(f'--- {kw} @{m.start()}:\n' + re.sub(r'\s+', ' ', h[m.start()-200:m.start()+2200]))
s = get('https://stockanalysis.com/etf/urth/holdings/')
i = s.find('NVDA'); out.append('--- stockanalysis NVDA ctx: ' + re.sub(r'\s+', ' ', s[max(0, i-1500):i+1500]))
out.append('--- stockanalysis count of "%" : ' + str(s.count('%')))
open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data', 'probe.txt'), 'w').write('\n'.join(out))
