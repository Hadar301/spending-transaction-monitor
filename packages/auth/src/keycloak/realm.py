"""Keycloak realm management operations."""

import os
import time

from .client import KeycloakClient

# Default OIDC access token TTL for the app realm (Keycloak: Realm settings → Tokens).
# Longer values mean the browser/client refreshes tokens less often.
_DEFAULT_ACCESS_TOKEN_LIFESPAN_SECONDS = 8 * 60 * 60  # 8 hours


class RealmManager(KeycloakClient):
    """Manages Keycloak realm creation and configuration."""

    def __init__(self):
        super().__init__()
        self.client_id = os.getenv('KEYCLOAK_CLIENT_ID', 'spending-monitor')

    def _get_redirect_uris(self) -> list[str]:
        """Get redirect URIs from environment or use defaults."""
        env_uris = os.getenv('KEYCLOAK_REDIRECT_URIS', '')

        if env_uris:
            return [uri.strip() for uri in env_uris.split(',')]
        return ['http://localhost:3000/*']

    def _get_web_origins(self) -> list[str]:
        """Get web origins from environment or use defaults."""
        env_origins = os.getenv('KEYCLOAK_WEB_ORIGINS', '')
        if env_origins:
            return [origin.strip() for origin in env_origins.split(',')]
        return ['http://localhost:3000']

    def create_realm(self) -> bool:
        """Create a new realm for the spending-monitor application."""
        try:
            realm_data = {
                'realm': self.app_realm,
                'enabled': True,
                'displayName': 'Spending Monitor',
                'displayNameHtml': '<div class="kc-logo-text"><span>Spending Monitor</span></div>',
                'accessTokenLifespan': _DEFAULT_ACCESS_TOKEN_LIFESPAN_SECONDS,
            }

            response = self.post('/admin/realms', json=realm_data)

            if response.status_code == 201:
                self.log(f"✅ Realm '{self.app_realm}' created successfully")
                return True
            elif response.status_code == 409:
                self.log(f"ℹ️  Realm '{self.app_realm}' already exists")
                return True
            else:
                self.log(f'❌ Failed to create realm: {response.status_code}')
                return False

        except Exception as e:
            self.log(f'❌ Error creating realm: {e}', 'ERROR')
            return False

    def configure_realm_access_token_lifespan(self) -> bool:
        """Set realm OIDC access token TTL (new and existing realms)."""
        try:
            ttl = _DEFAULT_ACCESS_TOKEN_LIFESPAN_SECONDS
            response = self.get(f'/admin/realms/{self.app_realm}')
            if response.status_code != 200:
                self.log(
                    f'❌ Failed to fetch realm for token settings: {response.status_code}',
                    'ERROR',
                )
                return False

            realm = response.json()
            realm['accessTokenLifespan'] = ttl
            response = self.put(
                f'/admin/realms/{self.app_realm}',
                json=realm,
            )
            if response.status_code in (200, 204):
                self.log(f'✅ Access token lifespan set to {ttl}s ({ttl // 3600}h)')
                return True

            self.log(
                f'❌ Failed to update realm token settings: {response.status_code}',
                'ERROR',
            )
            return False

        except Exception as e:
            self.log(f'❌ Error updating realm token settings: {e}', 'ERROR')
            return False

    def create_client(self) -> bool:
        """Create or update the spending-monitor client in the realm."""
        try:
            # Check if client already exists
            response = self.get(f'/admin/realms/{self.app_realm}/clients')

            if response.status_code != 200:
                self.log(f'❌ Failed to get clients: {response.status_code}')
                return False

            existing_client = None
            for client in response.json():
                if client.get('clientId') == self.client_id:
                    existing_client = client
                    break

            client_data = {
                'clientId': self.client_id,
                'name': 'Spending Monitor Frontend',
                'description': 'Frontend application for spending transaction monitoring',
                'enabled': True,
                'publicClient': True,
                'standardFlowEnabled': True,
                'directAccessGrantsEnabled': True,
                'serviceAccountsEnabled': False,
                'implicitFlowEnabled': False,
                'redirectUris': self._get_redirect_uris(),
                'webOrigins': self._get_web_origins(),
                'attributes': {'pkce.code.challenge.method': 'S256'},
            }

            if existing_client:
                # Update existing client
                client_uuid = existing_client['id']
                update_data = {**existing_client, **client_data}
                response = self.put(
                    f'/admin/realms/{self.app_realm}/clients/{client_uuid}',
                    json=update_data,
                )

                if response.status_code == 204:
                    self.log("✅ Client 'spending-monitor' updated successfully")
                    self.log(f'   • Redirect URIs: {client_data["redirectUris"]}')
                    self.log(f'   • Web Origins: {client_data["webOrigins"]}')
                    return True
            else:
                # Create new client
                response = self.post(
                    f'/admin/realms/{self.app_realm}/clients', json=client_data
                )

                if response.status_code == 201:
                    self.log("✅ Client 'spending-monitor' created successfully")
                    self.log(f'   • Redirect URIs: {client_data["redirectUris"]}')
                    self.log(f'   • Web Origins: {client_data["webOrigins"]}')
                    return True

            self.log(f'❌ Failed to create/update client: {response.status_code}')
            return False

        except Exception as e:
            self.log(f'❌ Error creating client: {e}', 'ERROR')
            return False

    def create_roles(self) -> bool:
        """Create realm roles."""
        roles = ['user', 'admin']

        for role_name in roles:
            try:
                role_data = {
                    'name': role_name,
                    'description': f'{role_name.capitalize()} role for spending monitor',
                }

                response = self.post(
                    f'/admin/realms/{self.app_realm}/roles', json=role_data
                )

                if response.status_code == 201:
                    self.log(f"✅ Role '{role_name}' created successfully")
                elif response.status_code == 409:
                    self.log(f"ℹ️  Role '{role_name}' already exists")
                else:
                    self.log(
                        f"❌ Failed to create role '{role_name}': {response.status_code}"
                    )
                    return False

            except Exception as e:
                self.log(f"❌ Error creating role '{role_name}': {e}", 'ERROR')
                return False

        return True

    def setup(self) -> bool:
        """Complete realm setup."""
        self.log('🚀 Starting Keycloak realm setup for spending-monitor')
        self.log('=' * 50)

        if not self.get_admin_token():
            return False

        if not self.create_realm():
            return False

        time.sleep(1)  # Brief pause for realm to be ready

        if not self.configure_realm_access_token_lifespan():
            return False

        if not self.create_client():
            return False

        if not self.create_roles():
            return False

        self.log('=' * 50)
        self.log('🎉 Realm setup completed successfully!')
        return True
