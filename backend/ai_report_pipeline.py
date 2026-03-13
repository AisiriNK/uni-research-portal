#!/usr/bin/env python3
"""AI report formatter pipeline entrypoint.

This script is intentionally minimal for step-1 of the pipeline:
- accept the uploaded Word document path
- accept UI metadata
- emit a JSON payload describing the input
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error
import logging
import time
import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Tuple
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pdf2docx import Converter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger("ai_report_pipeline")

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AI report formatter pipeline")
    parser.add_argument("--input", required=True, help="Path to the uploaded Word document")
    parser.add_argument("--project-title", required=True, help="Project title from UI")
    parser.add_argument("--guide-name", required=True, help="Guide name from UI")
    parser.add_argument("--year", required=True, help="Year from UI")
    parser.add_argument("--dept", default="", help="Department from UI")
    parser.add_argument("--team-members-json", required=True, help="Team members JSON from UI")
    return parser.parse_args()

def main() -> None:
    pipeline_start = time.time()
    logger.info("[STEP 0] Pipeline started")

    args = parse_args()
    logger.info("[STEP 1] Parsed arguments: input=%s project_title=%s year=%s", args.input, args.project_title, args.year)
    step1_start = time.time()
    input_path = Path(args.input)

    if not input_path.exists():
        logger.error("[STEP 1] Input file not found: %s", input_path)
        raise SystemExit(f"Input file not found: {input_path}")
    logger.info("[STEP 1] Input file exists (%d bytes)", input_path.stat().st_size)

    try:
        team_members = json.loads(args.team_members_json)
    except json.JSONDecodeError:
        logger.warning("[STEP 1] Invalid team_members_json, defaulting to empty list")
        team_members = []
    logger.info("[STEP 1] Team members parsed: %d (elapsed: %.2fs)", len(team_members), time.time() - step1_start)

    chapters_dir = input_path.parent / "chapters_output"
    separator_script = Path(__file__).with_name("chapter_separator.py")

    if not separator_script.exists():
        logger.error("[STEP 2] Missing chapter separator script: %s", separator_script)
        raise SystemExit(f"Missing chapter separator script: {separator_script}")

    separator_cmd = [
        sys.executable,
        str(separator_script),
        "--input",
        str(input_path),
        "--output",
        str(chapters_dir)
    ]

    logger.info("[STEP 2] Running chapter separator: %s", " ".join(separator_cmd))
    step2_start = time.time()
    result = subprocess.run(separator_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error("[STEP 2] Chapter separator failed: %s", result.stderr.strip())
        raise SystemExit(result.stderr or "Chapter separator failed")
    logger.info("[STEP 2] Chapter separator complete (elapsed: %.2fs)", time.time() - step2_start)

    chapter_reader = Path(__file__).with_name("read_chapter_to_string.py")
    if not chapter_reader.exists():
        logger.error("[STEP 3] Missing chapter reader script: %s", chapter_reader)
        raise SystemExit(f"Missing chapter reader script: {chapter_reader}")

    chapter_strings: List[str] = []
    chapter_map: Dict[str, str] = {}
    chapter_files = sorted(chapters_dir.glob("*.docx"))
    logger.info("[STEP 3] Found %d chapter docx files", len(chapter_files))
    step3_start = time.time()

    for chapter_file in chapter_files:
        if chapter_file.name.lower() == "references.docx":
            logger.info("[STEP 3] Skipping references file: %s", chapter_file.name)
            continue
        logger.info("[STEP 3] Reading chapter file: %s", chapter_file.name)
        reader_cmd = [
            sys.executable,
            str(chapter_reader),
            str(chapter_file)
        ]
        reader_result = subprocess.run(reader_cmd, capture_output=True, text=True)
        if reader_result.returncode != 0:
            logger.error("[STEP 3] Chapter reader failed for %s: %s", chapter_file.name, reader_result.stderr.strip())
            raise SystemExit(reader_result.stderr or f"Chapter reader failed for {chapter_file}")

        chapter_json_path = chapter_file.with_suffix(".json")
        if not chapter_json_path.exists():
            logger.error("[STEP 3] Chapter JSON missing for %s", chapter_file.name)
            raise SystemExit(f"Chapter JSON not found for {chapter_file}")

        with open(chapter_json_path, "r", encoding="utf-8") as f:
            chapter_data = json.load(f)
        for chapter_name, chapter_text in chapter_data.items():
            chapter_map[chapter_name] = chapter_text
            chapter_strings.append(chapter_text)
            logger.info("[STEP 3] Loaded chapter '%s' (%d chars)", chapter_name, len(chapter_text))

    logger.info("[STEP 3] Total chapters ready for Gemini: %d (elapsed: %.2fs)", len(chapter_map), time.time() - step3_start)

    gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not gemini_api_key:
        logger.error("[STEP 4] GEMINI_API_KEY is not set")
        raise SystemExit("GEMINI_API_KEY is not set")

    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
    gemini_models_env = os.getenv("GEMINI_MODELS", "").strip()
    gemini_models = [m.strip() for m in gemini_models_env.split(",") if m.strip()] or [gemini_model]
    system_prompt = os.getenv(
        "GEMINI_SYSTEM_PROMPT",
        """You are a Typst code–generation assistant.
