"""Diagnóstico de fuentes de composición de ETFs (solo para desarrollo)."""
import urllib.request, http.cookiejar, json, os, sys
cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
BR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
out = []
def t(name, url, ua=BR, extra=None, n=300):
    h = {'User-Agent': ua, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9'}; h.update(extra or {})
    try:
        with op.open(urllib.request.Request(url, headers=h), timeout=40) as r:
            b = r.read(); out.append(f'OK {name} {r.status} {len(b)}B ct={r.headers.get("Content-Type")} :: {b[:n]!r}')
    except Exception as e: out.append(f'FAIL {name} :: {str(e)[:200]}')
t('sec-mf-ua1', 'https://www.sec.gov/files/company_tickers_mf.json', 'ProjectATLAS atlas-bot@users.noreply.github.com')
t('sec-mf-ua2', 'https://www.sec.gov/files/company_tickers_mf.json', 'Mozilla/5.0 (compatible; ProjectATLAS/1.0; +https://github.com/acorchete16/ProjectATLAS) atlas-bot@users.noreply.github.com')
t('sec-data', 'https://data.sec.gov/submissions/CIK0001100663.json', 'ProjectATLAS atlas-bot@users.noreply.github.com')
t('sec-efts', 'https://efts.sec.gov/LATEST/search-index?q=%22iShares%20MSCI%20World%22&forms=NPORT-P', 'ProjectATLAS atlas-bot@users.noreply.github.com')
t('ishares-page', 'https://www.ishares.com/us/products/239696/ishares-msci-world-etf')
t('ishares-ajax-after-cookie', 'https://www.ishares.com/us/products/239696/ishares-msci-world-etf/1467271812596.ajax?fileType=csv&fileName=URTH_holdings&dataType=fund', extra={'Referer': 'https://www.ishares.com/us/products/239696/ishares-msci-world-etf'})
t('vanguard-holdings', 'https://investor.vanguard.com/investment-products/etfs/profile/api/VT/portfolio-holding/stock?start=1&count=5')
t('vanguard-diversif', 'https://investor.vanguard.com/investment-products/etfs/profile/api/VT/portfolio/diversification')
t('ssga-spy', 'https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx', n=60)
t('justetf', 'https://www.justetf.com/en/etf-profile.html?isin=IE00B4L5Y983')
t('stockanalysis', 'https://stockanalysis.com/etf/urth/holdings/')
t('yahoo-holdings-page', 'https://finance.yahoo.com/quote/URTH/holdings/')
t('schwab-sec', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=S000004312&type=NPORT-P&dateb=&owner=include&count=5&output=atom', 'ProjectATLAS atlas-bot@users.noreply.github.com')
open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data', 'probe.txt'), 'w').write('\n'.join(out))
print('\n'.join(out))
