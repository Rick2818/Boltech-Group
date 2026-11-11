"""Deploy checks for the original corporate Pages project; never prints credentials."""
import hashlib
import json
import os
from pathlib import Path
import re
import runpy
import sys
import time
import urllib.error
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ACCOUNT = 'f8c7c411bffaade3f6f0af4384db42e0'
PROJECT = 'boltech-group'
ORIGIN = 'https://boltech-group.pages.dev'
FILES = {'_worker.js', '_routes.json', 'sales-agent.html'}


def build():
    runpy.run_path(str(ROOT / 'scripts/build_pages_leo_audio.py'))
    output = ROOT / '.cloudflare/pages-release'
    output.mkdir(parents=True, exist_ok=True)
    if any(p.name not in FILES or not p.is_file() for p in output.iterdir()):
        raise RuntimeError('Unexpected release output; refusing to upload unrelated files')
    with zipfile.ZipFile(ROOT / '.cloudflare/pages-leo-audio.zip') as archive:
        if len(archive.namelist()) != 3 or set(archive.namelist()) != FILES or archive.testzip():
            raise RuntimeError('Invalid Pages archive')
        for name in FILES:
            (output / name).write_bytes(archive.read(name))
    worker = (output / '_worker.js').read_text()
    if re.search(r'^import\s', worker, re.M):
        raise RuntimeError('Pages Worker has unresolved module imports')
    if 'e912df66.boltech-group.pages.dev' not in worker or '__Host-leo_owner' not in worker:
        raise RuntimeError('Missing gateway or owner session')
    html = (output / 'sales-agent.html').read_text()
    scripts = re.findall(r'<script\b[^>]*>(.*?)</script>', html, re.S)
    if len(scripts) != 1 or 'owner-session-status' not in html:
        raise RuntimeError('Unexpected Leo UI release')
    (ROOT / '.cloudflare/pages-release-check.js').write_text(scripts[0])
    print('Prepared three public Pages assets; no secrets or repository files included')


def target():
    token = os.environ.get('CLOUDFLARE_API_TOKEN', '').strip()
    if not token:
        raise RuntimeError('Missing GitHub Actions secret CLOUDFLARE_API_TOKEN')
    url = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/pages/projects/{PROJECT}'
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
    # Cloudflare's fixed HTTPS endpoint must not redirect a credential to another host.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
            data = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'Cloudflare project authorization failed (HTTP {error.code}); check Pages Edit permission and account scope') from None
    except (urllib.error.URLError, ValueError):
        raise RuntimeError('Could not verify the Cloudflare project') from None
    result = data.get('result') or {}
    if data.get('success') is not True or result.get('name') != PROJECT or result.get('production_branch') != 'main':
        raise RuntimeError('Target project or production branch differs; deployment blocked')
    print('Verified existing corporate Pages project boltech-group, production branch main')


def verify():
    expected = hashlib.sha256((ROOT / 'sales-agent.html').read_bytes()).digest()
    for attempt in range(6):
        try:
            with urllib.request.urlopen(ORIGIN + '/sales-agent', timeout=15) as response:
                correct = hashlib.sha256(response.read()).digest() == expected
            with urllib.request.urlopen(ORIGIN + '/api/leo-owner-session', timeout=15) as response:
                state = json.load(response)
            if correct and state.get('success') is True and state.get('authenticated') is False:
                print('Verified production HTML matches this commit and owner-session endpoint is live')
                return
        except (urllib.error.URLError, ValueError):
            pass
        if attempt < 5:
            time.sleep(5)
    raise RuntimeError('Production verification failed; inspect deployment before retrying')


if __name__ == '__main__':
    try:
        {'build': build, 'target': target, 'verify': verify}[sys.argv[1]]()
    except (RuntimeError, KeyError, IndexError) as error:
        print(str(error) if isinstance(error, RuntimeError) else 'Use: pages_ci.py build|target|verify', file=sys.stderr)
        sys.exit(1)
