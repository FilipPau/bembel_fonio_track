"""Flask app for explicit database CRUD operations."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Callable, Mapping, Optional

from flask import Flask, jsonify, request

import db
from db import db_healthcheck


app = Flask(__name__)


def _sqlstate(exc: BaseException) -> str | None:
    return getattr(exc, "sqlstate", None) or getattr(exc, "pgcode", None)


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
    return jsonify({"error": "Database operation failed", "details": str(exc)}), 500


def _json_payload() -> Mapping[str, Any]:
    return request.get_json(silent=True) or {}


def _create(handler: Callable[[Mapping[str, Any]], Mapping[str, Any] | None]):
    try:
        row = handler(_json_payload())
    except KeyError as exc:
        return jsonify({"error": "Missing field", "field": str(exc).strip("'")}), 400
    except Exception as exc:  # pragma: no cover - driver-specific behavior
        return _database_error_response(exc)
    return jsonify(row), 201


def _update(handler: Callable[[Mapping[str, Any]], Mapping[str, Any] | None]):
    try:
        row = handler(_json_payload())
    except Exception as exc:  # pragma: no cover - driver-specific behavior
        return _database_error_response(exc)
    if not row:
        return jsonify({"error": "Resource not found"}), 404
    return jsonify(row), 200


def _delete(handler: Callable[[], int]):
    try:
        deleted = handler()
    except Exception as exc:  # pragma: no cover - driver-specific behavior
        return _database_error_response(exc)
    if deleted == 0:
        return jsonify({"error": "Resource not found"}), 404
    return "", 204


def _get(row: Mapping[str, Any] | None):
    if not row:
        return jsonify({"error": "Resource not found"}), 404
    return jsonify(row), 200


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


@app.delete("/api/customers/<social_security_number>")
def delete_customer(social_security_number: str):
    return _delete(lambda: db.delete_customer(social_security_number))


@app.post("/api/shane/customers-by-number")
def shane_customers_by_number():
    payload = _json_payload()
    from_number = payload.get("fromNumber")
    if not from_number:
        return jsonify({"error": "Missing field", "field": "fromNumber"}), 400

    customers = list(db.find_customers_by_phone_number(from_number))

    if len(customers) == 1:
        return jsonify(customers[0]), 200
    else:
        return jsonify({}), 404


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
    if staff_id_raw:
        try:
            staff_id = int(staff_id_raw)
        except ValueError:
            return jsonify({"error": "Invalid field", "field": "staff_id"}), 400

    search_from = None
    if search_from_raw:
        try:
            search_from = datetime.fromisoformat(search_from_raw.replace("Z", "+00:00"))
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
            search_from = datetime.fromisoformat(search_from_raw.replace("Z", "+00:00"))
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


@app.delete("/api/treatments/<int:treatment_id>")
def delete_treatment(treatment_id: int):
    return _delete(lambda: db.delete_treatment(treatment_id))


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


@app.delete("/api/staff/<int:staff_id>")
def delete_staff(staff_id: int):
    return _delete(lambda: db.delete_staff(staff_id))


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


@app.delete("/api/rooms/<int:room_id>")
def delete_room(room_id: int):
    return _delete(lambda: db.delete_room(room_id))


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


@app.delete("/api/staff-shifts/<int:shift_id>")
@app.delete("/api/staff_shifts/<int:shift_id>")
def delete_staff_shift(shift_id: int):
    return _delete(lambda: db.delete_staff_shift(shift_id))


@app.post("/api/weekly-capacity-limits")
@app.post("/api/weekly_capacity_limits")
def create_weekly_capacity_limit():
    return _create(db.create_weekly_capacity_limit)


@app.get("/api/weekly-capacity-limits")
@app.get("/api/weekly_capacity_limits")
def get_all_weekly_capacity_limits():
    return jsonify(list(db.get_all_weekly_capacity_limits())), 200


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


@app.delete("/api/weekly-capacity-limits/<int:weekday>")
@app.delete("/api/weekly_capacity_limits/<int:weekday>")
def delete_weekly_capacity_limit(weekday: int):
    return _delete(lambda: db.delete_weekly_capacity_limit(weekday))


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


@app.delete("/api/appointments/<int:appointment_id>")
def delete_appointment(appointment_id: int):
    return _delete(lambda: db.delete_appointment(appointment_id))


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


@app.delete("/api/planned-appointments/<int:planned_appointment_id>")
@app.delete("/api/planned_appointments/<int:planned_appointment_id>")
def delete_planned_appointment(planned_appointment_id: int):
    return _delete(lambda: db.delete_planned_appointment(planned_appointment_id))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
