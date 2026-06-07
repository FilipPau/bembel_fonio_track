"""Flask app for explicit database CRUD operations."""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from typing import Any, Callable, Mapping, Optional

from flask import Flask, jsonify, request

import db
from db import db_healthcheck


app = Flask(__name__)

HOURLY_RATE = 300


def _sqlstate(exc: BaseException) -> str | None:
    return getattr(exc, "sqlstate", None) or getattr(exc, "pgcode", None)


def _delete_from_body(
    field_name: str,
    handler: Callable[[Any], int],
    cast: Callable[[Any], Any] | None = None,
):
    payload = _json_payload()
    raw_value = payload.get(field_name)

    if raw_value in (None, ""):
        return jsonify({"error": "Missing field", "field": field_name}), 400

    try:
        value = cast(raw_value) if cast else raw_value
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid field", "field": field_name}), 400

    return _delete(lambda: handler(value))


def _database_error_response(exc: BaseException):
    state = _sqlstate(exc)
    if state == "23505":
        return jsonify({"error": "Resource already exists", "details": str(exc)}), 409
    if state == "23503":
        return jsonify({"error": "Referenced resource does not exist", "details": str(exc)}), 400
    if state == "23514":
        return jsonify({"error": "Invalid data", "details": str(exc)}), 400
    if state == "23P01":
        return jsonify({"error": "Resource conflicts with existing schedule", "details": str(exc)}), 409
    if state in {"22P02", "22007"}:
        return jsonify({"error": "Invalid field value", "details": str(exc)}), 400
    return jsonify({"error": "Database operation failed", "details": str(exc)}), 500


def _json_payload() -> Mapping[str, Any]:
    return request.get_json(silent=True) or {}


def _parse_iso_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _create(handler: Callable[[Mapping[str, Any]], Mapping[str, Any] | None]):
    try:
        row = handler(_json_payload())
    except KeyError as exc:
        return jsonify({"error": "Missing field", "field": str(exc).strip("'")}), 400
    except Exception as exc:  # pragma: no cover
        return _database_error_response(exc)
    return jsonify(row), 201


def _update(handler: Callable[[Mapping[str, Any]], Mapping[str, Any] | None]):
    try:
        row = handler(_json_payload())
    except Exception as exc:  # pragma: no cover
        return _database_error_response(exc)
    if not row:
        return jsonify({"error": "Resource not found"}), 404
    return jsonify(row), 200


def _delete(handler: Callable[[], int]):
    try:
        deleted = handler()
    except Exception as exc:  # pragma: no cover
        return _database_error_response(exc)
    if deleted == 0:
        return jsonify({"error": "Resource not found"}), 404
    return "", 204


def _get(row: Mapping[str, Any] | None):
    if not row:
        return jsonify({"error": "Resource not found"}), 404
    return jsonify(row), 200


def _week_start() -> date:
    raw_week_start = request.args.get("week_start")
    if raw_week_start:
        return date.fromisoformat(raw_week_start)
    today = date.today()
    return today - timedelta(days=today.weekday())


def _week_meta(week_start: date) -> dict[str, str]:
    return {
        "week_start": week_start.isoformat(),
        "week_end": (week_start + timedelta(days=6)).isoformat(),
    }


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return response


@app.get("/api/health")
def health() -> tuple[Any, int]:
    return jsonify({"ok": db_healthcheck()}), 200


@app.post("/api/customers")
def create_customer():
    return _create(db.create_customer)


@app.get("/api/customers")
def get_all_customers():
    return jsonify(list(db.get_all_customers())), 200


@app.get("/api/customers/<social_security_number>")
def get_customer(social_security_number: str):
    return _get(db.get_customer(social_security_number))


@app.patch("/api/customers/<social_security_number>")
@app.put("/api/customers/<social_security_number>")
def update_customer(social_security_number: str):
    return _update(lambda data: db.update_customer(social_security_number, data))


