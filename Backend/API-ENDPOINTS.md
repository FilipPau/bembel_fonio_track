# API Endpoints

Base URL:

```text
http://localhost:5000
```

## Health

| Method | Endpoint | Beschreibung |
|---|---|---|
| GET | `/health` | Prueft, ob Backend und Datenbank erreichbar sind. |

## Legacy Kunden-Endpunkte

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/kunden` | Erstellt einen Kunden. |
| GET | `/kunden` | Gibt alle Kunden zurueck. |
| GET | `/kunden/getall` | Gibt alle Kunden zurueck. |
| GET | `/kunden/<social_security_number>` | Gibt einen Kunden anhand der Sozialversicherungsnummer zurueck. |
| GET | `/kunden/get/<social_security_number>` | Gibt einen Kunden anhand der Sozialversicherungsnummer zurueck. |
| PUT | `/kunden/<social_security_number>` | Aktualisiert einen Kunden vollstaendig oder teilweise. |
| PATCH | `/kunden/<social_security_number>` | Aktualisiert einzelne Kundenfelder. |
| DELETE | `/kunden/<social_security_number>` | Loescht einen Kunden. |
| DELETE | `/kunden/delete/<social_security_number>` | Loescht einen Kunden. |

## Customers

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/api/customers` | Erstellt einen Kunden. |
| GET | `/api/customers` | Gibt alle Kunden zurueck. |
| GET | `/api/customers/<social_security_number>` | Gibt einen Kunden anhand der Sozialversicherungsnummer zurueck. |
| PUT | `/api/customers/<social_security_number>` | Aktualisiert einen Kunden vollstaendig oder teilweise. |
| PATCH | `/api/customers/<social_security_number>` | Aktualisiert einzelne Kundenfelder. |
| DELETE | `/api/customers/<social_security_number>` | Loescht einen Kunden. |

## Shane

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/api/shane/customers-by-number` | Sucht Kunden anhand von `fromNumber` aus dem JSON-Body und gibt immer ein Array zurueck. `toNumber` wird ignoriert. |

Request Body:

```json
{
  "fromNumber": "{{fromNumber}}",
  "toNumber": "{{toNumber}}"
}
```

Beispiel:

```http
POST http://localhost:5000/api/shane/customers-by-number
Content-Type: application/json

{
  "fromNumber": "+43 660 100100",
  "toNumber": "irrelevant"
}
```

Antwort:

```json
[
  {
    "social_security_number": "1001010101",
    "first_name": "Lena",
    "last_name": "Fischer",
    "birth_date": "1990-01-10",
    "phone_number": "+43 660 100100"
  }
]
```

Wenn kein Kunde gefunden wird:

```json
[]
```

## Treatments

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/api/treatments` | Erstellt eine Behandlung. |
| GET | `/api/treatments` | Gibt alle Behandlungen zurueck. |
| GET | `/api/treatments/<treatment_id>` | Gibt eine Behandlung anhand der ID zurueck. |
| PUT | `/api/treatments/<treatment_id>` | Aktualisiert eine Behandlung vollstaendig oder teilweise. |
| PATCH | `/api/treatments/<treatment_id>` | Aktualisiert einzelne Behandlungsfelder. |
| DELETE | `/api/treatments/<treatment_id>` | Loescht eine Behandlung. |

## Staff

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/api/staff` | Erstellt einen Mitarbeiter. |
| GET | `/api/staff` | Gibt alle Mitarbeiter zurueck. |
| GET | `/api/staff/<staff_id>` | Gibt einen Mitarbeiter anhand der ID zurueck. |
| PUT | `/api/staff/<staff_id>` | Aktualisiert einen Mitarbeiter vollstaendig oder teilweise. |
| PATCH | `/api/staff/<staff_id>` | Aktualisiert einzelne Mitarbeiterfelder. |
| DELETE | `/api/staff/<staff_id>` | Loescht einen Mitarbeiter. |

## Rooms

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/api/rooms` | Erstellt einen Raum. |
| GET | `/api/rooms` | Gibt alle Raeume zurueck. |
| GET | `/api/rooms/<room_id>` | Gibt einen Raum anhand der ID zurueck. |
| PUT | `/api/rooms/<room_id>` | Aktualisiert einen Raum vollstaendig oder teilweise. |
| PATCH | `/api/rooms/<room_id>` | Aktualisiert einzelne Raumfelder. |
| DELETE | `/api/rooms/<room_id>` | Loescht einen Raum. |

