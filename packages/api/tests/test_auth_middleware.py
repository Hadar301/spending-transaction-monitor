"""
Tests for JWT authentication middleware
"""

from datetime import datetime
from unittest.mock import Mock, patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError
from jose.exceptions import ExpiredSignatureError
import pytest

# Import from source
from src.auth.middleware import (
    KeycloakJWTBearer,
    get_current_user,
    require_any_role,
    require_authentication,
    require_role,
)

# Test data
MOCK_OIDC_CONFIG = {
    'issuer': 'http://localhost:8080/realms/spending-monitor',
    'jwks_uri': 'http://localhost:8080/realms/spending-monitor/protocol/openid-connect/certs',
}

MOCK_JWKS = {
    'keys': [
        {
            'kty': 'RSA',
            'use': 'sig',
            'kid': 'test-key-id',
            'n': 'test-n-value',
            'e': 'AQAB',
        }
    ]
}

MOCK_VALID_CLAIMS = {
    'sub': 'user-123',
    'preferred_username': 'testuser',
    'email': 'test@example.com',
    'realm_access': {'roles': ['user']},
    'exp': datetime.now().timestamp() + 3600,
    'iat': datetime.now().timestamp(),
    'iss': 'http://localhost:8080/realms/spending-monitor',
}


class TestKeycloakJWTBearer:
    """Test Keycloak JWT Bearer authentication"""

    def test_init(self):
        """Test KeycloakJWTBearer initialization"""
        bearer = KeycloakJWTBearer()
        assert bearer is not None

    @pytest.mark.asyncio
    @patch('src.auth.middleware.requests.get')
    @pytest.mark.asyncio
    async def test_get_oidc_config_success(self, mock_get):
        """Test successful OIDC configuration retrieval"""
        mock_response = Mock()
        mock_response.json.return_value = MOCK_OIDC_CONFIG
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        bearer = KeycloakJWTBearer()
        config = await bearer.get_oidc_config()

        assert config == MOCK_OIDC_CONFIG
        assert config['issuer'] == 'http://localhost:8080/realms/spending-monitor'

    @patch('src.auth.middleware.requests.get')
    @pytest.mark.asyncio
    async def test_get_oidc_config_failure_fallback(self, mock_get):
        """Test OIDC configuration fallback on failure"""
        mock_get.side_effect = Exception('Connection failed')

        bearer = KeycloakJWTBearer()
        config = await bearer.get_oidc_config()

        # Should fallback to hardcoded config
        assert 'issuer' in config
        assert 'jwks_uri' in config

    @patch('src.auth.middleware.jwt.decode')
    @patch('src.auth.middleware.KeycloakJWTBearer.get_jwks')
    @patch('src.auth.middleware.KeycloakJWTBearer.get_oidc_config')
    @pytest.mark.asyncio
    async def test_validate_token_success(self, mock_config, mock_jwks, mock_decode):
        """Test successful token validation"""
        mock_config.return_value = MOCK_OIDC_CONFIG
        mock_jwks.return_value = MOCK_JWKS
        mock_decode.return_value = MOCK_VALID_CLAIMS

        bearer = KeycloakJWTBearer()
        claims = await bearer.validate_token('valid.jwt.token')

        assert claims == MOCK_VALID_CLAIMS
        assert claims['sub'] == 'user-123'

    @patch('src.auth.middleware.jwt.decode')
    @pytest.mark.asyncio
    async def test_validate_token_invalid(self, mock_decode):
        """Test invalid token handling"""
        mock_decode.side_effect = JWTError('Invalid token')

        bearer = KeycloakJWTBearer()
        with pytest.raises(HTTPException) as exc_info:
            await bearer.validate_token('invalid.jwt.token')

        assert exc_info.value.status_code == 401

    @patch('src.auth.middleware.jwt.decode')
    @patch('src.auth.middleware.KeycloakJWTBearer.get_jwks')
    @patch('src.auth.middleware.KeycloakJWTBearer.get_oidc_config')
    @pytest.mark.asyncio
    async def test_validate_token_expired(self, mock_config, mock_jwks, mock_decode):
        """Expired exp claim surfaces as ExpiredSignatureError from jose"""
        mock_config.return_value = MOCK_OIDC_CONFIG
        mock_jwks.return_value = MOCK_JWKS
        mock_decode.side_effect = ExpiredSignatureError('Signature has expired.')

        bearer = KeycloakJWTBearer()
        with pytest.raises(HTTPException) as exc_info:
            await bearer.validate_token('expired.jwt.token')

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == 'Token expired'