@app.delete("/api/customers")
def delete_customer():
    return _delete_from_body("social_security_number", db.delete_customer)


@app.post("/api/shane/customers-by-number")
def shane_customers_by_number():
    payload = _json_payload()
    from_number = payload.get("fromNumber")
    if not from_number:
        return jsonify({"error": "Missing field", "field": "fromNumber"}), 400

    customers = list(db.find_customers_by_phone_number(from_number))
    if len(customers) == 1:
        return jsonify(customers[0]), 200
    return jsonify({}), 404


@app.post("/api/customers/appointments")
def get_customer_appointments():
    payload = _json_payload()

    social_security_number = payload.get("social_security_number")
    if not social_security_number:
        return jsonify({"error": "Missing field", "field": "social_security_number"}), 400

    try:
        customer = db.get_customer(str(social_security_number))
        if not customer:
            return jsonify({"error": "Resource not found"}), 404

        appointments = list(db.get_appointments_by_customer(str(social_security_number)))
    except Exception as exc:
        return _database_error_response(exc)

    return jsonify(appointments), 200


@app.post("/api/appointments/reserve")
def auto_reserve_appointment():
    payload = _json_payload()

    treatment_id = payload.get("treatment_id")
    customer_id = payload.get("customer_id")
    staff_id_raw = payload.get("staff_id")
    search_from_raw = payload.get("search_from")

    if treatment_id is None:
        return jsonify({"error": "Missing field", "field": "treatment_id"}), 400
    if customer_id is None:
        return jsonify({"error": "Missing field", "field": "customer_id"}), 400

    staff_id = None
    if staff_id_raw not in (None, ""):
        try:
            staff_id = int(staff_id_raw)
        except ValueError:
            return jsonify({"error": "Invalid field", "field": "staff_id"}), 400

    search_from = None
    if search_from_raw:
        try:
            search_from = _parse_iso_datetime(search_from_raw)
        except ValueError:
            return jsonify({"error": "Invalid field", "field": "search_from"}), 400

    try:
        result = db.reserve_appointment_for_treatment(
            treatment_id=int(treatment_id),
            customer_id=str(customer_id),
            search_from=search_from,
            staff_id=staff_id,
        )
    except Exception as exc:
        return _database_error_response(exc)

    return jsonify(result), 200


@app.post("/api/FixAppointment")
@app.post("/api/fix-appointment")
def fix_appointment():
    payload = _json_payload()

    social_security_number = payload.get("social_security_number")
    start_time_raw = payload.get("start_time")
    treatment_id = payload.get("treatment_id")

    if not social_security_number:
        return jsonify({"error": "Missing field", "field": "social_security_number"}), 400
    if not start_time_raw:
        return jsonify({"error": "Missing field", "field": "start_time"}), 400
    if treatment_id is None:
        return jsonify({"error": "Missing field", "field": "treatment_id"}), 400

    try:
        start_time = _parse_iso_datetime(str(start_time_raw))
    except ValueError:
        return jsonify({"error": "Invalid field", "field": "start_time"}), 400

    try:
        result = db.reserve_fixed_appointment(
            social_security_number=str(social_security_number),
            start_time=start_time,
            treatment_id=int(treatment_id),
        )
    except ValueError:
        return jsonify({"error": "Invalid field", "field": "treatment_id"}), 400
    except Exception as exc:
        return _database_error_response(exc)

    if not result["success"]:
        if result["reason"] == "customer_not_found":
            return jsonify({"error": "Customer not found"}), 404
        if result["reason"] == "treatment_not_found":
            return jsonify({"error": "Treatment not found"}), 404
        if result["reason"] == "overlap":
            return jsonify({"error": "Appointment overlaps with an existing appointment"}), 409
        if result["reason"] == "no_slot_available":
            return jsonify({"error": "Requested slot is not available"}), 409
        return jsonify({"error": "Appointment could not be booked"}), 400

    return jsonify({"message": "Termin wurde gebucht"}), 201


