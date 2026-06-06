"""Database helper functions for PostgreSQL used by the backend."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Dict, Iterable, Iterator, Mapping, Optional, Sequence


def _load_psycopg():
    """Load psycopg (v3) or fallback to psycopg2."""
    try:
        import psycopg  # type: ignore
        from psycopg.rows import dict_row

        return psycopg.connect, True, dict_row
    except Exception:
        try:
            import psycopg2  # type: ignore
            import psycopg2.extras

            return psycopg2.connect, False, psycopg2.extras.RealDictCursor
        except Exception as exc:  # pragma: no cover - depends on environment
            raise RuntimeError(
                "No PostgreSQL driver found. Install psycopg or psycopg2-binary."
            ) from exc


def _dsn() -> Dict[str, Any]:
    return {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", "5432")),
        "dbname": os.getenv("POSTGRES_DB", "folio"),
        "user": os.getenv("POSTGRES_USER", "folio_user"),
        "password": os.getenv("POSTGRES_PASSWORD", "changeme"),
    }


_connect, _is_psycopg3, _dict_cursor = _load_psycopg()


def _get_cursor(conn: Any):  # pragma: no cover
    if _is_psycopg3:
        return conn.cursor(row_factory=_dict_cursor)
    return conn.cursor(cursor_factory=_dict_cursor)


@contextmanager
def db_cursor() -> Iterator[Any]:
    conn = _connect(**_dsn())
    try:
        cur = _get_cursor(conn)
        try:
            yield cur
        finally:
            cur.close()
        conn.commit()
    except Exception:
        if hasattr(conn, "rollback"):
            conn.rollback()
        raise
    finally:
        conn.close()


def db_execute(query: str, params: Optional[Sequence[Any] | Mapping[str, Any]] = None) -> int:
    with db_cursor() as cur:
        if params is None:
            cur.execute(query)
        else:
            cur.execute(query, params)
        return int(cur.rowcount or 0)


def db_fetch_all(
    query: str, params: Optional[Sequence[Any] | Mapping[str, Any]] = None
) -> Iterable[Mapping[str, Any]]:
    rows = []
    description = None
    with db_cursor() as cur:
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


def db_fetch_one(
    query: str, params: Optional[Sequence[Any] | Mapping[str, Any]] = None
) -> Optional[Mapping[str, Any]]:
    with db_cursor() as cur:
        if params is None:
            cur.execute(query)
        else:
            cur.execute(query, params)
        row = cur.fetchone()

    if row is None:
        return None
    if isinstance(row, Mapping):
        return row
    return None


def db_healthcheck() -> bool:
    return db_fetch_one("SELECT 1 AS ok") is not None


def create_customer(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        INSERT INTO customers (social_security_number, first_name, last_name, birth_date, phone_number)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            data["social_security_number"],
            data["first_name"],
            data["last_name"],
            data["birth_date"],
            data.get("phone_number"),
        ),
    )


def get_all_customers() -> Iterable[Mapping[str, Any]]:
    return db_fetch_all("SELECT * FROM customers ORDER BY social_security_number")


def get_customer(social_security_number: str) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        "SELECT * FROM customers WHERE social_security_number = %s",
        (social_security_number,),
    )


def update_customer(social_security_number: str, data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        UPDATE customers
        SET first_name = COALESCE(%s, first_name),
            last_name = COALESCE(%s, last_name),
            birth_date = COALESCE(%s, birth_date),
            phone_number = COALESCE(%s, phone_number)
        WHERE social_security_number = %s
        RETURNING *
        """,
        (
            data.get("first_name"),
            data.get("last_name"),
            data.get("birth_date"),
            data.get("phone_number"),
            social_security_number,
        ),
    )


def delete_customer(social_security_number: str) -> int:
    return db_execute(
        "DELETE FROM customers WHERE social_security_number = %s",
        (social_security_number,),
    )


def create_treatment(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        INSERT INTO treatments (name, min_duration_minutes)
        VALUES (%s, %s)
        RETURNING *
        """,
        (data["name"], data["min_duration_minutes"]),
    )


def get_all_treatments() -> Iterable[Mapping[str, Any]]:
    return db_fetch_all("SELECT * FROM treatments ORDER BY id")


def get_treatment(treatment_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetch_one("SELECT * FROM treatments WHERE id = %s", (treatment_id,))


def update_treatment(treatment_id: int, data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        UPDATE treatments
        SET name = COALESCE(%s, name),
            min_duration_minutes = COALESCE(%s, min_duration_minutes)
        WHERE id = %s
        RETURNING *
        """,
        (data.get("name"), data.get("min_duration_minutes"), treatment_id),
    )


def delete_treatment(treatment_id: int) -> int:
    return db_execute("DELETE FROM treatments WHERE id = %s", (treatment_id,))


def create_staff(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        INSERT INTO staff (first_name, last_name)
        VALUES (%s, %s)
        RETURNING *
        """,
        (data["first_name"], data["last_name"]),
    )


def get_all_staff() -> Iterable[Mapping[str, Any]]:
    return db_fetch_all("SELECT * FROM staff ORDER BY id")


def get_staff(staff_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetch_one("SELECT * FROM staff WHERE id = %s", (staff_id,))


def update_staff(staff_id: int, data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        UPDATE staff
        SET first_name = COALESCE(%s, first_name),
            last_name = COALESCE(%s, last_name)
        WHERE id = %s
        RETURNING *
        """,
        (data.get("first_name"), data.get("last_name"), staff_id),
    )


