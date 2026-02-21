"""Scheduling system for recurring automatic validations."""

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import REPORTS_DIR

DATA_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DATA_DIR / "schedules.db"

_scheduler: Optional[BackgroundScheduler] = None


def _get_db() -> sqlite3.Connection:
    """Get a connection to the schedules database."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _init_db():
    """Create tables if they don't exist."""
    conn = _get_db()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS schedules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                brand_filter TEXT,
                cron_expression TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                last_run TEXT,
                next_run TEXT
            );

            CREATE TABLE IF NOT EXISTS schedule_history (
                id TEXT PRIMARY KEY,
                schedule_id TEXT NOT NULL,
                run_date TEXT NOT NULL,
                status TEXT NOT NULL,
                summary TEXT,
                report_file TEXT,
                FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
            );
        """)
        conn.commit()
    finally:
        conn.close()


def _schedule_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Convert a database row to a schedule dict."""
    return {
        "id": row["id"],
        "name": row["name"],
        "brand_filter": row["brand_filter"],
        "cron_expression": row["cron_expression"],
        "enabled": bool(row["enabled"]),
        "created_at": row["created_at"],
        "last_run": row["last_run"],
        "next_run": row["next_run"],
    }


def _history_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Convert a history row to a dict."""
    summary = row["summary"]
    if summary:
        try:
            summary = json.loads(summary)
        except (json.JSONDecodeError, TypeError):
            pass
    return {
        "id": row["id"],
        "schedule_id": row["schedule_id"],
        "run_date": row["run_date"],
        "status": row["status"],
        "summary": summary,
        "report_file": row["report_file"],
    }


def _parse_cron(cron_expression: str) -> CronTrigger:
    """Parse a cron expression into an APScheduler CronTrigger.

    Supports:
    - Standard 5-field cron: "minute hour day month day_of_week"
    - Presets: "daily", "weekly", "monthly"
    """
    presets = {
        "daily": "0 6 * * *",
        "weekly": "0 6 * * 1",
        "monthly": "0 6 1 * *",
    }
    cron_str = presets.get(cron_expression.lower(), cron_expression)
    parts = cron_str.split()
    if len(parts) != 5:
        raise ValueError(
            f"Invalid cron expression '{cron_expression}': expected 5 fields "
            "(minute hour day month day_of_week) or a preset (daily/weekly/monthly)"
        )
    return CronTrigger(
        minute=parts[0],
        hour=parts[1],
        day=parts[2],
        month=parts[3],
        day_of_week=parts[4],
    )


def _run_scheduled_validation(schedule_id: str):
    """Execute a scheduled validation run."""
    from .scraper import VTEXScraper, extract_cert_text
    from .comparator import compare_texts
    from .models import ValidationStatus, ValidationResult
    from .report_generator import generate_reports

    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT * FROM schedules WHERE id = ?", (schedule_id,)
        ).fetchone()
        if not row:
            return
        brand_filter_str = row["brand_filter"]
    finally:
        conn.close()

    # Load products
    brand_filter = None
    if brand_filter_str:
        from .models import Brand
        brand_map = {
            "imaginarium": Brand.IMAGINARIUM,
            "puket": Brand.PUKET,
            "puket_escolares": Brand.PUKET_ESCOLARES,
        }
        brand_filter = brand_map.get(brand_filter_str.lower())

    try:
        from .sheets_reader import read_products_from_sheets
        products = read_products_from_sheets(brand_filter=brand_filter)
    except Exception:
        try:
            from .excel_reader import read_products
            products = read_products(brand_filter=brand_filter)
        except Exception as e:
            _record_history(schedule_id, "error", {"error": str(e)}, None)
            return

    scraper = VTEXScraper()
    results: List[ValidationResult] = []
    result_dicts: List[Dict[str, Any]] = []
    import time
    from .config import REQUEST_DELAY

    for i, product in enumerate(products):
        result = _validate_product(product, scraper)
        results.append(result)
        result_dicts.append({
            "sku": result.product.sku,
            "name": result.product.name,
            "brand": result.product.brand.value,
            "status": result.status.value,
            "score": round(result.similarity_score, 2),
            "actual_cert_text": result.actual_cert_text,
            "expected_cert_text": result.product.expected_cert_text,
            "url": result.product.resolved_url,
            "error": result.error_message,
        })
        if i < len(products) - 1:
            time.sleep(REQUEST_DELAY)

    # Generate reports
    try:
        report_path = generate_reports(results)
    except Exception:
        report_path = None

    # Save JSON report
    summary = _build_summary(result_dicts)
    run_id = str(uuid.uuid4())
    json_data = {
        "run_id": run_id,
        "schedule_id": schedule_id,
        "date": datetime.now().isoformat(),
        "summary": summary,
        "results": result_dicts,
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    json_filename = f"schedule_{schedule_id[:8]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    json_path = REPORTS_DIR / json_filename
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)

    report_file = report_path.name if report_path else json_filename
    _record_history(schedule_id, "completed", summary, report_file)

    # Update last_run on the schedule
    conn = _get_db()
    try:
        conn.execute(
            "UPDATE schedules SET last_run = ? WHERE id = ?",
            (datetime.now().isoformat(), schedule_id),
        )
        conn.commit()
    finally:
        conn.close()

    _update_next_run(schedule_id)


def _validate_product(product, scraper):
    """Validate a single product (mirrors api_server._validate_single without AI)."""
    from .models import ValidationStatus, ValidationResult
    from .scraper import extract_cert_text
    from .comparator import compare_texts

    if not product.expected_cert_text:
        return ValidationResult(
            product=product,
            status=ValidationStatus.NO_EXPECTED,
            error_message="Sem texto de certificacao esperado na planilha",
        )

    try:
        full_desc, cert_text = scraper.fetch_product_description(product)
    except Exception as e:
        return ValidationResult(
            product=product,
            status=ValidationStatus.API_ERROR,
            error_message=str(e),
        )

    if full_desc is None:
        return ValidationResult(
            product=product,
            status=ValidationStatus.URL_NOT_FOUND,
            error_message="Produto nao encontrado na API VTEX",
        )

    if not cert_text and full_desc:
        cert_text = extract_cert_text(full_desc)

    if not cert_text and full_desc and product.expected_cert_text:
        if product.expected_cert_text.lower() in full_desc.lower():
            cert_text = product.expected_cert_text

    status, score = compare_texts(product.expected_cert_text, cert_text)

    return ValidationResult(
        product=product,
        status=status,
        actual_cert_text=cert_text,
        similarity_score=score,
    )


def _build_summary(results: list) -> dict:
    """Build summary counts from result dicts."""
    total = len(results)
    ok = sum(1 for r in results if r["status"] == "OK")
    missing = sum(1 for r in results if r["status"] == "MISSING")
    inconsistent = sum(1 for r in results if r["status"] == "INCONSISTENT")
    not_found = sum(1 for r in results if r["status"] == "URL_NOT_FOUND")
    return {
        "ok": ok,
        "missing": missing,
        "inconsistent": inconsistent,
        "not_found": not_found,
        "total": total,
    }


def _record_history(schedule_id: str, status: str, summary, report_file: Optional[str]):
    """Record a schedule run in history."""
    conn = _get_db()
    try:
        conn.execute(
            """INSERT INTO schedule_history (id, schedule_id, run_date, status, summary, report_file)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                str(uuid.uuid4()),
                schedule_id,
                datetime.now().isoformat(),
                status,
                json.dumps(summary) if isinstance(summary, dict) else summary,
                report_file,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def _update_next_run(schedule_id: str):
    """Update the next_run field based on the APScheduler job."""
    if _scheduler is None:
        return
    job = _scheduler.get_job(schedule_id)
    if job and job.next_run_time:
        next_run = job.next_run_time.isoformat()
    else:
        next_run = None
    conn = _get_db()
    try:
        conn.execute(
            "UPDATE schedules SET next_run = ? WHERE id = ?",
            (next_run, schedule_id),
        )
        conn.commit()
    finally:
        conn.close()


