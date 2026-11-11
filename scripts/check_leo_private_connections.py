"""Check existing production connections; emit allowlisted status fields only."""
import datetime
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

ENDPOINT = 'https://boltech-group.pages.dev/api/leo-integrations'
PLATFORMS = ('upwork', 'freelancer', 'explee')
OUTPUT = Path('ops-output/leo-private-connections')
REASONS = {'EDGE_ACCESS_DENIED', 'API_KEY_REJECTED', 'ACCESS_DENIED_UNCLASSIFIED'}
ERRORS = {
    'DIAGNOSTIC_TOKEN_MISSING', 'OWNER_ACCESS_REQUIRED', 'OWNER_ACCESS_NOT_CONFIGURED',
    'ORIGIN_NOT_ALLOWED', 'PROVIDER_SECRET_MISSING', 'FREELANCER_API_DISABLED',
    'PROVIDER_REJECTED', 'PROVIDER_RESPONSE_INVALID', 'INTEGRATION_REQUEST_FAILED',
    'UPWORK_AUTHORIZATION_REQUIRED', 'UPWORK_REAUTHORIZATION_REQUIRED',
    'UPWORK_AUTH_STORAGE_MISSING', 'UPWORK_OWNER_KEY_MISSING',
    'UPWORK_CLIENT_REGISTRATION_REQUIRED', 'UPWORK_CLIENT_REGISTRATION_INVALID',
    'UPWORK_CONNECT_RESPONSE_INVALID', 'UPWORK_MCP_RESPONSE_INVALID',
    'UPWORK_MCP_REJECTED', 'UPWORK_MCP_PROTOCOL_UNSUPPORTED', 'UPWORK_TOOL_REJECTED',
    'UPWORK_TOOL_RESPONSE_INVALID', 'UPWORK_SEARCH_RESPONSE_INVALID', 'UPWORK_RESPONSE_TOO_LARGE',
    'PRIVATE_API_UNAVAILABLE', 'PRIVATE_API_RESPONSE_INVALID', 'PRIVATE_API_RESPONSE_TOO_LARGE',
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def api_check(platform, token):
    request = urllib.request.Request(ENDPOINT,
        data=json.dumps({'action': 'check', 'platform': platform}).encode(),
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json',
                 'Accept': 'application/json', 'User-Agent': 'Boltech-Private-Connection-Check/1.0'},
        method='POST')
    opener = urllib.request.build_opener(NoRedirect())
    try:
        response = opener.open(request, timeout=35)
    except urllib.error.HTTPError as error:
        response = error
    except Exception:
        # Exception text can include request details. Never print or retain it.
        return 0, {'error': 'PRIVATE_API_UNAVAILABLE'}
    try:
        with response:
            raw = response.read(65537)
            if len(raw) > 65536:
                return response.status, {'error': 'PRIVATE_API_RESPONSE_TOO_LARGE'}
            try:
                data = json.loads(raw)
            except (ValueError, UnicodeError):
                data = {'error': 'PRIVATE_API_RESPONSE_INVALID'}
            return response.status, data
    except Exception:
        return 0, {'error': 'PRIVATE_API_UNAVAILABLE'}


def safe_result(platform, status, data):
    row = {'platform': platform, 'checkedAt': now(), 'connected': False,
           'status': 'FAILED', 'httpStatus': status, 'scope': 'ACCOUNT_READ_ONLY',
           'searchVerified': False, 'autonomyVerified': False}
    if not isinstance(data, dict):
        data = {'error': 'PRIVATE_API_RESPONSE_INVALID'}
    if (200 <= status < 300 and data.get('success') is True
            and data.get('platform') == platform and data.get('status') == 'CONNECTED'
            and data.get('mode') == 'READ_ONLY'):
        row.update(connected=True, status='CONNECTED')
        return row
    code = data.get('error')
    # Never put untrusted/provider text, tokens, account names or identifiers in logs.
    if not isinstance(code, str) or not (code in ERRORS or re.fullmatch(r'(PROVIDER|UPWORK_TOKEN|UPWORK_MCP)_HTTP_[1-5][0-9]{2}', code)):
        code = 'PRIVATE_API_HTTP_' + str(status) if status and not 200 <= status < 300 else 'PRIVATE_API_RESPONSE_INVALID'
    row['error'] = code
    if isinstance(data.get('providerReason'), str) and data['providerReason'] in REASONS:
        row['providerReason'] = data['providerReason']
    return row


def check_connections(token, requester=api_check):
    # No request is made when the Actions secret is absent or malformed.
    valid = isinstance(token, str) and len(token) >= 24 and not any(c in token for c in '\r\n')
    report = {'schemaVersion': 1, 'checkedAt': now(), 'tokenConfigured': bool(valid),
              'mode': 'PRIVATE_READ_ONLY', 'externalActions': [], 'results': []}
    for platform in PLATFORMS:
        if not valid:
            row = safe_result(platform, 0, {'error': 'DIAGNOSTIC_TOKEN_MISSING'})
            row['status'] = 'NOT_CHECKED'
        else:
            try:
                status, data = requester(platform, token)
                row = safe_result(platform, status, data)
            except Exception:
                row = safe_result(platform, 0, {'error': 'PRIVATE_API_UNAVAILABLE'})
        report['results'].append(row)
    report['allConnected'] = all(row['connected'] for row in report['results'])
    return report


def write_report(report, output=OUTPUT):
    output.mkdir(parents=True, exist_ok=True)
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    lines = ['## Leo: comprobación privada', '',
             '| Plataforma | Estado | HTTP | Error |', '|---|---|---:|---|']
    for row in report['results']:
        error = row.get('error', '')
        if row.get('providerReason'):
            error += ' / ' + row['providerReason']
        lines.append(f"| {row['platform']} | {row['status']} | {row['httpStatus']} | {error} |")
    lines += ['', 'Alcance: autenticación y consulta de cuenta. No certifica búsqueda de proyectos, operación 24/7 ni ventas.',
              'Sin postulaciones, mensajes, campañas ni compra de créditos.', '']
    (output / 'summary.md').write_text('\n'.join(lines))


if __name__ == '__main__':
    result = check_connections(os.environ.get('LEO_PLATFORM_TOKEN', ''))
    write_report(result)
    print(json.dumps(result))
    sys.exit(0 if result['allConnected'] else 1)