@app.post("/api/shane/available-treatment-slots")
def shane_available_treatment_slots():
    payload = _json_payload()

    treatment_id = payload.get("treatment_id")
    search_from_raw = payload.get("search_from")

    if treatment_id is None:
        return jsonify({"error": "Missing field", "field": "treatment_id"}), 400

    search_from = None
    if search_from_raw:
        try:
            search_from = _parse_iso_datetime(search_from_raw)
        except ValueError:
            return jsonify({"error": "Invalid field", "field": "search_from"}), 400

    try:
        result = db.find_available_treatment_slots(
            treatment_id=int(treatment_id),
            search_from=search_from,
        )
    except Exception as exc:
        return _database_error_response(exc)

    return jsonify(result["slots"]), 200


@app.post("/api/treatments")
def create_treatment():
    return _create(db.create_treatment)


@app.get("/api/treatments")
def get_all_treatments():
    return jsonify(list(db.get_all_treatments())), 200


@app.get("/api/treatments/<int:treatment_id>")
def get_treatment(treatment_id: int):
    return _get(db.get_treatment(treatment_id))


@app.patch("/api/treatments/<int:treatment_id>")
@app.put("/api/treatments/<int:treatment_id>")
def update_treatment(treatment_id: int):
    return _update(lambda data: db.update_treatment(treatment_id, data))


@app.delete("/api/appointments")
def delete_appointment():
    return _delete_from_body("appointment_id", db.delete_appointment, int)


@app.post("/api/staff")
def create_staff():
    return _create(db.create_staff)


@app.get("/api/staff")
def get_all_staff():
    return jsonify(list(db.get_all_staff())), 200


@app.get("/api/staff/<int:staff_id>")
def get_staff(staff_id: int):
    return _get(db.get_staff(staff_id))


@app.patch("/api/staff/<int:staff_id>")
@app.put("/api/staff/<int:staff_id>")
def update_staff(staff_id: int):
    return _update(lambda data: db.update_staff(staff_id, data))


@app.delete("/api/treatments")
def delete_treatment():
    return _delete_from_body("treatment_id", db.delete_treatment, int)


@app.post("/api/rooms")
def create_room():
    return _create(db.create_room)


@app.get("/api/rooms")
def get_all_rooms():
    return jsonify(list(db.get_all_rooms())), 200


@app.get("/api/rooms/<int:room_id>")
def get_room(room_id: int):
    return _get(db.get_room(room_id))


@app.patch("/api/rooms/<int:room_id>")
@app.put("/api/rooms/<int:room_id>")
def update_room(room_id: int):
    return _update(lambda data: db.update_room(room_id, data))


@app.delete("/api/rooms")
def delete_room():
    return _delete_from_body("room_id", db.delete_room, int)


@app.post("/api/staff-specializations")
@app.post("/api/staff_specializations")
def create_staff_specialization():
    return _create(db.create_staff_specialization)


@app.get("/api/staff-specializations")
@app.get("/api/staff_specializations")
def get_all_staff_specializations():
    return jsonify(list(db.get_all_staff_specializations())), 200


@app.get("/api/staff-specializations/<int:staff_id>/<int:treatment_id>")
@app.get("/api/staff_specializations/<int:staff_id>/<int:treatment_id>")
def get_staff_specialization(staff_id: int, treatment_id: int):
    return _get(db.get_staff_specialization(staff_id, treatment_id))


@app.patch("/api/staff-specializations/<int:staff_id>/<int:treatment_id>")
@app.put("/api/staff-specializations/<int:staff_id>/<int:treatment_id>")
@app.patch("/api/staff_specializations/<int:staff_id>/<int:treatment_id>")
@app.put("/api/staff_specializations/<int:staff_id>/<int:treatment_id>")
def update_staff_specialization(staff_id: int, treatment_id: int):
    return _update(lambda data: db.update_staff_specialization(staff_id, treatment_id, data))


