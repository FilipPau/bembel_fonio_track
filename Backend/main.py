"""Flask app + PostgreSQL adapter for customer operations."""

from __future__ import annotations

import os
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Iterator, Mapping, Optional, Sequence

from flask import Flask, jsonify, request


def _load_psycopg():
    """
    Lazily load a PostgreSQL driver.
    Supports psycopg (v3) and psycopg2 fallback.
    """
    try:
        import psycopg  # type: ignore

        return psycopg.connect, True
    except Exception:
        try:
            import psycopg2  # type: ignore

            return psycopg2.connect, False
        except Exception as exc:  # pragma: no cover - driver availability depends on env
            raise RuntimeError(
                "No PostgreSQL driver found. Install psycopg or psycopg2-binary."
            ) from exc


@dataclass(frozen=True)
class DatabaseConfig:
    host: str = os.getenv("POSTGRES_HOST", "localhost")
    port: int = int(os.getenv("POSTGRES_PORT", "5432"))
    database: str = os.getenv("POSTGRES_DB", "folio")
    user: str = os.getenv("POSTGRES_USER", "folio_user")
    password: str = os.getenv("POSTGRES_PASSWORD", "changeme")


class DatabaseAdapter:
    """
    Simple PostgreSQL adapter with context-managed connections and query helpers.
    """

    def __init__(self, config: Optional[DatabaseConfig] = None) -> None:
        self._config = config or DatabaseConfig()
        self._connect, self._is_psycopg3 = _load_psycopg()

    @property
    def dsn(self) -> Dict[str, Any]:
        return {
            "host": self._config.host,
            "port": self._config.port,
            "dbname": self._config.database,
            "user": self._config.user,
            "password": self._config.password,
        }

    @contextmanager
    def connection(self) -> Iterator[Any]:
        conn = self._connect(**self.dsn)
        try:
            yield conn
            if hasattr(conn, "commit"):
                conn.commit()
        except Exception:
            if hasattr(conn, "rollback"):
                conn.rollback()
            raise
        finally:
            conn.close()

    def _cursor(self, conn: Any):  # pragma: no cover
        if self._is_psycopg3:
            try:
                from psycopg.rows import dict_row

                return conn.cursor(row_factory=dict_row)
            except Exception:
                return conn.cursor()
        try:
            import psycopg2.extras

            return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        except Exception:
            return conn.cursor()

    @contextmanager
    def cursor(self) -> Iterator[Any]:
        with self.connection() as conn:
            cur = self._cursor(conn)
            try:
                yield cur
            finally:
                cur.close()

    def execute(
        self,
        query: str,
        params: Optional[Sequence[Any] | Mapping[str, Any]] = None,
    ) -> int:
        with self.cursor() as cur:
            if params is None:
                cur.execute(query)
            else:
                cur.execute(query, params)
            return int(cur.rowcount or 0)

    def fetch_all(
        self,
        query: str,
        params: Optional[Sequence[Any] | Mapping[str, Any]] = None,
    ) -> Iterable[Mapping[str, Any]]:
        with self.cursor() as cur:
            if params is None:
                cur.execute(query)
            else:
                cur.execute(query, params)
            rows = cur.fetchall()
            description = cur.description

        if not rows:
            return []

        if isinstance(rows[0], Mapping):
            return rows  # type: ignore[return-value]

        cols = [d[0] for d in (description or [])]
        return [dict(zip(cols, row)) for row in rows]

    def fetch_one(
        self,
        query: str,
        params: Optional[Sequence[Any] | Mapping[str, Any]] = None,
    ) -> Optional[Mapping[str, Any]]:
        with self.cursor() as cur:
            if params is None:
                cur.execute(query)
            else:
                cur.execute(query, params)
            row = cur.fetchone()
            description = cur.description

        if row is None:
            return None

        if isinstance(row, Mapping):
            return row

        cols = [d[0] for d in (description or [])]
        return dict(zip(cols, row))

    def healthcheck(self) -> bool:
        return self.fetch_one("SELECT 1 AS ok") is not None


def _is_duplicate_error(exc: BaseException) -> bool:
    return getattr(exc, "sqlstate", None) == "23505" or getattr(exc, "pgcode", None) == "23505"


app = Flask(__name__)
db = DatabaseAdapter()


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    return response


def _bool_or_400(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lower = value.strip().lower()
        if lower in {"true", "1", "yes", "y"}:
            return True
        if lower in {"false", "0", "no", "n"}:
            return False
    raise ValueError("has_previous_appointments must be a boolean.")


@app.get("/health")
def health() -> tuple[Any, int]:
    return jsonify({"ok": db.healthcheck()}), 200


@app.post("/kunden")
def create_customer():
    payload = request.get_json(silent=True) or {}
    required = [
        "social_security_number",
        "first_name",
        "last_name",
        "birth_date",
        "phone_number",
        "has_previous_appointments",
    ]
    missing = [field for field in required if field not in payload]
    if missing:
        return jsonify({"error": "Missing fields", "missing": missing}), 400

    try:
        has_previous_appointments = _bool_or_400(payload["has_previous_appointments"])
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    query = (
        """
        INSERT INTO customers
            (social_security_number, first_name, last_name, birth_date, phone_number, has_previous_appointments)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
    )
    try:
        db.execute(
            query,
            (
                payload["social_security_number"],
                payload["first_name"],
                payload["last_name"],
                payload["birth_date"],
                payload["phone_number"],
                has_previous_appointments,
            ),
        )
    except Exception as exc:  # pragma: no cover - depends on driver-specific errors
        if _is_duplicate_error(exc):
            return jsonify({"error": "Customer already exists"}), 409
        return jsonify({"error": "Failed to create customer", "details": str(exc)}), 500

    return jsonify(
        {
            "social_security_number": payload["social_security_number"],
            "first_name": payload["first_name"],
            "last_name": payload["last_name"],
            "birth_date": payload["birth_date"],
            "phone_number": payload["phone_number"],
            "has_previous_appointments": has_previous_appointments,
        }
    ), 201


@app.get("/kunden/getall")
def get_all_customers_getall():
    customers = list(db.fetch_all("SELECT * FROM customers ORDER BY social_security_number"))
    return jsonify(customers), 200


@app.get("/kunden")
def get_all_customers():
    customers = list(db.fetch_all("SELECT * FROM customers ORDER BY social_security_number"))
    return jsonify(customers), 200


@app.get("/kunden/<social_security_number>")
def get_customer(social_security_number: str):
    customer = db.fetch_one(
        "SELECT * FROM customers WHERE social_security_number = %s", (social_security_number,)
    )
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    return jsonify(customer), 200


@app.get("/kunden/get/<social_security_number>")
def get_customer_explicit(social_security_number: str):
    customer = db.fetch_one(
        "SELECT * FROM customers WHERE social_security_number = %s", (social_security_number,)
    )
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    return jsonify(customer), 200


@app.delete("/kunden/<social_security_number>")
def delete_customer(social_security_number: str):
    deleted = db.execute(
        "DELETE FROM customers WHERE social_security_number = %s", (social_security_number,)
    )
    if deleted == 0:
        return jsonify({"error": "Customer not found"}), 404
    return "", 204


@app.delete("/kunden/delete/<social_security_number>")
def delete_customer_explicit(social_security_number: str):
    deleted = db.execute(
        "DELETE FROM customers WHERE social_security_number = %s", (social_security_number,)
    )
    if deleted == 0:
        return jsonify({"error": "Customer not found"}), 404
    return "", 204


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
