"""Database helper functions for PostgreSQL used by the backend."""

from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, Iterator, Mapping, Optional, Sequence


def _load_psycopg():
    try:
        import psycopg  # type: ignore
        from psycopg.rows import dict_row  # type: ignore

        return psycopg.connect, True, dict_row
    except Exception:
        try:
            import psycopg2  # type: ignore
            import psycopg2.extras  # type: ignore

            return psycopg2.connect, False, psycopg2.extras.RealDictCursor
        except Exception as exc:  # pragma: no cover
            raise RuntimeError(
                "No PostgreSQL driver found. Install psycopg or psycopg2-binary."
            ) from exc


_connect, _is_psycopg3, _dict_cursor = _load_psycopg()


def _dsn() -> Dict[str, Any]:
    return {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", "5432")),
        "dbname": os.getenv("POSTGRES_DB", "folio"),
        "user": os.getenv("POSTGRES_USER", "folio_user"),
        "password": os.getenv("POSTGRES_PASSWORD", "changeme"),
    }


def _has_global_appointment_overlap(start_time: datetime, end_time: datetime) -> bool:
    row = db_fetchone(
        """
        SELECT 1
        FROM appointments
        WHERE start_time < %s
          AND end_time > %s
        LIMIT 1
        """,
        (end_time, start_time),
    )
    return row is not None


@contextmanager
def db_cursor() -> Iterator[Any]:
    conn = _connect(**_dsn())
    try:
        if _is_psycopg3:
            cur = conn.cursor(row_factory=_dict_cursor)
        else:
            cur = conn.cursor(cursor_factory=_dict_cursor)
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


def db_fetchall(
    query: str, params: Optional[Sequence[Any] | Mapping[str, Any]] = None
) -> list[Mapping[str, Any]]:
    with db_cursor() as cur:
        if params is None:
            cur.execute(query)
        else:
            cur.execute(query, params)
        rows = cur.fetchall()
        if not rows:
            return []
        return [dict(row) if not isinstance(row, Mapping) else row for row in rows]