@app.delete("/api/staff-specializations/<int:staff_id>/<int:treatment_id>")
@app.delete("/api/staff_specializations/<int:staff_id>/<int:treatment_id>")
def delete_staff_specialization(staff_id: int, treatment_id: int):
    return _delete(lambda: db.delete_staff_specialization(staff_id, treatment_id))


@app.post("/api/staff-shifts")
@app.post("/api/staff_shifts")
def create_staff_shift():
    return _create(db.create_staff_shift)


@app.get("/api/staff-shifts")
@app.get("/api/staff_shifts")
def get_all_staff_shifts():
    return jsonify(list(db.get_all_staff_shifts())), 200


@app.get("/api/staff-shifts/<int:shift_id>")
@app.get("/api/staff_shifts/<int:shift_id>")
def get_staff_shift(shift_id: int):
    return _get(db.get_staff_shift(shift_id))


@app.patch("/api/staff-shifts/<int:shift_id>")
@app.put("/api/staff-shifts/<int:shift_id>")
@app.patch("/api/staff_shifts/<int:shift_id>")
@app.put("/api/staff_shifts/<int:shift_id>")
def update_staff_shift(shift_id: int):
    return _update(lambda data: db.update_staff_shift(shift_id, data))


@app.delete("/api/staff-shifts")
@app.delete("/api/staff_shifts")
def delete_staff_shift():
    return _delete_from_body("shift_id", db.delete_staff_shift, int)


@app.post("/api/weekly-capacity-limits")
@app.post("/api/weekly_capacity_limits")
def create_weekly_capacity_limit():
    return _create(db.create_weekly_capacity_limit)


@app.delete("/api/weekly-capacity-limits")
@app.delete("/api/weekly_capacity_limits")
def delete_weekly_capacity_limit():
    return _delete_from_body("weekday", db.delete_weekly_capacity_limit, int)


@app.get("/api/weekly-capacity-limits/<int:weekday>")
@app.get("/api/weekly_capacity_limits/<int:weekday>")
def get_weekly_capacity_limit(weekday: int):
    return _get(db.get_weekly_capacity_limit(weekday))


@app.patch("/api/weekly-capacity-limits/<int:weekday>")
@app.put("/api/weekly-capacity-limits/<int:weekday>")
@app.patch("/api/weekly_capacity_limits/<int:weekday>")
@app.put("/api/weekly_capacity_limits/<int:weekday>")
def update_weekly_capacity_limit(weekday: int):
    return _update(lambda data: db.update_weekly_capacity_limit(weekday, data))

@app.post("/api/appointments")
def create_appointment():
    return _create(db.create_appointment)


@app.get("/api/appointments")
def get_all_appointments():
    return jsonify(list(db.get_all_appointments())), 200


@app.get("/api/appointments/<int:appointment_id>")
def get_appointment(appointment_id: int):
    return _get(db.get_appointment(appointment_id))


@app.patch("/api/appointments/<int:appointment_id>")
@app.put("/api/appointments/<int:appointment_id>")
def update_appointment(appointment_id: int):
    return _update(lambda data: db.update_appointment(appointment_id, data))


@app.post("/api/planned-appointments")
@app.post("/api/planned_appointments")
def create_planned_appointment():
    return _create(db.create_planned_appointment)


@app.get("/api/planned-appointments")
@app.get("/api/planned_appointments")
def get_all_planned_appointments():
    return jsonify(list(db.get_all_planned_appointments())), 200


@app.get("/api/planned-appointments/<int:planned_appointment_id>")
@app.get("/api/planned_appointments/<int:planned_appointment_id>")
def get_planned_appointment(planned_appointment_id: int):
    return _get(db.get_planned_appointment(planned_appointment_id))


