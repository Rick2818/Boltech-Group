import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

SPEC = importlib.util.spec_from_file_location('private_checks', Path(__file__).resolve().parents[1] / 'scripts/check_leo_private_connections.py')
checks = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checks)
TOKEN = 'qa-only-private-owner-token-00000'


class PrivateConnectionChecks(unittest.TestCase):
    def test_missing_token_never_calls_network(self):
        for token in ['', 'short', TOKEN + '\n']:
            result = checks.check_connections(token, lambda *args: self.fail('network must not run'))
            self.assertFalse(result['tokenConfigured'])
            self.assertFalse(result['allConnected'])
            self.assertTrue(all(r['status'] == 'NOT_CHECKED' for r in result['results']))

    def test_all_connections_are_checked_despite_provider_failure(self):
        seen = []
        def requester(platform, token):
            seen.append(platform)
            self.assertEqual(token, TOKEN)
            if platform == 'upwork':
                raise RuntimeError(TOKEN)
            if platform == 'explee':
                return 502, {'error': 'PROVIDER_HTTP_403', 'providerReason': 'ACCESS_DENIED_UNCLASSIFIED', 'private': TOKEN}
            return 200, {'success': True, 'platform': platform, 'status': 'CONNECTED', 'mode': 'READ_ONLY', 'account': TOKEN}
        result = checks.check_connections(TOKEN, requester)
        self.assertEqual(seen, list(checks.PLATFORMS))
        self.assertFalse(result['allConnected'])
        self.assertTrue(result['results'][1]['connected'])
        self.assertEqual(result['results'][2]['error'], 'PROVIDER_HTTP_403')
        self.assertNotIn(TOKEN, json.dumps(result))

    def test_only_verified_account_responses_pass(self):
        good = {'success': True, 'platform': 'upwork', 'status': 'CONNECTED', 'mode': 'READ_ONLY'}
        self.assertTrue(checks.safe_result('upwork', 200, good)['connected'])
        for status, data in [(401, good), (302, good), (200, {}), (200, []),
                             (200, {**good, 'success': False}), (200, {**good, 'platform': 'freelancer'}),
                             (200, {**good, 'mode': 'WRITE_ENABLED'})]:
            self.assertFalse(checks.safe_result('upwork', status, data)['connected'])

    def test_unknown_text_and_extra_fields_never_enter_reports(self):
        result = checks.safe_result('explee', 403, {'error': 'Bearer ' + TOKEN, 'providerReason': TOKEN, 'account': TOKEN})
        self.assertEqual(result['error'], 'PRIVATE_API_HTTP_403')
        self.assertNotIn(TOKEN, json.dumps(result))
        self.assertFalse(result['searchVerified'])
        self.assertFalse(result['autonomyVerified'])
        uppercase_secret = 'PRIVATE_UPPERCASE_QA_TOKEN_00000'
        result = checks.safe_result('explee', 403, {'error': uppercase_secret, 'providerReason': [uppercase_secret]})
        self.assertNotIn(uppercase_secret, json.dumps(result))

    def test_transport_fixes_destination_method_and_read_only_operation(self):
        class Response(io.BytesIO):
            status = 200
        class Opener:
            def open(inner, request, timeout):
                self.assertEqual(request.full_url, checks.ENDPOINT)
                self.assertEqual(request.get_method(), 'POST')
                self.assertEqual(json.loads(request.data), {'action': 'check', 'platform': 'freelancer'})
                self.assertEqual(request.get_header('Authorization'), 'Bearer ' + TOKEN)
                self.assertEqual(timeout, 35)
                return Response(b'{"success":true}')
        with patch.object(checks.urllib.request, 'build_opener', return_value=Opener()) as builder:
            self.assertEqual(checks.api_check('freelancer', TOKEN), (200, {'success': True}))
            self.assertIsInstance(builder.call_args.args[0], checks.NoRedirect)
        self.assertIsNone(checks.NoRedirect().redirect_request(None, None, None, None, None, None))

    def test_rejected_redirect_and_invalid_large_bodies_do_not_leak(self):
        class Response(io.BytesIO):
            status = 200
        for body, expected in [(b'private raw body', 'PRIVATE_API_RESPONSE_INVALID'), (b'x' * 65537, 'PRIVATE_API_RESPONSE_TOO_LARGE')]:
            opener = type('Opener', (), {'open': lambda *args, **kwargs: Response(body)})()
            with patch.object(checks.urllib.request, 'build_opener', return_value=opener):
                self.assertEqual(checks.api_check('explee', TOKEN)[1]['error'], expected)
        error = urllib.error.HTTPError(checks.ENDPOINT, 302, 'private', {}, io.BytesIO(b'private body'))
        with patch.object(checks.urllib.request, 'build_opener') as builder:
            builder.return_value.open.side_effect = error
            status, data = checks.api_check('explee', TOKEN)
            self.assertEqual(status, 302)
            self.assertNotIn('private', json.dumps(data))

    def test_account_check_reports_only_allowlisted_search_readiness(self):
        good = {'success': True, 'platform': 'explee', 'status': 'CONNECTED', 'mode': 'READ_ONLY', 'accountCheck': 'GET_ME', 'searchReadiness': 'POSITIVE_BALANCE_REQUIRED', 'organization': TOKEN}
        result = checks.safe_result('explee', 200, good)
        self.assertEqual(result['accountCheck'], 'GET_ME')
        self.assertEqual(result['searchReadiness'], 'POSITIVE_BALANCE_REQUIRED')
        self.assertFalse(result['searchVerified'])
        self.assertNotIn(TOKEN, json.dumps(result))
        for value in [TOKEN, [], None]:
            result = checks.safe_result('explee', 200, {**good, 'searchReadiness': value})
            self.assertNotIn('searchReadiness', result)

    def test_schema_diagnostic_keeps_only_fixed_type_labels(self):
        data = {'error': 'PROVIDER_RESPONSE_INVALID', 'providerReason': 'ACCOUNT_SCHEMA_MISMATCH', 'providerHttpStatus': 200, 'accountShape': {'organizationId': 'number', 'balance': 'object', 'key': TOKEN, TOKEN: TOKEN, 'jsonContentType': True}}
        result = checks.safe_result('explee', 502, data)
        self.assertEqual(result['providerHttpStatus'], 200)
        self.assertEqual(result['accountShape'], {'organizationId': 'number', 'balance': 'object', 'jsonContentType': True})
        self.assertNotIn(TOKEN, json.dumps(result))

    def test_connected_account_with_unreported_balance_does_not_certify_search(self):
        result = checks.safe_result('explee', 200, {'success': True, 'platform': 'explee', 'status': 'CONNECTED', 'mode': 'READ_ONLY', 'accountCheck': 'GET_ME', 'searchReadiness': 'BALANCE_NOT_REPORTED'})
        self.assertTrue(result['connected'])
        self.assertEqual(result['searchReadiness'], 'BALANCE_NOT_REPORTED')
        self.assertFalse(result['searchVerified'])
        self.assertFalse(result['autonomyVerified'])

    def test_written_summary_contains_only_sanitized_statuses(self):
        result = checks.check_connections('', lambda *args: self.fail('network'))
        with tempfile.TemporaryDirectory() as directory:
            checks.write_report(result, Path(directory))
            self.assertEqual(json.loads((Path(directory) / 'report.json').read_text()), result)
            summary = (Path(directory) / 'summary.md').read_text()
            self.assertIn('NOT_CHECKED', summary)
            self.assertIn('No certifica', summary)


if __name__ == '__main__':
    unittest.main()