Your job:
Given a raw chapter string as input, generate only the inner Typst body code for that chapter, starting from the inline chapter heading and ending at the last paragraph of the chapter.
You must output exactly this structure (with values filled from the chapter text) and nothing else:
Inline chapter heading and title:
text
#text(size: 16pt, weight: "bold")[<CHAPTER - N>]
#align(center)[#text(size: 16pt, weight: "bold")[<CHAPTER_TITLE>]]

Paragraph settings:
text
#set par(justify: true, leading: 1.5em, spacing: 2em)

All remaining chapter content (sections, bullets, paragraphs, pagebreaks, etc.) formatted as Typst markup, matching this example pattern:
text
#text(size: 14pt, weight: "bold")[3.1 Software Requirements]

<paragraphs...>

#v(1em)
<more paragraphs / headings / bullets...>

#pagebreak()
#text(size: 14pt, weight: "bold")[3.2 Hardware Requirements]

<more paragraphs...>

You do not generate the outer #page(...) and header/footer code; that will be concatenated by another pipeline.

Input format
You will be given a single multiline chapter input string like:
text
CHAPTER- III

SYSTEM REQUIREMENT SPECIFICATION

3.1 Software Requirements

The development of the Yoga Pose Recommender System relies on ...

...

5. Internet Connection
• A stable and high-speed internet connection ...

The first two non-empty lines are always:
Line 1: chapter heading (e.g. CHAPTER- III)
Line 2: chapter title (e.g. SYSTEM REQUIREMENT SPECIFICATION)
Everything after that is the body.

What you must output
From this input string, you must:
Parse the chapter heading and title:
Title-page heading form is handled elsewhere; here you only need the inline form:
Convert CHAPTER- III or CHAPTER - III → CHAPTER - III for the inline heading.
Normalize title spacing: collapse multiple spaces between words:
SYSTEM REQUIREMENT SPECIFICATION → SYSTEM REQUIREMENT SPECIFICATION.
Emit the inline heading and paragraph settings:
text
#text(size: 16pt, weight: "bold")[CHAPTER - III]
#align(center)[#text(size: 16pt, weight: "bold")[SYSTEM REQUIREMENT SPECIFICATION]]

#set par(justify: true, leading: 1.5em, spacing: 2em)

For the rest of the chapter (everything after the second non-empty line), convert it into Typst markup that matches this style:
Section headings as bold #text blocks, e.g.:
text
#text(size: 14pt, weight: "bold")[3.1 Software Requirements]