@app.patch("/api/planned-appointments/<int:planned_appointment_id>")
@app.put("/api/planned-appointments/<int:planned_appointment_id>")
@app.patch("/api/planned_appointments/<int:planned_appointment_id>")
@app.put("/api/planned_appointments/<int:planned_appointment_id>")
def update_planned_appointment(planned_appointment_id: int):
    return _update(lambda data: db.update_planned_appointment(planned_appointment_id, data))


@app.delete("/api/planned-appointments")
@app.delete("/api/planned_appointments")
def delete_planned_appointment():
    return _delete_from_body("planned_appointment_id", db.delete_planned_appointment, int)


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


HOURLY_RATE_USD = 300


def _week_start() -> date:
    raw = request.args.get("week_start")
    if raw:
        return date.fromisoformat(raw)

    today = date.today()
    return today - timedelta(days=today.weekday())


def _params(week_start: date) -> dict[str, Any]:
    return {
        "week_start": week_start.isoformat(),
        "hourly_rate": HOURLY_RATE_USD,
    }


def _dict(row: Any) -> dict[str, Any]:
    return dict(row) if row else {}


def _list(rows: Any) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def _week_meta(week_start: date) -> dict[str, str]:
    return {
        "week_start": week_start.isoformat(),
        "week_end": (week_start + timedelta(days=6)).isoformat(),
    }


def _get_refill_rate(week_start: date) -> dict[str, Any]:
    row = db.fetch_one(
        """
        SELECT
            COUNT(*)::INTEGER AS total_canceled_slots,
            COUNT(*) FILTER (WHERE ar.new_appointment_id IS NOT NULL)::INTEGER AS filled_slots,
            COUNT(*) FILTER (WHERE ar.new_appointment_id IS NULL)::INTEGER AS open_slots,
            COALESCE(
                COUNT(*) FILTER (WHERE ar.new_appointment_id IS NOT NULL)::NUMERIC
                / NULLIF(COUNT(*), 0),
                0
            ) AS refill_rate
        FROM appointment_refills ar
        JOIN appointments old_app
            ON old_app.id = ar.old_appointment_id
        WHERE old_app.start_time >= %(week_start)s::DATE
          AND old_app.start_time < (%(week_start)s::DATE + INTERVAL '7 days')
        """,
        _params(week_start),
    )

    return {**_week_meta(week_start), **_dict(row)}


def _get_revenue_recovered(week_start: date) -> dict[str, Any]:
    row = db.fetch_one(
        """
        SELECT
            COUNT(*)::INTEGER AS filled_slots,
            COALESCE(
                ROUND(SUM(EXTRACT(EPOCH FROM (new_app.end_time - new_app.start_time)) / 60)::NUMERIC, 2),
                0
            ) AS recovered_minutes,
            COALESCE(
                ROUND(
                    SUM(EXTRACT(EPOCH FROM (new_app.end_time - new_app.start_time)) / 3600)::NUMERIC
                    * %(hourly_rate)s,
                    2
                ),
                0
            ) AS revenue_recovered
        FROM appointment_refills ar
        JOIN appointments old_app
            ON old_app.id = ar.old_appointment_id
        JOIN appointments new_app
            ON new_app.id = ar.new_appointment_id
        WHERE old_app.start_time >= %(week_start)s::DATE
          AND old_app.start_time < (%(week_start)s::DATE + INTERVAL '7 days')
        """,
        _params(week_start),
    )

    return {**_week_meta(week_start), **_dict(row)}


def _get_attempts_per_slot(week_start: date) -> dict[str, Any]:
    row = db.fetch_one(
        """
        WITH weekly_refills AS (
            SELECT ar.uid
            FROM appointment_refills ar
            JOIN appointments old_app
                ON old_app.id = ar.old_appointment_id
            WHERE old_app.start_time >= %(week_start)s::DATE
              AND old_app.start_time < (%(week_start)s::DATE + INTERVAL '7 days')
        )
        SELECT
            COUNT(ra.uid)::INTEGER AS total_attempts,
            COALESCE(
                COUNT(ra.uid)::NUMERIC / NULLIF(COUNT(DISTINCT wr.uid), 0),
                0
            ) AS attempts_per_slot
        FROM weekly_refills wr
        LEFT JOIN refill_attempts ra
            ON ra.refill_uid = wr.uid
        """,
        _params(week_start),
    )

    return {**_week_meta(week_start), **_dict(row)}