def db_fetchone(
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
        return dict(row) if not isinstance(row, Mapping) else row


fetch_one = db_fetchone
fetch_all = db_fetchall
execute = db_execute


def db_healthcheck() -> bool:
    row = db_fetchone("SELECT 1 AS ok")
    return bool(row and row.get("ok") == 1)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_aware(value: Optional[datetime]) -> datetime:
    if value is None:
        return _now_utc()
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def create_customer(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        INSERT INTO customers (
            social_security_number,
            first_name,
            last_name,
            birth_date,
            phone_number
        )
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


def get_all_customers() -> list[Mapping[str, Any]]:
    return db_fetchall("SELECT * FROM customers ORDER BY social_security_number")


def get_customer(social_security_number: str) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        "SELECT * FROM customers WHERE social_security_number = %s",
        (social_security_number,),
    )


def update_customer(
    social_security_number: str, data: Mapping[str, Any]
) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE customers
        SET
            first_name = COALESCE(%s, first_name),
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


def find_customers_by_phone_number(phone_number: str) -> list[Mapping[str, Any]]:
    return db_fetchall(
        "SELECT * FROM customers WHERE phone_number = %s ORDER BY social_security_number",
        (phone_number,),
    )


def create_treatment(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        INSERT INTO treatments (name, min_duration_minutes)
        VALUES (%s, %s)
        RETURNING *
        """,
        (data["name"], data["min_duration_minutes"]),
    )


def get_all_treatments() -> list[Mapping[str, Any]]:
    return db_fetchall("SELECT * FROM treatments ORDER BY id")


def get_treatment(treatment_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetchone("SELECT * FROM treatments WHERE id = %s", (treatment_id,))


def update_treatment(treatment_id: int, data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE treatments
        SET
            name = COALESCE(%s, name),
            min_duration_minutes = COALESCE(%s, min_duration_minutes)
        WHERE id = %s
        RETURNING *
        """,
        (data.get("name"), data.get("min_duration_minutes"), treatment_id),
    )


def delete_treatment(treatment_id: int) -> int:
    return db_execute("DELETE FROM treatments WHERE id = %s", (treatment_id,))


def create_staff(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        INSERT INTO staff (first_name, last_name)
        VALUES (%s, %s)
        RETURNING *
        """,
        (data["first_name"], data["last_name"]),
    )


def get_all_staff() -> list[Mapping[str, Any]]:
    return db_fetchall("SELECT * FROM staff ORDER BY id")


def get_staff(staff_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetchone("SELECT * FROM staff WHERE id = %s", (staff_id,))


def update_staff(staff_id: int, data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE staff
        SET
            first_name = COALESCE(%s, first_name),
            last_name = COALESCE(%s, last_name)
        WHERE id = %s
        RETURNING *
        """,
        (data.get("first_name"), data.get("last_name"), staff_id),
    )


def delete_staff(staff_id: int) -> int:
    return db_execute("DELETE FROM staff WHERE id = %s", (staff_id,))


def create_room(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        "INSERT INTO rooms (name) VALUES (%s) RETURNING *",
        (data["name"],),
    )


def get_all_rooms() -> list[Mapping[str, Any]]:
    return db_fetchall("SELECT * FROM rooms ORDER BY id")


def get_room(room_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetchone("SELECT * FROM rooms WHERE id = %s", (room_id,))


def update_room(room_id: int, data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE rooms
        SET name = COALESCE(%s, name)
        WHERE id = %s
        RETURNING *
        """,
        (data.get("name"), room_id),
    )


def delete_room(room_id: int) -> int:
    return db_execute("DELETE FROM rooms WHERE id = %s", (room_id,))


def create_staff_specialization(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        INSERT INTO staff_specializations (staff_id, treatment_id)
        VALUES (%s, %s)
        RETURNING *
        """,
        (data["staff_id"], data["treatment_id"]),
    )


def get_all_staff_specializations() -> list[Mapping[str, Any]]:
    return db_fetchall("SELECT * FROM staff_specializations ORDER BY staff_id, treatment_id")


def get_staff_specialization(staff_id: int, treatment_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        "SELECT * FROM staff_specializations WHERE staff_id = %s AND treatment_id = %s",
        (staff_id, treatment_id),
    )


def update_staff_specialization(
    staff_id: int, treatment_id: int, data: Mapping[str, Any]
) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE staff_specializations
        SET
            staff_id = COALESCE(%s, staff_id),
            treatment_id = COALESCE(%s, treatment_id)
        WHERE staff_id = %s AND treatment_id = %s
        RETURNING *
        """,
        (data.get("staff_id"), data.get("treatment_id"), staff_id, treatment_id),
    )


def delete_staff_specialization(staff_id: int, treatment_id: int) -> int:
    return db_execute(
        "DELETE FROM staff_specializations WHERE staff_id = %s AND treatment_id = %s",
        (staff_id, treatment_id),
    )


def create_staff_shift(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        INSERT INTO staff_shifts (staff_id, room_id, shift_start, shift_end)
        VALUES (%s, %s, %s, %s)
        RETURNING *
        """,
        (
            data["staff_id"],
            data["room_id"],
            data["shift_start"],
            data["shift_end"],
        ),
    )


def get_all_staff_shifts() -> list[Mapping[str, Any]]:
    return db_fetchall("SELECT * FROM staff_shifts ORDER BY shift_start, id")


def get_staff_shift(shift_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetchone("SELECT * FROM staff_shifts WHERE id = %s", (shift_id,))


def update_staff_shift(shift_id: int, data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE staff_shifts
        SET
            staff_id = COALESCE(%s, staff_id),
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


def create_weekly_capacity_limit(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        INSERT INTO weekly_capacity_limits (weekday, max_minutes)
        VALUES (%s, %s)
        RETURNING *
        """,
        (data["weekday"], data["max_minutes"]),
    )


def get_all_weekly_capacity_limits() -> list[Mapping[str, Any]]:
    return db_fetchall("SELECT * FROM weekly_capacity_limits ORDER BY weekday")


def get_weekly_capacity_limit(weekday: int) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        "SELECT * FROM weekly_capacity_limits WHERE weekday = %s",
        (weekday,),
    )


def update_weekly_capacity_limit(
    weekday: int, data: Mapping[str, Any]
) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE weekly_capacity_limits
        SET max_minutes = COALESCE(%s, max_minutes)
        WHERE weekday = %s
        RETURNING *
        """,
        (data.get("max_minutes"), weekday),
    )


def delete_weekly_capacity_limit(weekday: int) -> int:
    return db_execute("DELETE FROM weekly_capacity_limits WHERE weekday = %s", (weekday,))


def create_appointment(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        INSERT INTO appointments (
            customer_id,
            staff_id,
            room_id,
            treatment_id,
            start_time,
            end_time
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            data["customer_id"],
            data["staff_id"],
            data["room_id"],
            data["treatment_id"],
            data["start_time"],
            data["end_time"],
        ),
    )


def update_appointment(
    appointment_id: int, data: Mapping[str, Any]
) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE appointments
        SET
            customer_id = COALESCE(%s, customer_id),
            staff_id = COALESCE(%s, staff_id),
            room_id = COALESCE(%s, room_id),
            treatment_id = COALESCE(%s, treatment_id),
            start_time = COALESCE(%s, start_time),
            end_time = COALESCE(%s, end_time)
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
            appointment_id,
        ),
    )


def get_all_appointments() -> list[Mapping[str, Any]]:
    return db_fetchall("SELECT * FROM appointments ORDER BY start_time, id")


def get_appointment(appointment_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetchone("SELECT * FROM appointments WHERE id = %s", (appointment_id,))


def update_appointment(
    appointment_id: int, data: Mapping[str, Any]
) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE appointments
        SET
            customer_id = COALESCE(%s, customer_id),
            staff_id = COALESCE(%s, staff_id),
            room_id = COALESCE(%s, room_id),
            treatment_id = COALESCE(%s, treatment_id),
            start_time = COALESCE(%s, start_time),
            end_time = COALESCE(%s, end_time)
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
            appointment_id,
        ),
    )