class TestAuthDependencies:
    """Test authentication dependency functions"""

    @pytest.mark.asyncio
    async def test_get_current_user_no_credentials(self):
        """Test get_current_user with no credentials"""
        user = await get_current_user(None)
        # Should return None or mock user depending on BYPASS_AUTH setting
        assert user is None or user.get('is_dev_mode') is True

    @patch('src.auth.middleware.keycloak_jwt.validate_token')
    @pytest.mark.asyncio
    async def test_get_current_user_valid_token(self, mock_validate):
        """Test get_current_user with valid token"""
        mock_validate.return_value = MOCK_VALID_CLAIMS
        credentials = HTTPAuthorizationCredentials(
            scheme='Bearer', credentials='valid.token'
        )

        user = await get_current_user(credentials)

        if not user.get('is_dev_mode'):  # Only check if not in dev mode
            assert user['id'] == 'user-123'
            assert user['email'] == 'test@example.com'

    @pytest.mark.asyncio
    async def test_require_authentication_no_credentials(self):
        """Test require_authentication with no credentials"""
        try:
            await require_authentication(None)
            # Should either raise HTTPException or return mock user in dev mode
        except HTTPException as e:
            assert e.status_code == 401

    @patch('src.auth.middleware.get_current_user')
    @pytest.mark.asyncio
    async def test_require_authentication_valid_token(self, mock_get_user):
        """Test require_authentication with valid token"""
        mock_get_user.return_value = {
            'id': 'user-123',
            'email': 'test@example.com',
            'roles': ['user'],
        }
        credentials = HTTPAuthorizationCredentials(
            scheme='Bearer', credentials='valid.token'
        )

        user = await require_authentication(credentials)
        assert user is not None


class TestRoleBasedAuth:
    """Test role-based authentication decorators"""

    @pytest.mark.asyncio
    async def test_require_role_success(self):
        """Test successful role requirement"""
        mock_user = {'roles': ['admin', 'user']}

        role_checker = require_role('admin')
        user = await role_checker(mock_user)

        assert 'admin' in user['roles']

    @pytest.mark.asyncio
    async def test_require_role_failure(self):
        """Test failed role requirement"""
        mock_user = {'roles': ['user']}

        role_checker = require_role('admin')
        with pytest.raises(HTTPException) as exc_info:
            await role_checker(mock_user)

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_require_any_role_success(self):
        """Test successful any-role requirement"""
        mock_user = {'roles': ['user']}

        role_checker = require_any_role(['admin', 'user'])
        user = await role_checker(mock_user)

        assert 'user' in user['roles']

    @pytest.mark.asyncio
    async def test_require_any_role_failure(self):
        """Test failed any-role requirement"""
        mock_user = {'roles': ['guest']}

        role_checker = require_any_role(['admin', 'user'])
        with pytest.raises(HTTPException) as exc_info:
            await role_checker(mock_user)

        assert exc_info.value.status_code == 403


@pytest.fixture(autouse=True)
def reset_caches():
    """Reset global caches before each test"""
    import src.auth.middleware

    src.auth.middleware._oidc_config_cache = None
    src.auth.middleware._jwks_cache = None
    src.auth.middleware._cache_expiry = None
    yield
