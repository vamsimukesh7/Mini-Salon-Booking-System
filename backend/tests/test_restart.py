"""Real process restart verifies on-disk persistence, not only connection reuse."""

import os
from pathlib import Path
import socket
import subprocess
import time
from datetime import timedelta
import httpx
from app.domain import now


def test_booking_survives_real_server_restart(tmp_path):
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    root = Path(__file__).resolve().parents[2]
    environment = os.environ.copy() | {
        "DATABASE_URL": "sqlite:///" + str(tmp_path / "persistent.db"),
        "ADMIN_PASSWORD": "restart-test-only",
        "LLM_API_KEY": "",
    }
    command = [
        str(root / ".venv/bin/python"),
        "-m",
        "uvicorn",
        "app.main:app",
        "--port",
        str(port),
    ]

    def start():
        process = subprocess.Popen(
            command,
            cwd=root / "backend",
            env=environment,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            for _ in range(100):
                try:
                    if client.get("/health").status_code == 200:
                        return process
                except httpx.ConnectError:
                    pass
                if process.poll() is not None:
                    raise AssertionError("Server failed to start")
                time.sleep(0.05)
            raise AssertionError("Server readiness timeout")
        except Exception:
            process.terminate()
            process.wait(timeout=5)
            raise

    with httpx.Client(
        base_url=f"http://127.0.0.1:{port}", trust_env=False, timeout=3
    ) as client:
        process = start()
        try:
            payload = {
                "customer_name": "Restart Customer",
                "phone": "9988776655",
                "service_id": 1,
                "date": (now().date() + timedelta(days=10)).isoformat(),
                "time": "14:00",
            }
            response = client.post("/bookings", json=payload)
            assert response.status_code == 201
            ident = response.json()["id"]
        finally:
            process.terminate()
            process.wait(timeout=5)
        process = start()
        try:
            token = client.post(
                "/auth/login", json={"password": "restart-test-only"}
            ).json()["token"]
            response = client.get(
                "/bookings/" + ident, headers={"Authorization": "Bearer " + token}
            )
            assert response.status_code == 200
            assert response.json()["customer_name"] == "Restart Customer"
            assert client.post("/bookings", json=payload).status_code == 409
        finally:
            process.terminate()
            process.wait(timeout=5)