def delete_appointment(appointment_id: int) -> int:
    return db_execute("DELETE FROM appointments WHERE id = %s", (appointment_id,))


def create_planned_appointment(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        INSERT INTO planned_appointments (customer_id, treatment_id, appointment_date)
        VALUES (%s, %s, %s)
        RETURNING *
        """,
        (data["customer_id"], data["treatment_id"], data["appointment_date"]),
    )


def get_all_planned_appointments() -> list[Mapping[str, Any]]:
    return db_fetchall("SELECT * FROM planned_appointments ORDER BY appointment_date, id")


def get_planned_appointment(planned_appointment_id: int) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        "SELECT * FROM planned_appointments WHERE id = %s",
        (planned_appointment_id,),
    )


def update_planned_appointment(
    planned_appointment_id: int, data: Mapping[str, Any]
) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE planned_appointments
        SET
            customer_id = COALESCE(%s, customer_id),
            treatment_id = COALESCE(%s, treatment_id),
            appointment_date = COALESCE(%s, appointment_date)
        WHERE id = %s
        RETURNING *
        """,
        (
            data.get("customer_id"),
            data.get("treatment_id"),
            data.get("appointment_date"),
            planned_appointment_id,
        ),
    )


def delete_planned_appointment(planned_appointment_id: int) -> int:
    return db_execute(
        "DELETE FROM planned_appointments WHERE id = %s",
        (planned_appointment_id,),
    )


def create_appointment_refill(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        INSERT INTO appointment_refills (old_appointment_id, new_appointment_id)
        VALUES (%s, %s)
        RETURNING *
        """,
        (data["old_appointment_id"], data.get("new_appointment_id")),
    )


def get_all_appointment_refills() -> list[Mapping[str, Any]]:
    return db_fetchall(
        "SELECT * FROM appointment_refills ORDER BY uid"
    )


def get_appointment_refill(refill_uid: int) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        "SELECT * FROM appointment_refills WHERE uid = %s",
        (refill_uid,),
    )


def update_appointment_refill(
    refill_uid: int, data: Mapping[str, Any]
) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE appointment_refills
        SET
            old_appointment_id = COALESCE(%s, old_appointment_id),
            new_appointment_id = COALESCE(%s, new_appointment_id)
        WHERE uid = %s
        RETURNING *
        """,
        (
            data.get("old_appointment_id"),
            data.get("new_appointment_id"),
            refill_uid,
        ),
    )


def delete_appointment_refill(refill_uid: int) -> int:
    return db_execute(
        "DELETE FROM appointment_refills WHERE uid = %s",
        (refill_uid,),
    )


