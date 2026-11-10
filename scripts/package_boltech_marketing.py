"""Package the existing Pages runtime plus the positioning assets. No deploy."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[1]
output = root / 'ops-output' / 'Boltech_Mercadeo_CTA_Cloudflare.zip'
output.parent.mkdir(parents=True, exist_ok=True)
files = {
    '_worker.js': root / 'cloudflare' / 'leo-marketing-worker.mjs',
    'index.html': root / 'index.html',
    'sales-agent.html': root / 'sales-agent.html',
    'por-que-boltech.html': root / 'por-que-boltech.html',
}
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, path in files.items():
        archive.writestr(name, path.read_bytes())
    archive.writestr('_routes.json', json.dumps({'version': 1, 'include': ['/*'], 'exclude': []}))
print(output)
