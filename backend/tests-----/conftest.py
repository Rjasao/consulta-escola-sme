import pytest

import api_client


@pytest.fixture(autouse=True)
def reset_api_client_state():
    """Garante que o estado global do cliente HTTP esteja limpo entre os testes."""
    api_client._state.clear()
    yield
    api_client._state.clear()
