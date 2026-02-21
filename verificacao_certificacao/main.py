"""CLI entry point for the certification validation system."""

import sys
import time
from pathlib import Path

import click
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.table import Table

from .config import EXCEL_FILE, REQUEST_DELAY, GOOGLE_CREDENTIALS_FILE
from .models import Brand, ValidationStatus, ValidationResult
from .excel_reader import read_products
from .url_resolver import URLResolver
from .scraper import VTEXScraper, extract_cert_text
from .comparator import compare_texts
from .ai_verifier import verify_with_ai, is_ai_available
from .report_generator import generate_reports

console = Console()

BRAND_CHOICES = {
    "imaginarium": Brand.IMAGINARIUM,
    "puket": Brand.PUKET,
    "puket_escolares": Brand.PUKET_ESCOLARES,
}


@click.command()
@click.option(
    "--brand", "-b",
    type=click.Choice(list(BRAND_CHOICES.keys()), case_sensitive=False),
    default=None,
    help="Filter by brand (puket includes escolares).",
)
@click.option("--ai-verify", is_flag=True, help="Use AI to re-verify INCONSISTENT results.")
@click.option("--dry-run", is_flag=True, help="Only read data source, don't access sites.")
@click.option("--limit", "-l", type=int, default=None, help="Limit number of products to validate.")
@click.option("--verbose", "-v", is_flag=True, help="Verbose output.")
@click.option("--excel", type=click.Path(exists=True), default=None, help="Path to Excel file.")
@click.option("--sheets", is_flag=True, help="Read from Google Sheets instead of Excel.")
def main(brand, ai_verify, dry_run, limit, verbose, excel, sheets):
    """Validate certification texts on Puket and Imaginarium e-commerce sites."""
    console.print("[bold cyan]Sistema de Validação de Certificação E-commerce[/bold cyan]")
    console.print()

    # Resolve brand filter
    brand_filter = BRAND_CHOICES.get(brand) if brand else None

    # Read products from Google Sheets or Excel
    if sheets:
        from .sheets_reader import read_products_from_sheets
        creds = GOOGLE_CREDENTIALS_FILE
        if not creds.exists():
            console.print(f"[red]Erro: Credenciais Google não encontradas em {creds}[/red]")
            console.print("[yellow]Coloque o arquivo JSON da Service Account em:[/yellow]")
            console.print(f"  [bold]{creds}[/bold]")
            console.print("[yellow]Ou defina GOOGLE_CREDENTIALS_FILE no .env[/yellow]")
            sys.exit(1)
        console.print("[bold]Fonte: Google Sheets[/bold]")
        products = read_products_from_sheets(brand_filter=brand_filter)
    else:
        excel_path = Path(excel) if excel else EXCEL_FILE
        console.print(f"Lendo planilha: [bold]{excel_path.name}[/bold]")
        products = read_products(excel_path, brand_filter)
    console.print(f"  Produtos ativos encontrados: [bold green]{len(products)}[/bold green]")

    # Show breakdown by brand
    brand_counts = {}
    for p in products:
        brand_counts[p.brand.value] = brand_counts.get(p.brand.value, 0) + 1
    for b, c in sorted(brand_counts.items()):
        no_cert = sum(1 for p in products if p.brand.value == b and not p.expected_cert_text)
        console.print(f"    {b}: {c} produtos ({no_cert} sem texto esperado)")

    if limit:
        products = products[:limit]
        console.print(f"  [yellow]Limitado a {limit} produtos[/yellow]")

    if dry_run:
        console.print("\n[yellow]Modo dry-run: apenas leitura da planilha.[/yellow]")
        _print_dry_run_table(products)
        return

    # Validate products
    console.print()
    results = _validate_products(products, ai_verify, verbose)

    # Generate report
    console.print()
    report_path = generate_reports(results)
    console.print(f"[bold green]Relatório gerado:[/bold green] {report_path}")
    csv_path = report_path.with_suffix(".csv")
    console.print(f"[bold green]CSV gerado:[/bold green] {csv_path}")

    # Print summary
    console.print()
    _print_summary(results)


def _validate_products(products, ai_verify, verbose) -> list:
    """Run validation for all products."""
    resolver = URLResolver()
    scraper = VTEXScraper()
    results = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Validando produtos...", total=len(products))

        for i, product in enumerate(products):
            progress.update(task, description=f"[{i+1}/{len(products)}] {product.sku} - {product.name[:30]}")

            result = _validate_single(product, resolver, scraper, ai_verify, verbose)
            results.append(result)

            progress.advance(task)

            # Rate limiting between requests
            if i < len(products) - 1:
                time.sleep(REQUEST_DELAY)

    return results


