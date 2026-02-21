"""FastAPI backend wrapping the certification validation system."""

import asyncio
import json
import os
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from .config import REPORTS_DIR, REQUEST_DELAY, GOOGLE_CREDENTIALS_FILE
from .models import Brand, ValidationStatus, ValidationResult
from .scraper import VTEXScraper, extract_cert_text
from .comparator import compare_texts
from .report_generator import generate_reports
from . import scheduler as sched_module

app = FastAPI(
    title="Verificacao Certificacao API",
    description="API for e-commerce certification validation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for validation runs
validation_runs: Dict[str, Dict[str, Any]] = {}

BRAND_CHOICES = {
    "imaginarium": Brand.IMAGINARIUM,
    "puket": Brand.PUKET,
    "puket_escolares": Brand.PUKET_ESCOLARES,
}


# ---------- Pydantic models ----------

class ValidateRequest(BaseModel):
    brand: Optional[str] = None
    limit: Optional[int] = None
    ai_verify: bool = False
    source: Optional[str] = "sheets"


class VerifyRequest(BaseModel):
    sku: str
    brand: str


class ProductResponse(BaseModel):
    sku: str
    name: str
    brand: str
    expected_cert_text: Optional[str]
    excel_row: int


class ValidateStartResponse(BaseModel):
    run_id: str
    total_products: int


class RunStatusResponse(BaseModel):
    run_id: str
    status: str
    progress: Dict[str, int]
    results: List[Dict[str, Any]]


class ScheduleCreateRequest(BaseModel):
    name: str
    cron: str
    brand: Optional[str] = None
    enabled: bool = True


class ScheduleUpdateRequest(BaseModel):
    name: Optional[str] = None
    cron: Optional[str] = None
    brand: Optional[str] = None
    enabled: Optional[bool] = None


# ---------- Lifecycle events ----------

@app.on_event("startup")
def on_startup():
    """Initialize the background scheduler on app startup."""
    sched_module.init_scheduler()


@app.on_event("shutdown")
def on_shutdown():
    """Shut down the scheduler gracefully."""
    sched_module.shutdown_scheduler()


# ---------- Helper functions ----------

def _product_to_dict(p) -> dict:
    return {
        "sku": p.sku,
        "name": p.name,
        "brand": p.brand.value,
        "expected_cert_text": p.expected_cert_text,
        "excel_row": p.excel_row,
    }


def _result_to_dict(r: ValidationResult) -> dict:
    return {
        "sku": r.product.sku,
        "name": r.product.name,
        "brand": r.product.brand.value,
        "status": r.status.value,
        "score": round(r.similarity_score, 2),
        "actual_cert_text": r.actual_cert_text,
        "expected_cert_text": r.product.expected_cert_text,
        "url": r.product.resolved_url,
        "error": r.error_message,
        "ai_assessment": r.ai_assessment,
    }


def _load_products(source: str = "sheets", brand_filter=None) -> list:
    """Load products from Google Sheets or Excel."""
    if source == "sheets":
        from .sheets_reader import read_products_from_sheets
        return read_products_from_sheets(brand_filter=brand_filter)
    else:
        from .excel_reader import read_products
        return read_products(brand_filter=brand_filter)


def _validate_single(product, scraper, ai_verify) -> ValidationResult:
    """Validate a single product (reuses logic from main.py)."""
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

    result = ValidationResult(
        product=product,
        status=status,
        actual_cert_text=cert_text,
        similarity_score=score,
    )

    if ai_verify and status == ValidationStatus.INCONSISTENT:
        from .ai_verifier import verify_with_ai, is_ai_available
        if is_ai_available():
            try:
                is_match, confidence, explanation = verify_with_ai(
                    product.expected_cert_text, cert_text
                )
                result.ai_assessment = explanation
                if is_match and confidence >= 0.8:
                    result.status = ValidationStatus.OK
                    result.similarity_score = confidence
            except Exception as e:
                result.ai_assessment = f"AI error: {e}"

    return result


def _run_validation(run_id: str, products: list, ai_verify: bool, loop: asyncio.AbstractEventLoop):
    """Background thread function that runs the full validation."""
    run = validation_runs[run_id]
    scraper = VTEXScraper()
    total = len(products)

    try:
        for i, product in enumerate(products):
            result = _validate_single(product, scraper, ai_verify)
            result_dict = _result_to_dict(result)

            run["results"].append(result_dict)
            run["validation_results"].append(result)
            run["progress"]["current"] = i + 1

            event = {
                "type": "progress",
                "current": i + 1,
                "total": total,
                "product": {
                    "sku": result_dict["sku"],
                    "name": result_dict["name"],
                    "status": result_dict["status"],
                    "score": result_dict["score"],
                },
            }
            asyncio.run_coroutine_threadsafe(run["events"].put(event), loop)

            if i < total - 1:
                time.sleep(REQUEST_DELAY)

        # Generate reports
        report_path = generate_reports(run["validation_results"])

        # Also save JSON results
        json_path = report_path.with_suffix(".json")
        summary = _build_summary(run["results"])
        json_data = {
            "run_id": run_id,
            "date": datetime.now().isoformat(),
            "summary": summary,
            "results": run["results"],
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)

        run["status"] = "completed"
        run["report_file"] = report_path.name

        complete_event = {
            "type": "complete",
            "summary": summary,
            "report_file": report_path.name,
        }
        asyncio.run_coroutine_threadsafe(run["events"].put(complete_event), loop)

    except Exception as e:
        run["status"] = "error"
        run["error"] = str(e)
        error_event = {"type": "error", "message": str(e)}
        asyncio.run_coroutine_threadsafe(run["events"].put(error_event), loop)


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


def _load_last_validation_map() -> tuple[Optional[str], Dict[str, Dict[str, Any]]]:
    """Load the most recent JSON report and return (date, {sku: result_dict})."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    json_files = sorted(REPORTS_DIR.glob("*.json"), reverse=True)
    if not json_files:
        return None, {}
    try:
        with open(json_files[0], "r", encoding="utf-8") as f:
            report_data = json.load(f)
        date = report_data.get("date")
        results = report_data.get("results", [])
        by_sku = {r["sku"]: r for r in results}
        return date, by_sku
    except Exception:
        return None, {}


# ---------- Endpoints ----------

@app.get("/api/products")
def get_products(
    source: str = "sheets",
    brand: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
    search: Optional[str] = None,
    status: Optional[str] = None,
):
    """Return list of products with pagination, search, and status filter.

    Query params:
        page: page number (1-indexed, default 1)
        per_page: items per page (default 50, max 200)
        search: filter by SKU or name (case-insensitive substring)
        status: comma-separated validation statuses (e.g. OK,MISSING)
    """
    brand_filter = BRAND_CHOICES.get(brand.lower()) if brand else None

    try:
        products = _load_products(source=source, brand_filter=brand_filter)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load products: {e}")

    # Enrich with last validation results
    last_date, val_map = _load_last_validation_map()

    enriched = []
    for p in products:
        d = _product_to_dict(p)
        last = val_map.get(p.sku)
        if last:
            d["last_validation_status"] = last.get("status")
            d["last_validation_score"] = last.get("score")
            d["last_validation_url"] = last.get("url")
            d["last_validation_date"] = last_date
        else:
            d["last_validation_status"] = None
            d["last_validation_score"] = None
            d["last_validation_url"] = None
            d["last_validation_date"] = None
        enriched.append(d)

    # Search filter
    if search:
        term = search.lower()
        enriched = [
            p for p in enriched
            if term in p["sku"].lower() or term in p["name"].lower()
        ]

    # Status filter (from last validation)
    if status:
        allowed = {s.strip().upper() for s in status.split(",")}
        enriched = [
            p for p in enriched
            if (p.get("last_validation_status") or "").upper() in allowed
        ]

    total_filtered = len(enriched)

    # Brand counts (after filtering)
    by_brand: Dict[str, int] = {}
    for p in enriched:
        b = p["brand"]
        by_brand[b] = by_brand.get(b, 0) + 1

    # Pagination
    per_page = min(max(per_page, 1), 200)
    page = max(page, 1)
    total_pages = max((total_filtered + per_page - 1) // per_page, 1)
    start = (page - 1) * per_page
    end = start + per_page
    page_items = enriched[start:end]

    return {
        "products": page_items,
        "total": total_filtered,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
        "by_brand": by_brand,
        "last_validation_date": last_date,
    }


@app.get("/api/products/{sku}")
def get_product_detail(sku: str, source: str = "sheets"):
    """Return detailed info for a single product by SKU, including last validation."""
    try:
        products = _load_products(source=source)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load products: {e}")

    product = None
    for p in products:
        if p.sku == sku:
            product = p
            break

    if not product:
        raise HTTPException(status_code=404, detail=f"Product with SKU '{sku}' not found")

    d = _product_to_dict(product)

    # Enrich with last validation
    last_date, val_map = _load_last_validation_map()
    last = val_map.get(sku)
    if last:
        d["last_validation"] = {
            "status": last.get("status"),
            "score": last.get("score"),
            "actual_cert_text": last.get("actual_cert_text"),
            "url": last.get("url"),
            "error": last.get("error"),
            "ai_assessment": last.get("ai_assessment"),
            "date": last_date,
        }
    else:
        d["last_validation"] = None

    return d


@app.post("/api/products/verify")
def verify_single_product(req: VerifyRequest, source: str = "sheets"):
    """Verify a single product in real-time by fetching from VTEX API.

    This performs a LIVE check against the e-commerce site.
    """
    brand_key = req.brand.lower().replace(" ", "_")
    brand_enum = BRAND_CHOICES.get(brand_key)
    if not brand_enum:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown brand '{req.brand}'. Valid: {list(BRAND_CHOICES.keys())}",
        )

    try:
        products = _load_products(source=source, brand_filter=brand_enum)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load products: {e}")

    product = None
    for p in products:
        if p.sku == req.sku:
            product = p
            break

    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product SKU '{req.sku}' not found in {req.brand} data",
        )

    scraper = VTEXScraper()
    result = _validate_single(product, scraper, ai_verify=False)
    result_dict = _result_to_dict(result)
    result_dict["verified_at"] = datetime.now().isoformat()

    return result_dict


@app.post("/api/validate", response_model=ValidateStartResponse)
async def start_validation(req: ValidateRequest):
    """Start a validation run in a background thread."""
    brand_filter = BRAND_CHOICES.get(req.brand.lower()) if req.brand else None
    source = req.source or "sheets"

    try:
        products = _load_products(source=source, brand_filter=brand_filter)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load products: {e}")

    if req.limit:
        products = products[:req.limit]

    run_id = str(uuid.uuid4())
    loop = asyncio.get_running_loop()

    validation_runs[run_id] = {
        "id": run_id,
        "status": "running",
        "progress": {"current": 0, "total": len(products)},
        "results": [],
        "validation_results": [],  # Keep ValidationResult objects for report generation
        "events": asyncio.Queue(),
        "started_at": datetime.now().isoformat(),
        "report_file": None,
        "error": None,
    }

    thread = threading.Thread(
        target=_run_validation,
        args=(run_id, products, req.ai_verify, loop),
        daemon=True,
    )
    thread.start()

    return ValidateStartResponse(run_id=run_id, total_products=len(products))


@app.get("/api/validate/{run_id}/stream")
async def stream_validation(run_id: str):
    """Server-Sent Events stream for a validation run."""
    if run_id not in validation_runs:
        raise HTTPException(status_code=404, detail="Run not found")

    run = validation_runs[run_id]

    async def event_generator():
        while True:
            try:
                event = await asyncio.wait_for(run["events"].get(), timeout=30.0)
                yield {"event": "message", "data": json.dumps(event, ensure_ascii=False)}
                if event.get("type") in ("complete", "error"):
                    break
            except asyncio.TimeoutError:
                # Send keepalive
                yield {"event": "ping", "data": ""}

    return EventSourceResponse(event_generator())


@app.get("/api/validate/{run_id}")
def get_validation_status(run_id: str):
    """Return the current state of a validation run."""
    if run_id not in validation_runs:
        raise HTTPException(status_code=404, detail="Run not found")

    run = validation_runs[run_id]
    return {
        "run_id": run["id"],
        "status": run["status"],
        "progress": run["progress"],
        "results": run["results"],
        "report_file": run["report_file"],
        "error": run["error"],
    }


@app.get("/api/reports")
def list_reports():
    """List report files in the reports directory."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for f in sorted(REPORTS_DIR.iterdir(), reverse=True):
        if f.suffix in (".xlsx", ".csv", ".json"):
            stat = f.stat()
            files.append({
                "filename": f.name,
                "date": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "size_bytes": stat.st_size,
            })
    return files


@app.get("/api/reports/{filename}")
def download_report(filename: str):
    """Download a specific report file."""
    # Sanitize filename to prevent directory traversal
    safe_name = Path(filename).name
    file_path = REPORTS_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Report not found")

    media_type = "application/octet-stream"
    if file_path.suffix == ".xlsx":
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif file_path.suffix == ".csv":
        media_type = "text/csv"
    elif file_path.suffix == ".json":
        media_type = "application/json"

    return FileResponse(
        path=str(file_path),
        filename=safe_name,
        media_type=media_type,
    )


@app.get("/api/reports/{filename}/data")
def get_report_data(filename: str):
    """Return report data as JSON for the dashboard."""
    safe_name = Path(filename).name
    # Try JSON file first
    json_name = Path(safe_name).stem + ".json"
    json_path = REPORTS_DIR / json_name
    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Report data not found")


@app.get("/api/stats")
def get_stats():
    """Return dashboard statistics."""
    # Get total products from sheets (with error handling)
    total_products = 0
    by_brand: List[Dict[str, Any]] = []

    try:
        products = _load_products(source="sheets")
        total_products = len(products)

        brand_counts: Dict[str, int] = {}
        for p in products:
            b = p.brand.value
            brand_counts[b] = brand_counts.get(b, 0) + 1

        for brand_name, count in sorted(brand_counts.items()):
            by_brand.append({"brand": brand_name, "total": count, "ok": 0, "missing": 0, "inconsistent": 0, "not_found": 0})
    except Exception:
        pass

    # Find the most recent JSON report for last_run stats
    last_run = None
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    json_files = sorted(REPORTS_DIR.glob("*.json"), reverse=True)
    if json_files:
        try:
            with open(json_files[0], "r", encoding="utf-8") as f:
                report_data = json.load(f)
            summary = report_data.get("summary", {})
            last_run = {
                "date": report_data.get("date"),
                "ok": summary.get("ok", 0),
                "missing": summary.get("missing", 0),
                "inconsistent": summary.get("inconsistent", 0),
                "not_found": summary.get("not_found", 0),
                "total": summary.get("total", 0),
            }

            # Update by_brand with actual results from last run
            results = report_data.get("results", [])
            brand_stats: Dict[str, Dict[str, int]] = {}
            for r in results:
                b = r.get("brand", "")
                if b not in brand_stats:
                    brand_stats[b] = {"ok": 0, "missing": 0, "inconsistent": 0, "not_found": 0}
                st = r.get("status", "")
                if st == "OK":
                    brand_stats[b]["ok"] += 1
                elif st == "MISSING":
                    brand_stats[b]["missing"] += 1
                elif st == "INCONSISTENT":
                    brand_stats[b]["inconsistent"] += 1
                elif st in ("URL_NOT_FOUND", "API_ERROR"):
                    brand_stats[b]["not_found"] += 1

            for entry in by_brand:
                bs = brand_stats.get(entry["brand"], {})
                entry["ok"] = bs.get("ok", 0)
                entry["missing"] = bs.get("missing", 0)
                entry["inconsistent"] = bs.get("inconsistent", 0)
                entry["not_found"] = bs.get("not_found", 0)

        except Exception:
            pass

    return {
        "total_products": total_products,
        "last_run": last_run,
        "by_brand": by_brand,
    }


# ---------- Schedule endpoints ----------

@app.get("/api/schedules")
def list_schedules():
    """List all configured schedules."""
    return sched_module.list_schedules()


@app.post("/api/schedules")
def create_schedule(req: ScheduleCreateRequest):
    """Create a new validation schedule."""
    try:
        schedule = sched_module.create_schedule(
            name=req.name,
            cron_expression=req.cron,
            brand_filter=req.brand,
            enabled=req.enabled,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return schedule


@app.put("/api/schedules/{schedule_id}")
def update_schedule(schedule_id: str, req: ScheduleUpdateRequest):
    """Update an existing schedule."""
    try:
        schedule = sched_module.update_schedule(
            schedule_id=schedule_id,
            name=req.name,
            cron_expression=req.cron,
            brand_filter=req.brand,
            enabled=req.enabled,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(schedule_id: str):
    """Delete a schedule."""
    if not sched_module.delete_schedule(schedule_id):
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"ok": True}


@app.post("/api/schedules/{schedule_id}/run")
def trigger_schedule_run(schedule_id: str):
    """Manually trigger a schedule to run now."""
    if not sched_module.trigger_run(schedule_id):
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"ok": True, "message": "Validation run triggered"}


@app.get("/api/schedules/{schedule_id}/history")
def get_schedule_history(schedule_id: str):
    """Get run history for a schedule."""
    schedule = sched_module.get_schedule(schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return sched_module.get_history(schedule_id)