def delete_staff(staff_id: int) -> int:
    return db_execute("DELETE FROM staff WHERE id = %s", (staff_id,))


def create_room(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        "INSERT INTO rooms (name) VALUES (%s) RETURNING *",
        (data["name"],),
    )


def get_all_rooms() -> Iterable[Mapping[str, Any]]:
    return db_fetch_all("SELECT * FROM rooms ORDER BY id")


def get_room(room_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetch_one("SELECT * FROM rooms WHERE id = %s", (room_id,))


def update_room(room_id: int, data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        "UPDATE rooms SET name = COALESCE(%s, name) WHERE id = %s RETURNING *",
        (data.get("name"), room_id),
    )


def delete_room(room_id: int) -> int:
    return db_execute("DELETE FROM rooms WHERE id = %s", (room_id,))


def create_staff_specialization(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        INSERT INTO staff_specializations (staff_id, treatment_id)
        VALUES (%s, %s)
        RETURNING *
        """,
        (data["staff_id"], data["treatment_id"]),
    )


def get_all_staff_specializations() -> Iterable[Mapping[str, Any]]:
    return db_fetch_all("SELECT * FROM staff_specializations ORDER BY staff_id, treatment_id")


def get_staff_specialization(staff_id: int, treatment_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        SELECT * FROM staff_specializations
        WHERE staff_id = %s AND treatment_id = %s
        """,
        (staff_id, treatment_id),
    )


def update_staff_specialization(
    staff_id: int,
    treatment_id: int,
    data: Mapping[str, Any],
) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        UPDATE staff_specializations
        SET staff_id = COALESCE(%s, staff_id),
            treatment_id = COALESCE(%s, treatment_id)
        WHERE staff_id = %s AND treatment_id = %s
        RETURNING *
        """,
        (data.get("staff_id"), data.get("treatment_id"), staff_id, treatment_id),
    )


def delete_staff_specialization(staff_id: int, treatment_id: int) -> int:
    return db_execute(
        """
        DELETE FROM staff_specializations
        WHERE staff_id = %s AND treatment_id = %s
        """,
        (staff_id, treatment_id),
    )


def create_staff_shift(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        INSERT INTO staff_shifts (staff_id, room_id, shift_start, shift_end)
        VALUES (%s, %s, %s, %s)
        RETURNING *
        """,
        (data["staff_id"], data["room_id"], data["shift_start"], data["shift_end"]),
    )


def get_all_staff_shifts() -> Iterable[Mapping[str, Any]]:
    return db_fetch_all("SELECT * FROM staff_shifts ORDER BY shift_start, id")


def get_staff_shift(shift_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetch_one("SELECT * FROM staff_shifts WHERE id = %s", (shift_id,))


def update_staff_shift(shift_id: int, data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        UPDATE staff_shifts
        SET staff_id = COALESCE(%s, staff_id),
            room_id = COALESCE(%s, room_id),
            shift_start = COALESCE(%s, shift_start),
            shift_end = COALESCE(%s, shift_end)
        WHERE id = %s
        RETURNING *
        """,
        (
            data.get("staff_id"),
            data.get("room_id"),
            data.get("shift_start"),
            data.get("shift_end"),
            shift_id,
        ),
    )


def delete_staff_shift(shift_id: int) -> int:
    return db_execute("DELETE FROM staff_shifts WHERE id = %s", (shift_id,))


def create_appointment(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        INSERT INTO appointments
            (customer_id, staff_id, room_id, treatment_id, start_time, end_time, status)
        VALUES (%s, %s, %s, %s, %s, %s, COALESCE(%s, 'scheduled'))
        RETURNING *
        """,
        (
            data["customer_id"],
            data["staff_id"],
            data["room_id"],
            data["treatment_id"],
            data["start_time"],
            data["end_time"],
            data.get("status"),
        ),
    )


def get_all_appointments() -> Iterable[Mapping[str, Any]]:
    return db_fetch_all("SELECT * FROM appointments ORDER BY start_time, id")


def get_appointment(appointment_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetch_one("SELECT * FROM appointments WHERE id = %s", (appointment_id,))


def update_appointment(appointment_id: int, data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetch_one(
        """
        UPDATE appointments
        SET customer_id = COALESCE(%s, customer_id),
            staff_id = COALESCE(%s, staff_id),
            room_id = COALESCE(%s, room_id),
            treatment_id = COALESCE(%s, treatment_id),
            start_time = COALESCE(%s, start_time),
            end_time = COALESCE(%s, end_time),
            status = COALESCE(%s, status)
        WHERE id = %s
        RETURNING *
        """,
        (
            data.get("customer_id"),
            data.get("staff_id"),
            data.get("room_id"),
            data.get("treatment_id"),
            data.get("start_time"),
            data.get("end_time"),
            data.get("status"),
            appointment_id,
        ),
    )


def delete_appointment(appointment_id: int) -> int:
    return db_execute("DELETE FROM appointments WHERE id = %s", (appointment_id,))