Normal paragraphs as plain text lines, separated by blank lines and #v(1em) where shown in the example you were given.
Section/subsection headings inside the body that are meant to be emphasized (like 3.1.1 Tools used:) should be wrapped with asterisks for bold:
text
*3.1.1 Tools used:*


Important: bullets must stay exactly as they appear in the input string.
If the input uses • bullets, keep •.
If the input uses - bullets, keep -.
Do not change bullet markers to a different symbol and do not add Typst list syntax; just output the bullet lines as plain text.
Maintain all sentences, punctuation, and inline spacing exactly as in the input, except for:
Collapsing excessive spaces in headings when turning them into #text(...) headings.
Inserting #v(1em) between logical blocks, in the same pattern as the example you were given.
When the example chapter uses #pagebreak() before a new major section (such as before 3.2 Hardware Requirements), reproduce that #pagebreak() at the same logical place.
Do not emit any of the outer page code (#page(...), #let starting_page, headers/footers, etc.).
Your entire output must start at #text(size: 16pt, weight: "bold")[<...>] and end at the final paragraph of the chapter.

Constraints
Output must be only Typst code, no markdown fences, comments, or explanations.
Keep bullets as they are in the input (do not convert • to - or vice versa).
Do not paraphrase or reorder paragraphs; preserve content exactly.
Ensure Typst syntax is valid:
All [ and ] pairs in #text[...] are balanced.
#v(1em) and #pagebreak() are on their own lines."""
    ).strip()
    logger.info("[STEP 4] Gemini configured: models=%s prompt_len=%d", ",".join(gemini_models), len(system_prompt))

    gemini_responses: Dict[str, str] = {}
    gemini_response_list: List[str] = []

    rate_limit_lock = threading.Lock()
    last_request_time = {"ts": 0.0}
    min_interval = float(os.getenv("GEMINI_MIN_REQUEST_INTERVAL", "2.5"))

    def call_gemini(name: str, text: str) -> Tuple[str, str]:
        logger.info("[STEP 4] Gemini request started for chapter '%s'", name)
        request_body = {
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": text}]
                }
            ]
        }

        response_payload = None
        last_error: Exception | None = None
        max_retries = int(os.getenv("GEMINI_MAX_RETRIES", "5"))
        base_backoff = float(os.getenv("GEMINI_RETRY_BACKOFF", "1.5"))
        timeout_seconds = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "120"))

        for model_name in gemini_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_api_key}"
            data = json.dumps(request_body).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            for attempt in range(1, max_retries + 1):
                try:
                    if min_interval > 0:
                        with rate_limit_lock:
                            now = time.monotonic()
                            elapsed = now - last_request_time["ts"]
                            if elapsed < min_interval:
                                time.sleep(min_interval - elapsed)
                            last_request_time["ts"] = time.monotonic()
                    with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
                        response_payload = json.loads(response.read().decode("utf-8"))
                    break
                except urllib.error.HTTPError as http_error:
                    last_error = http_error
                    if http_error.code == 404:
                        logger.warning("[STEP 4] Gemini model not found: %s", model_name)
                        break
                    if http_error.code == 429:
                        retry_after = http_error.headers.get("Retry-After")
                        if retry_after is not None:
                            try:
                                sleep_for = float(retry_after)
                            except ValueError:
                                sleep_for = base_backoff ** attempt
                        else:
                            sleep_for = base_backoff ** attempt
                        sleep_for += random.uniform(0.0, 0.5)
                        logger.warning(
                            "[STEP 4] Gemini rate-limited for chapter '%s' (model=%s attempt=%d/%d). Sleeping %.2fs",
                            name,
                            model_name,
                            attempt,
                            max_retries,
                            sleep_for,
                        )
                        if attempt < max_retries:
                            time.sleep(sleep_for)
                            continue
                        break
                    logger.warning(
                        "[STEP 4] Gemini HTTP error for chapter '%s' (model=%s attempt=%d/%d): %s",
                        name,
                        model_name,
                        attempt,
                        max_retries,
                        str(http_error),
                    )
                except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                    last_error = e
                    logger.warning(
                        "[STEP 4] Gemini connection error for chapter '%s' (model=%s attempt=%d/%d): %s",
                        name,
                        model_name,
                        attempt,
                        max_retries,
                        str(e),
                    )
                except Exception as e:
                    last_error = e
                    raise

                if attempt < max_retries:
                    sleep_for = base_backoff ** attempt
                    sleep_for += random.uniform(0.0, 0.5)
                    time.sleep(sleep_for)

            if response_payload is not None:
                break

        if response_payload is None:
            raise RuntimeError(f"Gemini request failed for all models: {last_error}")

        candidates = response_payload.get("candidates", [])
        if not candidates:
            raise RuntimeError("Gemini returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        chapter_response = "".join(part.get("text", "") for part in parts).strip()
        if not chapter_response:
            raise RuntimeError("Gemini returned empty response")

        logger.info("[STEP 4] Gemini response for chapter '%s':\n%s", name, chapter_response)
        logger.info("[STEP 4] Gemini request completed for chapter '%s' (%d chars)", name, len(chapter_response))

        return name, chapter_response

    max_workers = min(len(chapter_map), int(os.getenv("GEMINI_MAX_WORKERS", "1"))) or 1
    logger.info("[STEP 4] Executing Gemini requests in parallel with %d workers", max_workers)
    step4_start = time.time()
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(call_gemini, chapter_name, chapter_text): chapter_name
            for chapter_name, chapter_text in chapter_map.items()
        }
        for future in as_completed(futures):
            chapter_name = futures[future]
            try:
                name, response_text = future.result()
            except Exception as e:
                logger.error("[STEP 4] Gemini request failed for chapter '%s': %s", chapter_name, str(e))
                if os.getenv("GEMINI_CONTINUE_ON_FAILURE", "").strip().lower() in {"1", "true", "yes"}:
                    gemini_responses[chapter_name] = ""
                    continue
                raise SystemExit(f"Gemini request failed for {chapter_name}: {e}")
            gemini_responses[name] = response_text
    logger.info("[STEP 4] Gemini responses collected: %d (elapsed: %.2fs)", len(gemini_responses), time.time() - step4_start)

    for chapter_name in chapter_map.keys():
        if chapter_name in gemini_responses:
            gemini_response_list.append(gemini_responses[chapter_name])

    team_members_text = ", ".join(
        f"{member.get('name', '').strip()} ({member.get('usn', '').strip()})".strip()
        for member in team_members
        if isinstance(member, dict)
    ).strip()

    class SafeFormatDict(dict):
        def __missing__(self, key):
            return ""

    def extract_chapter_heading_and_title(raw_text: str) -> Tuple[str, str]:
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        if not lines:
            return "", ""
        heading = lines[0]
        title = lines[1] if len(lines) > 1 else ""
        return heading, title

    prefix_template = os.getenv(
        "CHAPTER_PREFIX_TEMPLATE",
        """#page(
  paper: "a4",
  margin: (top: 1in, bottom: 1in, left: 1.25in, right: 1in),
  header: none,
  footer: none,
  numbering: none
)[
  #set text(font: "Times New Roman", size: 12pt, fill: black)
  #set align(center)
  #v(1fr)

    #text(size: 24pt, weight: "bold")[{chapter_heading}]
  #v(0.5em)
    #text(size: 24pt, weight: "bold")[{chapter_title}]

  #v(1fr)
]

#let starting_page = {page_number}
#counter(page).update(starting_page+1)

#let department = "B.E/Dept of {dept}/BNMIT"
#let academic_year = {year}
#let project_title = "{project_title}"
#set page(
  paper: "a4",
  margin: (top: 1in, bottom: 1in, left: 1.25in, right: 1in),
  numbering: "1",
  header: context [
    #if counter(page).get().first() >= starting_page+2 [
      #set text(size: 12pt, font: "Times New Roman", weight: "bold")
      #block(
        width: 100%,
        inset: (top: 5pt, bottom: 8pt),
      )[
        #stack(
          dir: ttb,
          project_title,
          v(0.3em),
          spacing: 1.5pt, 
          line(length: 100%, stroke: 0.7pt + rgb(128, 0, 0)),
          v(0.3em),
          line(length: 100%, stroke: 3pt + rgb(128, 0, 0))
        )
      ]
    ]
  ],
  footer: context [
    #set text(size: 10pt, font: "Times New Roman")
    #block(
      width: 100%,
      inset: (top: 8pt, bottom: 5pt),
    )[
      #stack(
          dir: ttb,
          spacing: 1.5pt, 
          line(length: 100%, stroke: 3pt + rgb(128, 0, 0)),
          v(0.3em),
          line(length: 100%, stroke: 0.7pt + rgb(128, 0, 0))
        )
      #grid(
        columns: (1fr, 1fr, 1fr),
        align: (left, center, right),
      )[
        #department
      ][
        Page #counter(page).display()
      ][
        #academic_year
      ]
    ]
  ]
)
"""
    )

    prefixed_gemini_responses: Dict[str, str] = {}
    prefixed_gemini_response_list: List[str] = []

    base_metadata = SafeFormatDict(
        project_title=args.project_title,
        guide_name=args.guide_name,
        year=args.year,
        dept=args.dept,
        team_members=team_members_text
    )

    typst_dir = chapters_dir / "typst"
    typst_dir.mkdir(parents=True, exist_ok=True)
    logger.info("[STEP 5] Typst output directory ready: %s", typst_dir)
    typst_results: Dict[str, Dict[str, str]] = {}
    step5_start = time.time()

    current_page_number = 1
    chapter_index = 1
    chapter_pdf_order: List[Path] = []
    for chapter_name in chapter_map.keys():
        response_text = gemini_responses.get(chapter_name, "")
        if not response_text:
            logger.warning("[STEP 5] Missing Gemini response for chapter '%s', skipping Typst compile", chapter_name)
            continue

        metadata = SafeFormatDict(base_metadata)
        chapter_heading, chapter_title = extract_chapter_heading_and_title(chapter_map.get(chapter_name, ""))
        metadata["chapter_heading"] = chapter_heading
        metadata["chapter_title"] = chapter_title
        metadata["page_number"] = current_page_number
        prefix = prefix_template.format_map(metadata)
        combined = f"{prefix}{response_text}"

        prefixed_gemini_responses[chapter_name] = combined
        prefixed_gemini_response_list.append(combined)

        typst_input_path = typst_dir / f"chapter_{chapter_index}.typ"
        typst_output_path = typst_dir / f"chapter_{chapter_index}.pdf"
        typst_input_path.write_text(combined, encoding="utf-8")
        logger.info("[STEP 5] Typst input written for chapter '%s': %s", chapter_name, typst_input_path.name)

        typst_cmd = [
            "typst",
            "compile",
            str(typst_input_path),
            str(typst_output_path)
        ]

        typst_process = subprocess.run(
            typst_cmd,
            capture_output=True,
            text=True,
            timeout=120
        )

        if typst_process.returncode != 0:
            logger.error("[STEP 5] Typst compile failed for chapter '%s': %s", chapter_name, typst_process.stderr.strip())
            raise SystemExit(
                f"Typst compile failed for {chapter_name}: {typst_process.stderr.strip()}"
            )
        logger.info("[STEP 5] Typst compile successful for chapter '%s'", chapter_name)

        try:
            reader = PdfReader(str(typst_output_path))
            page_count = len(reader.pages)
        except Exception as e:
            logger.error("[STEP 5] Failed page count for chapter '%s': %s", chapter_name, str(e))
            raise SystemExit(f"Failed to read page count for {chapter_name}: {e}")
        logger.info("[STEP 5] Chapter '%s' PDF pages=%d start_page=%d", chapter_name, page_count, current_page_number)

        typst_results[chapter_name] = {
            "input_path": str(typst_input_path),
            "output_path": str(typst_output_path),
            "stdout": typst_process.stdout.strip(),
            "stderr": typst_process.stderr.strip(),
            "page_count": str(page_count),
            "start_page": str(current_page_number)
        }

        chapter_pdf_order.append(typst_output_path)

        current_page_number += page_count
        chapter_index += 1

    logger.info("[STEP 5] Typst compilation complete (elapsed: %.2fs)", time.time() - step5_start)

    merged_pdf_result = {
        "output_path": "",
        "page_count": "0",
        "error": ""
    }

    merged_docx_result = {
        "output_path": "",
        "error": ""
    }

    if chapter_pdf_order:
        logger.info("[STEP 6] Merging %d chapter PDFs", len(chapter_pdf_order))
        step6_start = time.time()
        merged_pdf_path = typst_dir / "report_merged.pdf"
        writer = PdfWriter()
        for pdf_path in chapter_pdf_order:
            try:
                reader = PdfReader(str(pdf_path))
                for page in reader.pages:
                    writer.add_page(page)
            except Exception as e:
                logger.error("[STEP 6] Failed to merge %s: %s", pdf_path.name, str(e))
                raise SystemExit(f"Failed to merge PDF {pdf_path.name}: {e}")

        with open(merged_pdf_path, "wb") as merged_file:
            writer.write(merged_file)

        merged_pdf_result["output_path"] = str(merged_pdf_path)
        merged_pdf_result["page_count"] = str(len(writer.pages))
        logger.info("[STEP 6] Merged PDF created: %s (%s pages) (elapsed: %.2fs)", merged_pdf_path, merged_pdf_result["page_count"], time.time() - step6_start)

        step7_start = time.time()
        merged_docx_path = typst_dir / "report_merged.docx"
        try:
            logger.info("[STEP 7] Converting merged PDF to DOCX")
            converter = Converter(str(merged_pdf_path))
            converter.convert(str(merged_docx_path), start=0, end=None)
            converter.close()
            merged_docx_result["output_path"] = str(merged_docx_path)
            logger.info("[STEP 7] DOCX conversion complete: %s", merged_docx_path)
        except Exception as e:
            merged_docx_result["error"] = f"PDF to DOCX conversion failed: {e}"
            logger.error("[STEP 7] DOCX conversion failed: %s", str(e))
        logger.info("[STEP 7] PDF to DOCX conversion complete (elapsed: %.2fs)", time.time() - step7_start)
    else:
        logger.warning("[STEP 6] No chapter PDFs found to merge")

    payload = {
        "status": "ok",
        "input_path": str(input_path),
        "file_size_bytes": input_path.stat().st_size,
        "chapters_output": str(chapters_dir),
        "chapter_count": len(chapter_strings),
        "chapter_strings": chapter_strings,
        "chapters": chapter_map,
        "gemini_chapter_responses": gemini_responses,
        "gemini_responses": gemini_response_list,
        "gemini_prefixed_chapter_responses": prefixed_gemini_responses,
        "gemini_prefixed_responses": prefixed_gemini_response_list,
        "typst_chapters": typst_results,
        "merged_pdf": merged_pdf_result,
        "merged_docx": merged_docx_result,
        "metadata": {
            "project_title": args.project_title,
            "guide_name": args.guide_name,
            "year": args.year,
            "dept": args.dept,
            "team_members": team_members
        },
        "chapter_separator": {
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip()
        }
    }

    logger.info("[STEP 8] Pipeline completed successfully in %.2fs", time.time() - pipeline_start)
    print(json.dumps(payload))

if __name__ == "__main__":
    main()
