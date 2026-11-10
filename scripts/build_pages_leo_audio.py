"""Build the narrowly scoped Pages Direct Upload audio patch (stdlib only)."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
output = root / '.cloudflare' / 'pages-leo-audio.zip'
output.parent.mkdir(exist_ok=True)
files = {
    '_worker.js': (root / 'cloudflare/pages-leo-audio-worker.mjs').read_bytes(),
    'sales-agent.html': (root / 'sales-agent.html').read_bytes(),
    '_routes.json': json.dumps({'version': 1, 'include': ['/*'], 'exclude': []}).encode(),
}
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, content in files.items():
        archive.writestr(name, content)
with zipfile.ZipFile(output) as archive:
    assert set(archive.namelist()) == set(files)
    assert archive.testzip() is None
print(json.dumps({'archive': str(output), 'files': list(files),
                  'leo_sha256': hashlib.sha256(files['sales-agent.html']).hexdigest()}))
