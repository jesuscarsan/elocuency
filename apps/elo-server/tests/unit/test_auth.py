import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
import os
from unittest import mock

from src.infrastructure.in_adapters.api.auth import verify_token

# Dummy app for testing the dependency directly
app = FastAPI()

@app.get("/protected", dependencies=[Depends(verify_token)])
async def protected_route():
    return {"message": "success"}

client = TestClient(app)

def test_auth_strict_deny_when_no_token_configured():
    """When SERVER_AUTH_TOKEN is not set, access should be denied (500 Config Error)."""
    with mock.patch.dict(os.environ, {}, clear=True):
        response = client.get("/protected")
        assert response.status_code == 500
        assert "SERVER_AUTH_TOKEN configuration" in response.json()["detail"]

def test_auth_blocks_missing_token_when_enabled():
    """When SERVER_AUTH_TOKEN is set, requests without a token should be 401 Unauthorized."""
    with mock.patch.dict(os.environ, {"SERVER_AUTH_TOKEN": "secret-key"}, clear=True):
        response = client.get("/protected")
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid or missing authentication token"

def test_auth_blocks_invalid_token_when_enabled():
    """When SERVER_AUTH_TOKEN is set, requests with an invalid token should be 401 Unauthorized."""
    with mock.patch.dict(os.environ, {"SERVER_AUTH_TOKEN": "secret-key"}, clear=True):
        response = client.get("/protected", headers={"Authorization": "Bearer wrong-key"})
        assert response.status_code == 401
        
        response = client.get("/protected", headers={"X-API-Key": "wrong-key"})
        assert response.status_code == 401

def test_auth_allows_valid_bearer_token():
    """When SERVER_AUTH_TOKEN is set, requests with valid Bearer token should be allowed."""
    with mock.patch.dict(os.environ, {"SERVER_AUTH_TOKEN": "secret-key"}, clear=True):
        response = client.get("/protected", headers={"Authorization": "Bearer secret-key"})
        assert response.status_code == 200
        assert response.json() == {"message": "success"}

def test_auth_allows_valid_x_api_key():
    """When SERVER_AUTH_TOKEN is set, requests with valid X-API-Key should be allowed."""
    with mock.patch.dict(os.environ, {"SERVER_AUTH_TOKEN": "secret-key"}, clear=True):
        response = client.get("/protected", headers={"X-API-Key": "secret-key"})
        assert response.status_code == 200
        assert response.json() == {"message": "success"}
