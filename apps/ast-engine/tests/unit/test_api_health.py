from fastapi.testclient import TestClient

from ast_engine.main import app


def test_health():
    res = TestClient(app).get("/health")
    assert res.status_code == 200 and res.json()["status"] == "ok"