## Staff Specializations

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/api/staff-specializations` | Weist einem Mitarbeiter eine Behandlung/Spezialisierung zu. |
| GET | `/api/staff-specializations` | Gibt alle Mitarbeiter-Spezialisierungen zurueck. |
| GET | `/api/staff-specializations/<staff_id>/<treatment_id>` | Gibt eine konkrete Mitarbeiter-Spezialisierung zurueck. |
| PUT | `/api/staff-specializations/<staff_id>/<treatment_id>` | Aktualisiert eine Mitarbeiter-Spezialisierung. |
| PATCH | `/api/staff-specializations/<staff_id>/<treatment_id>` | Aktualisiert eine Mitarbeiter-Spezialisierung. |
| DELETE | `/api/staff-specializations/<staff_id>/<treatment_id>` | Entfernt eine Mitarbeiter-Spezialisierung. |

Alias:

```text
/api/staff_specializations
```

## Staff Shifts

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/api/staff-shifts` | Erstellt eine Dienstzeit mit Mitarbeiter, Raum, Start und Ende. |
| GET | `/api/staff-shifts` | Gibt alle Dienstzeiten zurueck. |
| GET | `/api/staff-shifts/<shift_id>` | Gibt eine Dienstzeit anhand der ID zurueck. |
| PUT | `/api/staff-shifts/<shift_id>` | Aktualisiert eine Dienstzeit vollstaendig oder teilweise. |
| PATCH | `/api/staff-shifts/<shift_id>` | Aktualisiert einzelne Dienstzeitfelder. |
| DELETE | `/api/staff-shifts/<shift_id>` | Loescht eine Dienstzeit. |

Alias:

```text
/api/staff_shifts
```

## Weekly Capacity Limits

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/api/weekly-capacity-limits` | Erstellt ein Wochenlimit fuer einen Wochentag. |
| GET | `/api/weekly-capacity-limits` | Gibt alle Wochenlimits zurueck. |
| GET | `/api/weekly-capacity-limits/<weekday>` | Gibt das Wochenlimit eines Wochentags zurueck. |
| PUT | `/api/weekly-capacity-limits/<weekday>` | Aktualisiert ein Wochenlimit. |
| PATCH | `/api/weekly-capacity-limits/<weekday>` | Aktualisiert die maximalen Minuten eines Wochentags. |
| DELETE | `/api/weekly-capacity-limits/<weekday>` | Loescht ein Wochenlimit. |

Alias:

```text
/api/weekly_capacity_limits
```

Wochentage:

```text
1 = Montag
2 = Dienstag
3 = Mittwoch
4 = Donnerstag
5 = Freitag
6 = Samstag
7 = Sonntag
```

## Appointments

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/api/appointments` | Erstellt einen konkreten Termin mit Kunde, Mitarbeiter, Raum, Behandlung, Startzeit, Endzeit und Status. |
| GET | `/api/appointments` | Gibt alle konkreten Termine zurueck. |
| GET | `/api/appointments/<appointment_id>` | Gibt einen konkreten Termin anhand der ID zurueck. |
| PUT | `/api/appointments/<appointment_id>` | Aktualisiert einen konkreten Termin vollstaendig oder teilweise. |
| PATCH | `/api/appointments/<appointment_id>` | Aktualisiert einzelne Terminfelder, z. B. Status. |
| DELETE | `/api/appointments/<appointment_id>` | Loescht einen konkreten Termin. |

Statuswerte:

```text
scheduled
canceled
completed
```

## Planned Appointments

| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/api/planned-appointments` | Erstellt einen langfristig geplanten Termin ohne Mitarbeiter, Raum und Uhrzeit. |
| GET | `/api/planned-appointments` | Gibt alle langfristig geplanten Termine zurueck. |
| GET | `/api/planned-appointments/<planned_appointment_id>` | Gibt einen langfristig geplanten Termin anhand der ID zurueck. |
| PUT | `/api/planned-appointments/<planned_appointment_id>` | Aktualisiert einen langfristig geplanten Termin vollstaendig oder teilweise. |
| PATCH | `/api/planned-appointments/<planned_appointment_id>` | Aktualisiert einzelne Felder eines langfristig geplanten Termins. |
| DELETE | `/api/planned-appointments/<planned_appointment_id>` | Loescht einen langfristig geplanten Termin. |

Alias:

```text
/api/planned_appointments
```