def _validate_single(product, resolver, scraper, ai_verify, verbose) -> ValidationResult:
    """Validate a single product."""
    # Check if product has expected certification text
    if not product.expected_cert_text:
        return ValidationResult(
            product=product,
            status=ValidationStatus.NO_EXPECTED,
            error_message="Sem texto de certificação esperado na planilha",
        )

    # Step 1: Fetch description via VTEX API
    try:
        full_desc, cert_text = scraper.fetch_product_description(product)
    except Exception as e:
        if verbose:
            console.print(f"  [red]API error for {product.sku}: {e}[/red]")
        return ValidationResult(
            product=product,
            status=ValidationStatus.API_ERROR,
            error_message=str(e),
        )

    if full_desc is None:
        return ValidationResult(
            product=product,
            status=ValidationStatus.URL_NOT_FOUND,
            error_message="Produto não encontrado na API VTEX",
        )

    # If no cert text was extracted, try matching against full description
    if not cert_text and full_desc:
        cert_text = extract_cert_text(full_desc)

    # If still no cert text, check if the expected text is anywhere in the full description
    if not cert_text and full_desc and product.expected_cert_text:
        if product.expected_cert_text.lower() in full_desc.lower():
            cert_text = product.expected_cert_text

    # Step 2: Resolve URL (for the report, even if we already have description)
    if not product.resolved_url:
        try:
            product.resolved_url = resolver.resolve(product)
        except Exception:
            pass

    # Step 3: Compare texts
    status, score = compare_texts(product.expected_cert_text, cert_text)

    result = ValidationResult(
        product=product,
        status=status,
        actual_cert_text=cert_text,
        similarity_score=score,
    )

    if verbose:
        status_color = {
            ValidationStatus.OK: "green",
            ValidationStatus.MISSING: "red",
            ValidationStatus.INCONSISTENT: "yellow",
        }.get(status, "white")
        console.print(f"  [{status_color}]{product.sku}: {status.value} (score={score:.2f})[/{status_color}]")

    # Step 4: AI verification for INCONSISTENT results
    if ai_verify and status == ValidationStatus.INCONSISTENT:
        if is_ai_available():
            try:
                is_match, confidence, explanation = verify_with_ai(
                    product.expected_cert_text, cert_text
                )
                result.ai_assessment = explanation
                if is_match and confidence >= 0.8:
                    result.status = ValidationStatus.OK
                    result.similarity_score = confidence
                    if verbose:
                        console.print(f"    [green]IA: MATCH (confidence={confidence:.2f})[/green]")
            except Exception as e:
                result.ai_assessment = f"AI error: {e}"
                if verbose:
                    console.print(f"    [red]AI error: {e}[/red]")
        else:
            result.ai_assessment = "API key not configured"

    return result


def _print_dry_run_table(products):
    """Print product table for dry-run mode."""
    table = Table(title="Produtos Ativos", show_lines=True)
    table.add_column("SKU", style="cyan")
    table.add_column("Nome", max_width=40)
    table.add_column("Marca")
    table.add_column("Texto Cert.", max_width=50)

    for p in products:
        cert_display = (p.expected_cert_text[:50] + "...") if p.expected_cert_text and len(p.expected_cert_text) > 50 else (p.expected_cert_text or "[red]SEM TEXTO[/red]")
        table.add_row(p.sku, p.name, p.brand.value, cert_display)

    console.print(table)


def _print_summary(results):
    """Print validation summary to console."""
    table = Table(title="Resumo da Validação")
    table.add_column("Status", style="bold")
    table.add_column("Quantidade", justify="right")
    table.add_column("%", justify="right")

    total = len(results)
    status_colors = {
        ValidationStatus.OK: "green",
        ValidationStatus.MISSING: "red",
        ValidationStatus.INCONSISTENT: "yellow",
        ValidationStatus.URL_NOT_FOUND: "white",
        ValidationStatus.API_ERROR: "red",
        ValidationStatus.NO_EXPECTED: "dim",
    }

    for status in ValidationStatus:
        count = sum(1 for r in results if r.status == status)
        if count > 0:
            color = status_colors.get(status, "white")
            pct = f"{count / total * 100:.1f}%"
            table.add_row(f"[{color}]{status.value}[/{color}]", str(count), pct)

    table.add_row("[bold]TOTAL[/bold]", f"[bold]{total}[/bold]", "100%")
    console.print(table)

    # Per-brand breakdown
    console.print()
    brand_table = Table(title="Por Marca")
    brand_table.add_column("Marca")
    brand_table.add_column("Total", justify="right")
    brand_table.add_column("OK", justify="right", style="green")
    brand_table.add_column("MISSING", justify="right", style="red")
    brand_table.add_column("INCONSISTENT", justify="right", style="yellow")
    brand_table.add_column("Outros", justify="right")

    brands = sorted(set(r.product.brand.value for r in results))
    for brand_name in brands:
        brand_results = [r for r in results if r.product.brand.value == brand_name]
        ok = sum(1 for r in brand_results if r.status == ValidationStatus.OK)
        missing = sum(1 for r in brand_results if r.status == ValidationStatus.MISSING)
        inconsistent = sum(1 for r in brand_results if r.status == ValidationStatus.INCONSISTENT)
        other = len(brand_results) - ok - missing - inconsistent
        brand_table.add_row(brand_name, str(len(brand_results)), str(ok), str(missing), str(inconsistent), str(other))

    console.print(brand_table)


if __name__ == "__main__":
    main()