def _get_resolved_outcomes(week_start: date) -> dict[str, Any]:
    row = db.fetch_one(
        """
        SELECT
            COUNT(*) FILTER (WHERE ar.new_appointment_id IS NOT NULL)::INTEGER AS resolved_outcomes
        FROM appointment_refills ar
        JOIN appointments old_app
            ON old_app.id = ar.old_appointment_id
        WHERE old_app.start_time >= %(week_start)s::DATE
          AND old_app.start_time < (%(week_start)s::DATE + INTERVAL '7 days')
        """,
        _params(week_start),
    )

    return {**_week_meta(week_start), **_dict(row)}


def _get_outcomes_by_reason(week_start: date) -> dict[str, Any]:
    rows = db.fetch_all(
        """
        WITH weekly_refills AS (
            SELECT ar.uid
            FROM appointment_refills ar
            JOIN appointments old_app
                ON old_app.id = ar.old_appointment_id
            WHERE old_app.start_time >= %(week_start)s::DATE
              AND old_app.start_time < (%(week_start)s::DATE + INTERVAL '7 days')
        )
        SELECT
            CASE
                WHEN ra.outcome = 'accepted'
                    THEN COALESCE(NULLIF(ra.outcome_reason, ''), 'Accepted earlier slot')
                WHEN ra.outcome = 'declined'
                    THEN COALESCE(NULLIF(ra.outcome_reason, ''), 'Declined time')
                WHEN ra.outcome = 'no_answer'
                    THEN COALESCE(NULLIF(ra.outcome_reason, ''), 'No answer')
                WHEN ra.outcome = 'calling'
                    THEN COALESCE(NULLIF(ra.outcome_reason, ''), 'Calling now')
                ELSE 'Unknown outcome'
            END AS reason,
            COUNT(*)::INTEGER AS count
        FROM weekly_refills wr
        JOIN refill_attempts ra
            ON ra.refill_uid = wr.uid
        GROUP BY reason
        ORDER BY count DESC, reason ASC
        """,
        _params(week_start),
    )

    outcomes = _list(rows)

    return {
        **_week_meta(week_start),
        "total_outcomes": sum(row["count"] for row in outcomes),
        "outcomes_by_reason": outcomes,
    }


def _get_daily_revenue(week_start: date) -> list[dict[str, Any]]:
    rows = db.fetch_all(
        """
        WITH days AS (
            SELECT generate_series(
                %(week_start)s::DATE,
                %(week_start)s::DATE + INTERVAL '6 days',
                INTERVAL '1 day'
            )::DATE AS day
        ),
        revenue AS (
            SELECT
                DATE(old_app.start_time) AS day,
                COALESCE(
                    ROUND(
                        SUM(EXTRACT(EPOCH FROM (new_app.end_time - new_app.start_time)) / 3600)::NUMERIC
                        * %(hourly_rate)s,
                        2
                    ),
                    0
                ) AS revenue
            FROM appointment_refills ar
            JOIN appointments old_app
                ON old_app.id = ar.old_appointment_id
            JOIN appointments new_app
                ON new_app.id = ar.new_appointment_id
            WHERE old_app.start_time >= %(week_start)s::DATE
              AND old_app.start_time < (%(week_start)s::DATE + INTERVAL '7 days')
            GROUP BY DATE(old_app.start_time)
        )
        SELECT
            days.day::TEXT AS date,
            TO_CHAR(days.day, 'Dy') AS label,
            COALESCE(revenue.revenue, 0) AS revenue
        FROM days
        LEFT JOIN revenue
            ON revenue.day = days.day
        ORDER BY days.day
        """,
        _params(week_start),
    )

    return _list(rows)