# ---------- Public API ----------


def init_scheduler():
    """Initialize the scheduler, create DB tables, and restore persisted schedules."""
    global _scheduler
    _init_db()
    _scheduler = BackgroundScheduler()
    _scheduler.start()

    # Restore enabled schedules from the database
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM schedules WHERE enabled = 1"
        ).fetchall()
    finally:
        conn.close()

    for row in rows:
        try:
            trigger = _parse_cron(row["cron_expression"])
            _scheduler.add_job(
                _run_scheduled_validation,
                trigger=trigger,
                args=[row["id"]],
                id=row["id"],
                replace_existing=True,
            )
            _update_next_run(row["id"])
        except Exception:
            pass


def shutdown_scheduler():
    """Shut down the scheduler gracefully."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def list_schedules() -> List[Dict[str, Any]]:
    """Return all schedules."""
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM schedules ORDER BY created_at DESC"
        ).fetchall()
        return [_schedule_to_dict(r) for r in rows]
    finally:
        conn.close()


def get_schedule(schedule_id: str) -> Optional[Dict[str, Any]]:
    """Return a single schedule by ID."""
    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT * FROM schedules WHERE id = ?", (schedule_id,)
        ).fetchone()
        return _schedule_to_dict(row) if row else None
    finally:
        conn.close()


def create_schedule(
    name: str,
    cron_expression: str,
    brand_filter: Optional[str] = None,
    enabled: bool = True,
) -> Dict[str, Any]:
    """Create a new schedule and register it with APScheduler."""
    # Validate cron expression
    trigger = _parse_cron(cron_expression)

    schedule_id = str(uuid.uuid4())
    now = datetime.now().isoformat()

    conn = _get_db()
    try:
        conn.execute(
            """INSERT INTO schedules (id, name, brand_filter, cron_expression, enabled, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (schedule_id, name, brand_filter, cron_expression, int(enabled), now),
        )
        conn.commit()
    finally:
        conn.close()

    if enabled and _scheduler:
        _scheduler.add_job(
            _run_scheduled_validation,
            trigger=trigger,
            args=[schedule_id],
            id=schedule_id,
            replace_existing=True,
        )
        _update_next_run(schedule_id)

    return get_schedule(schedule_id)


