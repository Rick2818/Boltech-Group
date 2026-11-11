"""Build the narrowly scoped Pages Direct Upload audio patch (stdlib only)."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
output = root / '.cloudflare' / 'pages-leo-audio.zip'
output.parent.mkdir(exist_ok=True)
worker = (root / 'cloudflare/pages-leo-audio-worker.mjs').read_text()
owner = (root / 'cloudflare/leo-owner-session.mjs').read_text().replace('export ', '')
worker = worker.replace("import {handleOwnerSession, ownerRequest, withoutOwnerCookie} from './leo-owner-session.mjs';", owner)
validator = (root / 'lib/customer_onboarding.js').read_text().replace('export ', '')
setup = (root / 'cloudflare/customer-setup.mjs').read_text().replace("import {validateCustomerOnboarding} from '../lib/customer_onboarding.js';", validator).replace('export ', '')
worker = worker.replace("import {handleCustomerSetup} from './customer-setup.mjs';", setup)
setup_html = (root / 'cloudflare/customer-setup.template.html').read_text().replace('__CUSTOMER_ONBOARDING_VALIDATOR__', validator)
files = {
    '_worker.js': worker.encode(),
    'sales-agent.html': (root / 'sales-agent.html').read_bytes(),
    'customer-setup.html': setup_html.encode(),
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
