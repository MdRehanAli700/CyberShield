import hashlib
import unittest

from app.main import password_digest, password_matches, token_digest


class AuthHelperTests(unittest.TestCase):
    def test_password_digest_uses_a_fresh_salt(self):
        first = password_digest("correct horse battery staple")
        second = password_digest("correct horse battery staple")

        self.assertNotEqual(first, second)
        self.assertTrue(first.startswith("scrypt$"))

    def test_password_matches_accepts_correct_password_only(self):
        stored = password_digest("correct horse battery staple")

        self.assertTrue(password_matches("correct horse battery staple", stored))
        self.assertFalse(password_matches("different password", stored))

    def test_password_matches_rejects_malformed_or_unsupported_hashes(self):
        self.assertFalse(password_matches("password", "not-a-valid-hash"))
        self.assertFalse(password_matches("password", "md5$00$00"))
        self.assertFalse(password_matches("password", "scrypt$not-hex$00"))

    def test_token_digest_is_a_sha256_hash_of_the_token(self):
        token = "example-session-token"

        self.assertEqual(token_digest(token), hashlib.sha256(token.encode("utf-8")).hexdigest())
        self.assertEqual(len(token_digest(token)), 64)
        self.assertNotEqual(token_digest(token), token)


if __name__ == "__main__":
    unittest.main()