def update_schedule(
    schedule_id: str,
    name: Optional[str] = None,
    cron_expression: Optional[str] = None,
    brand_filter: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """Update an existing schedule."""
    existing = get_schedule(schedule_id)
    if not existing:
        return None

    updates = []
    params = []
    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if cron_expression is not None:
        _parse_cron(cron_expression)  # validate
        updates.append("cron_expression = ?")
        params.append(cron_expression)
    if brand_filter is not None:
        updates.append("brand_filter = ?")
        params.append(brand_filter if brand_filter else None)
    if enabled is not None:
        updates.append("enabled = ?")
        params.append(int(enabled))

    if not updates:
        return existing

    params.append(schedule_id)
    conn = _get_db()
    try:
        conn.execute(
            f"UPDATE schedules SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        conn.commit()
    finally:
        conn.close()

    # Update APScheduler job
    if _scheduler:
        # Remove existing job
        try:
            _scheduler.remove_job(schedule_id)
        except Exception:
            pass

        updated = get_schedule(schedule_id)
        if updated and updated["enabled"]:
            try:
                trigger = _parse_cron(updated["cron_expression"])
                _scheduler.add_job(
                    _run_scheduled_validation,
                    trigger=trigger,
                    args=[schedule_id],
                    id=schedule_id,
                    replace_existing=True,
                )
                _update_next_run(schedule_id)
            except Exception:
                pass
        else:
            # Disabled, clear next_run
            conn = _get_db()
            try:
                conn.execute(
                    "UPDATE schedules SET next_run = NULL WHERE id = ?",
                    (schedule_id,),
                )
                conn.commit()
            finally:
                conn.close()

    return get_schedule(schedule_id)


def delete_schedule(schedule_id: str) -> bool:
    """Delete a schedule and its APScheduler job."""
    existing = get_schedule(schedule_id)
    if not existing:
        return False

    if _scheduler:
        try:
            _scheduler.remove_job(schedule_id)
        except Exception:
            pass

    conn = _get_db()
    try:
        conn.execute("DELETE FROM schedule_history WHERE schedule_id = ?", (schedule_id,))
        conn.execute("DELETE FROM schedules WHERE id = ?", (schedule_id,))
        conn.commit()
    finally:
        conn.close()

    return True


def trigger_run(schedule_id: str) -> bool:
    """Manually trigger a schedule to run now."""
    existing = get_schedule(schedule_id)
    if not existing:
        return False

    import threading
    thread = threading.Thread(
        target=_run_scheduled_validation,
        args=(schedule_id,),
        daemon=True,
    )
    thread.start()
    return True


def get_history(schedule_id: str) -> List[Dict[str, Any]]:
    """Return run history for a schedule."""
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM schedule_history WHERE schedule_id = ? ORDER BY run_date DESC",
            (schedule_id,),
        ).fetchall()
        return [_history_to_dict(r) for r in rows]
    finally:
        conn.close()