def _get_daily_attempts(week_start: date) -> list[dict[str, Any]]:
    rows = db.fetch_all(
        """
        WITH days AS (
            SELECT generate_series(
                %(week_start)s::DATE,
                %(week_start)s::DATE + INTERVAL '6 days',
                INTERVAL '1 day'
            )::DATE AS day
        ),
        attempts AS (
            SELECT
                DATE(old_app.start_time) AS day,
                COUNT(ra.uid)::INTEGER AS attempts
            FROM appointment_refills ar
            JOIN appointments old_app
                ON old_app.id = ar.old_appointment_id
            LEFT JOIN refill_attempts ra
                ON ra.refill_uid = ar.uid
            WHERE old_app.start_time >= %(week_start)s::DATE
              AND old_app.start_time < (%(week_start)s::DATE + INTERVAL '7 days')
            GROUP BY DATE(old_app.start_time)
        )
        SELECT
            days.day::TEXT AS date,
            TO_CHAR(days.day, 'Dy') AS label,
            COALESCE(attempts.attempts, 0)::INTEGER AS attempts
        FROM days
        LEFT JOIN attempts
            ON attempts.day = days.day
        ORDER BY days.day
        """,
        _params(week_start),
    )

    return _list(rows)


@app.get("/api/live-operations")
def get_live_operations() -> tuple[Any, int]:
    week_start = _week_start()

    refill_rate = _get_refill_rate(week_start)
    revenue = _get_revenue_recovered(week_start)
    attempts = _get_attempts_per_slot(week_start)
    outcomes = _get_outcomes_by_reason(week_start)
    resolved = _get_resolved_outcomes(week_start)

    return jsonify({
        **_week_meta(week_start),
        "updated_at": date.today().isoformat(),
        "total_canceled_slots": refill_rate["total_canceled_slots"],
        "filled_slots": refill_rate["filled_slots"],
        "open_slots": refill_rate["open_slots"],
        "refill_rate": float(refill_rate["refill_rate"]),
        "revenue_recovered": float(revenue["revenue_recovered"]),
        "recovered_minutes": float(revenue["recovered_minutes"]),
        "total_attempts": attempts["total_attempts"],
        "attempts_per_slot": float(attempts["attempts_per_slot"]),
        "resolved_outcomes": resolved["resolved_outcomes"],
        "daily_revenue": _get_daily_revenue(week_start),
        "daily_attempts": _get_daily_attempts(week_start),
        "outcomes_by_reason": outcomes["outcomes_by_reason"],
    }), 200


@app.get("/api/live-operations/refill-rate")
def get_live_operations_refill_rate() -> tuple[Any, int]:
    return jsonify(_get_refill_rate(_week_start())), 200


@app.get("/api/live-operations/revenue-recovered")
def get_live_operations_revenue_recovered() -> tuple[Any, int]:
    week_start = _week_start()
    return jsonify({
        **_get_revenue_recovered(week_start),
        "daily_revenue": _get_daily_revenue(week_start),
    }), 200


@app.get("/api/live-operations/attempts-per-slot")
def get_live_operations_attempts_per_slot() -> tuple[Any, int]:
    week_start = _week_start()
    return jsonify({
        **_get_attempts_per_slot(week_start),
        "daily_attempts": _get_daily_attempts(week_start),
    }), 200


@app.get("/api/live-operations/outcomes-by-reason")
def get_live_operations_outcomes_by_reason() -> tuple[Any, int]:
    return jsonify(_get_outcomes_by_reason(_week_start())), 200


@app.get("/api/live-operations/resolved-outcomes")
def get_live_operations_resolved_outcomes() -> tuple[Any, int]:
    return jsonify(_get_resolved_outcomes(_week_start())), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5001")), debug=True)
