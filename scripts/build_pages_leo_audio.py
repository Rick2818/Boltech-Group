"""Build the narrowly scoped Pages Direct Upload audio patch (stdlib only)."""
from pathlib import Path
import hashlib
import json
import zipfile
import runpy

root = Path(__file__).resolve().parent.parent
output = root / '.cloudflare' / 'pages-leo-audio.zip'
output.parent.mkdir(exist_ok=True)
worker = (root / 'cloudflare/pages-leo-audio-worker.mjs').read_text()
owner = (root / 'cloudflare/leo-owner-session.mjs').read_text().replace('export ', '')
worker = worker.replace("import {handleOwnerSession, ownerRequest, withoutOwnerCookie} from './leo-owner-session.mjs';", owner)
validator = (root / 'lib/customer_onboarding.js').read_text().replace('export ', '')
setup = (root / 'cloudflare/customer-setup.mjs').read_text().replace("import {validateCustomerOnboarding} from '../lib/customer_onboarding.js';", validator).replace('export ', '')
worker = worker.replace("import {handleCustomerSetup} from './customer-setup.mjs';", setup)
commerce = (root / 'cloudflare/leo-commerce.mjs').read_text().replace('export ', '')
worker = worker.replace("import {handleLeoCommerce} from './leo-commerce.mjs';", commerce)
public_intake = (root / 'cloudflare/leo-public-intake.mjs').read_text().replace('export ', '')
worker = worker.replace("import {handleLeoPublicIntake} from './leo-public-intake.mjs';", public_intake)
executor = (root / 'cloudflare/leo-commercial-executor.mjs').read_text().replace('export ', '')
worker = worker.replace("import {handleLeoExecution,commercialExecutionPlan} from './leo-commercial-executor.mjs';", executor)
provider_diagnostics = (root / 'cloudflare/leo-provider-diagnostics.mjs').read_text().replace('export ', '')
worker = worker.replace("import {expleeAccountCheck} from './leo-provider-diagnostics.mjs';", provider_diagnostics)
setup_html = (root / 'cloudflare/customer-setup.template.html').read_text().replace('__CUSTOMER_ONBOARDING_VALIDATOR__', validator)
render_manual = runpy.run_path(str(root / 'scripts/render_user_manual.py'))['render_manual']
manual_html = render_manual((root / 'docs/Manual_de_usuario.md').read_text())
files = {
    '_worker.js': worker.encode(),
    'sales-agent.html': (root / 'sales-agent.html').read_bytes(),
    'customer-setup.html': setup_html.encode(),
    'manual-usuario.html': manual_html.encode(),
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
