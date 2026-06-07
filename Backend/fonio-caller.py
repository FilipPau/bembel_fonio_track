import os
import requests


def fonio_termin_verschieben(
    to_number: str,
    agent_id: str,
    first_name: str,
    last_name: str,
    birth_date: str,
    social_security_number: str,
    current_appointment: str,
    requested_appointment: str,
    timeout: int = 20
) -> dict:
    url = "https://app.fonio.ai/api/public/v1/outbound_call"

    api_key = os.environ["FONIO_API_KEY"]
    from_number = os.environ["FONIO_FROM_NUMBER"]

    payload = {
        "apiKey": api_key,
        "fromNumber": from_number,
        "toNumber": to_number,
        "agentId": agent_id,
        "context": {
            "first_name": first_name,
            "last_name": last_name,
            "birth_date": birth_date,
            "social_security_number": social_security_number,
            "current_appointment": current_appointment,
            "requested_appointment": requested_appointment
        }
    }

    response = requests.post(
        url,
        json=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        timeout=timeout
    )

    try:
        data = response.json()
    except ValueError:
        data = {"raw": response.text}

    return {
        "ok": response.ok,
        "status_code": response.status_code,
        "response": data
    }


result = fonio_termin_verschieben(
    to_number="+436642144008",
    agent_id="aea9de0a-796e-41c7-83b1-0882d43fc09f",
    first_name="Bembel",
    last_name="Boiii",
    birth_date="2003-01-01",
    social_security_number="1001010101",
    current_appointment="2026-06-09T11:00:00+00:00",
    requested_appointment="2026-06-04T14:30:00+00:00"
)

print(result)