"""Integration test proving strict cross-tenant isolation and 404 security rules."""

import pytest

from app.api.deps import verify_account_resource
from app.core.errors import NotFoundError


def test_tenant_isolation_same_account() -> None:
    """Access allowed when resource belongs to caller account."""
    caller_account = "account-1111-2222"
    resource_account = "account-1111-2222"
    # Should not raise exception
    verify_account_resource(resource_account, caller_account)


def test_tenant_isolation_foreign_account_yields_404() -> None:
    """Security rule: foreign account access must return 404 (not 403).

    Prevents leaking whether a private resource exists in another account.
    """
    caller_account = "account-alice-1234"
    foreign_account = "account-bob-9999"

    with pytest.raises(NotFoundError, match="Resource not found"):
        verify_account_resource(foreign_account, caller_account)