def create_refill_attempt(data: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        INSERT INTO refill_attempts (
            refill_uid,
            customer_id,
            outcome,
            outcome_reason,
            call_timestamp,
            call_duration_seconds
        )
        VALUES (
            %s,
            %s,
            COALESCE(%s, 'calling'),
            %s,
            COALESCE(%s, now()),
            %s
        )
        RETURNING *
        """,
        (
            data["refill_uid"],
            data["customer_id"],
            data.get("outcome"),
            data.get("outcome_reason"),
            data.get("call_timestamp"),
            data.get("call_duration_seconds"),
        ),
    )


def get_all_refill_attempts() -> list[Mapping[str, Any]]:
    return db_fetchall(
        "SELECT * FROM refill_attempts ORDER BY call_timestamp DESC, uid DESC"
    )


def get_refill_attempt(attempt_uid: int) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        "SELECT * FROM refill_attempts WHERE uid = %s",
        (attempt_uid,),
    )


def update_refill_attempt(
    attempt_uid: int, data: Mapping[str, Any]
) -> Optional[Mapping[str, Any]]:
    return db_fetchone(
        """
        UPDATE refill_attempts
        SET
            refill_uid = COALESCE(%s, refill_uid),
            customer_id = COALESCE(%s, customer_id),
            outcome = COALESCE(%s, outcome),
            outcome_reason = COALESCE(%s, outcome_reason),
            call_timestamp = COALESCE(%s, call_timestamp),
            call_duration_seconds = COALESCE(%s, call_duration_seconds)
        WHERE uid = %s
        RETURNING *
        """,
        (
            data.get("refill_uid"),
            data.get("customer_id"),
            data.get("outcome"),
            data.get("outcome_reason"),
            data.get("call_timestamp"),
            data.get("call_duration_seconds"),
            attempt_uid,
        ),
    )


def delete_refill_attempt(attempt_uid: int) -> int:
    return db_execute(
        "DELETE FROM refill_attempts WHERE uid = %s",
        (attempt_uid,),
    )



def find_available_treatment_slots(
    treatment_id: int,
    search_from: Optional[datetime] = None,
    staff_id: Optional[int] = None,
) -> Mapping[str, Any]:
    treatment = get_treatment(treatment_id)
    if not treatment:
        return {"success": False, "slots": []}

    duration = timedelta(minutes=int(treatment["min_duration_minutes"]))
    search_from = _ensure_aware(search_from)

    if staff_id is None:
        qualified_staff = db_fetchall(
            """
            SELECT ss.staff_id
            FROM staff_specializations ss
            WHERE ss.treatment_id = %s
            ORDER BY ss.staff_id
            """,
            (treatment_id,),
        )
    else:
        qualified_staff = db_fetchall(
            """
            SELECT ss.staff_id
            FROM staff_specializations ss
            WHERE ss.treatment_id = %s
              AND ss.staff_id = %s
            ORDER BY ss.staff_id
            """,
            (treatment_id, staff_id),
        )

    slots: list[Mapping[str, Any]] = []

    for staff_row in qualified_staff:
        current_staff_id = int(staff_row["staff_id"])
        shifts = db_fetchall(
            """
            SELECT id, staff_id, room_id, shift_start, shift_end
            FROM staff_shifts
            WHERE staff_id = %s
              AND shift_end > %s
            ORDER BY shift_start, id
            """,
            (current_staff_id, search_from),
        )

        for shift in shifts:
            shift_start = max(shift["shift_start"], search_from)
            shift_end = shift["shift_end"]
            room_id = int(shift["room_id"])

            candidate_start = shift_start
            while candidate_start + duration <= shift_end:
                candidate_end = candidate_start + duration

                if not _has_global_appointment_overlap(candidate_start, candidate_end):
                    slots.append(
                        {
                            "staff_id": current_staff_id,
                            "room_id": room_id,
                            "treatment_id": treatment_id,
                            "start_time": candidate_start,
                            "end_time": candidate_end,
                        }
                    )

                candidate_start += duration

    slots.sort(key=lambda row: (row["start_time"], row["staff_id"], row["room_id"]))
    return {"success": True, "slots": slots}


def reserve_appointment_for_treatment(
    treatment_id: int,
    customer_id: str,
    search_from: Optional[datetime] = None,
    staff_id: Optional[int] = None,
) -> Mapping[str, Any]:
    customer = get_customer(customer_id)
    if not customer:
        return {"success": False, "appointment": None}

    result = find_available_treatment_slots(
        treatment_id=treatment_id,
        search_from=search_from,
        staff_id=staff_id,
    )
    if not result["success"]:
        return {"success": False, "appointment": None}

    for slot in result["slots"]:
        try:
            appointment = create_appointment(
                {
                    "customer_id": customer_id,
                    "staff_id": slot["staff_id"],
                    "room_id": slot["room_id"],
                    "treatment_id": treatment_id,
                    "start_time": slot["start_time"],
                    "end_time": slot["end_time"]
                }
            )
        except Exception:
            continue

        if appointment:
            return {"success": True, "appointment": appointment}

    return {"success": False, "appointment": None}


def reserve_fixed_appointment(
    social_security_number: str,
    start_time: datetime,
    treatment_id: int,
) -> Mapping[str, Any]:
    customer = get_customer(social_security_number)
    if not customer:
        return {"success": False, "appointment": None, "reason": "customer_not_found"}

    treatment = get_treatment(treatment_id)
    if not treatment:
        return {"success": False, "appointment": None, "reason": "treatment_not_found"}

    start_time = _ensure_aware(start_time)
    duration = timedelta(minutes=int(treatment["min_duration_minutes"]))
    end_time = start_time + duration

    existing_overlap = db_fetchone(
        """
        SELECT id
        FROM appointments
        WHERE start_time < %s
          AND end_time > %s
        LIMIT 1
        """,
        (end_time, start_time),
    )

    if existing_overlap:
        return {"success": False, "appointment": None, "reason": "overlap"}

    candidate = db_fetchone(
        """
        SELECT
            ss.staff_id,
            sh.room_id
        FROM staff_specializations ss
        JOIN staff_shifts sh
          ON sh.staff_id = ss.staff_id
        WHERE ss.treatment_id = %s
          AND sh.shift_start <= %s
          AND sh.shift_end >= %s
        ORDER BY ss.staff_id, sh.room_id
        LIMIT 1
        """,
        (treatment_id, start_time, end_time),
    )

    if not candidate:
        return {"success": False, "appointment": None, "reason": "no_slot_available"}

    appointment = create_appointment(
        {
            "customer_id": social_security_number,
            "staff_id": candidate["staff_id"],
            "room_id": candidate["room_id"],
            "treatment_id": treatment_id,
            "start_time": start_time,
            "end_time": end_time
        }
    )

    return {"success": True, "appointment": appointment, "reason": None}


def get_appointments_by_customer(customer_id: str) -> list[Mapping[str, Any]]:
    return db_fetchall(
        """
        SELECT *
        FROM appointments
        WHERE customer_id = %s
        ORDER BY start_time, id
        """,
        (customer_id,),
    )


def find_patients_for_canceled_timespan(
    treatment_id: int,
    canceled_start: datetime,
    canceled_end: datetime,
    min_days_ahead: int = 2,
    limit: int = 25,
) -> Mapping[str, Any]:
    canceled_start = _ensure_aware(canceled_start)
    canceled_end = _ensure_aware(canceled_end)

    if canceled_end <= canceled_start:
        return {
            "success": False,
            "canceled_appointment": None,
            "patients": [],
            "error": "invalid_time_range",
        }

    canceled_duration = canceled_end - canceled_start
    min_candidate_start = canceled_start + timedelta(days=min_days_ahead)

    rows = db_fetchall(
        """
        SELECT
            a.id AS appointment_id,
            a.customer_id,
            a.staff_id,
            a.room_id,
            a.treatment_id,
            a.start_time,
            a.end_time,
            c.social_security_number,
            c.first_name,
            c.last_name,
            c.birth_date,
            c.phone_number
        FROM appointments a
        JOIN customers c
          ON c.social_security_number = a.customer_id
        WHERE a.treatment_id = %s
          AND a.start_time >= %s
        ORDER BY a.start_time, a.id
        """,
        (treatment_id, min_candidate_start),
    )

    patients: list[Mapping[str, Any]] = []

    for row in rows:
        candidate_duration = row["end_time"] - row["start_time"]
        if candidate_duration != canceled_duration:
            continue

        conflict = db_fetchone(
            """
            SELECT 1
            FROM appointments a
            WHERE a.id <> %s
              AND a.start_time < %s
              AND a.end_time > %s
              AND (
                    a.customer_id = %s
                 OR a.staff_id = %s
                 OR a.room_id = %s
              )
            LIMIT 1
            """,
            (
                row["appointment_id"],
                canceled_end,
                canceled_start,
                row["customer_id"],
                row["staff_id"],
                row["room_id"],
            ),
        )

        if conflict:
            continue

        patients.append(
            {
                "patient": {
                    "social_security_number": row["social_security_number"],
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                    "birth_date": row["birth_date"],
                    "phone_number": row["phone_number"],
                },
                "current_appointment": {
                    "id": row["appointment_id"],
                    "customer_id": row["customer_id"],
                    "staff_id": row["staff_id"],
                    "room_id": row["room_id"],
                    "treatment_id": row["treatment_id"],
                    "start_time": row["start_time"],
                    "end_time": row["end_time"],
                },
            }
        )

        if len(patients) >= limit:
            break

    return {
        "success": True,
        "canceled_appointment": {
            "treatment_id": treatment_id,
            "start_time": canceled_start,
            "end_time": canceled_end,
        },
        "patients": patients,
    }