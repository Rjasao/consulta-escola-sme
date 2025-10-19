import pytest
import requests

import api_client


class DummyResponse:
    def __init__(self, *, status_code=200, json_data=None, text=""):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.text = text

    def json(self):
        return self._json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")


def test_set_base_url_trims_trailing_slash():
    api_client.set_base_url("https://example.com/api/")
    assert api_client._state["base_url"] == "https://example.com/api"


def test_get_access_token_success(monkeypatch):
    def fake_post(url, auth, data, headers, timeout):
        assert url == "https://auth.example.com/token"
        assert auth == ("ck", "cs")
        assert data == {"grant_type": "client_credentials"}
        return DummyResponse(json_data={"access_token": "abc", "token_type": "Bearer", "expires_in": 3600})

    monkeypatch.setattr(api_client.requests, "post", fake_post)

    token = api_client.get_access_token("ck", "cs", base_url="https://auth.example.com")

    assert token == "abc"
    assert api_client._state["access_token"] == "abc"
    assert api_client._state["token_type"] == "Bearer"


def test_get_access_token_missing_field(monkeypatch):
    def fake_post(url, auth, data, headers, timeout):
        return DummyResponse(json_data={})

    monkeypatch.setattr(api_client.requests, "post", fake_post)

    with pytest.raises(RuntimeError, match="missing access_token"):
        api_client.get_access_token("ck", "cs", base_url="https://auth.example.com")


def test_search_school_falls_back_until_success(monkeypatch):
    api_client.set_base_url("https://schools.example.com")
    call_order = []

    def fake_get(url, headers, params, timeout):
        call_order.append(url)
        if url.endswith("/Escolas"):
            return DummyResponse(json_data={"results": [{"nome": "EMEF Vila Brasil"}]})
        return DummyResponse(status_code=404)

    monkeypatch.setattr(api_client.requests, "get", fake_get)

    result = api_client.search_school("Vila Brasil", token="token-123")

    assert result["items"] == [{"nome": "EMEF Vila Brasil"}]
    assert call_order[0].endswith("/escolas")
    assert call_order[1].endswith("/Escolas")


def test_search_school_requires_token():
    api_client.set_base_url("https://schools.example.com")
    with pytest.raises(RuntimeError, match="Access token missing"):
        api_client.search_school("Alguma Escola")


def test_search_schools_success(monkeypatch):
    api_client.set_base_url("https://schools.example.com")

    def fake_get(url, headers, params, timeout):
        assert url == "https://schools.example.com/api/escolas/"
        assert headers["Authorization"] == "Bearer token-123"
        # Apenas filtros com valor devem ser enviados
        assert "page" not in params
        assert params["dre"] == "BT"
        return DummyResponse(json_data={"results": [], "count": 0})

    monkeypatch.setattr(api_client.requests, "get", fake_get)

    payload = api_client.search_schools(token="token-123", dre="BT")
    assert payload == {"results": [], "count": 0}


def test_search_schools_http_error(monkeypatch):
    api_client.set_base_url("https://schools.example.com")

    def fake_get(url, headers, params, timeout):
        return DummyResponse(
            status_code=500,
            json_data={"detail": "internal error"},
            text="internal error",
        )

    monkeypatch.setattr(api_client.requests, "get", fake_get)

    with pytest.raises(RuntimeError, match="HTTP 500"):
        api_client.search_schools(token="token-123")
