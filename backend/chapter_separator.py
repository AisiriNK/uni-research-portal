import re
import os
import shutil
import sys
import argparse
from docx import Document
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from docx.table import Table


# === ARGPARSER / CONFIGURATION ===
parser = argparse.ArgumentParser(
    prog="chapter_separator.py",
    description="Split a .docx into chapter .docx files and extract images.",
)
parser.add_argument("-i", "--input", default="content.docx", help="Input .docx file (relative or absolute). Default: content.docx")
parser.add_argument("-o", "--output", default="chapters_output", help="Output folder to place chapters and images. Default: chapters_output")
parser.add_argument("--no-clean", dest="clean", action="store_false", help="Do not remove existing output folder (default is to remove it)")
args = parser.parse_args()

input_doc = os.path.abspath(args.input)
# If the user provided an absolute output path, use it as-is. Otherwise place the
# output folder inside the directory that contains the input .docx file. This
# makes it convenient to keep generated chapters next to the source document.
if os.path.isabs(args.output):
    output_folder = os.path.abspath(args.output)
else:
    input_dir = os.path.dirname(input_doc) or os.getcwd()
    output_folder = os.path.abspath(os.path.join(input_dir, args.output))

# check input exists
if not os.path.exists(input_doc):
    print(f"ERROR: input file not found: {input_doc}")
    sys.exit(2)

# Reset output folder unless user requested to keep it
if os.path.exists(output_folder):
    if args.clean:
        shutil.rmtree(output_folder)
        os.makedirs(output_folder, exist_ok=True)
    else:
        os.makedirs(output_folder, exist_ok=True)
else:
    os.makedirs(output_folder, exist_ok=True)

# Central images folder
img_folder = os.path.join(output_folder,"typst")
os.makedirs(img_folder, exist_ok=True)

# === LOAD DOCUMENT ===
doc = Document(input_doc)

# === ROMAN CHAPTER DETECTION ===
# Matches "Chapter I - Introduction", "Chapter II: Literature Survey", or "References"
_chapter_heading_re = re.compile(r"(?i)^chapter\s*[-–:]?\s*([ivxlcdm]+)\b(?:[\s\-\:]+(.+))?$")
_references_re = re.compile(r"(?i)^references\b")

def is_chapter_heading(text):
    text = text.strip()
    m = _chapter_heading_re.match(text)
    if m:
        roman = m.group(1)
        title = m.group(2) or ""
        return ("chapter", roman.upper(), title.strip())
    if _references_re.match(text):
        return ("references", None, "References")
    return None

def roman_to_int(s):
    s = s.upper()
    vals = {"I":1,"V":5,"X":10,"L":50,"C":100,"D":500,"M":1000}
    total = 0
    prev = 0
    for ch in reversed(s):
        v = vals.get(ch,0)
        if v < prev:
            total -= v
        else:
            total += v
        prev = v
    return total

def sanitize_title(t):
    t = t.strip()
    # replace spaces with underscore, remove problematic chars
    t = re.sub(r"[\/\\\:\*\?\"<>\|]", "", t)
    t = re.sub(r"\s+", "_", t)
    return t or "Untitled"

# === BUILD SEQUENCE OF BLOCK ELEMENTS (paragraphs + tables) IN DOCUMENT ORDER ===
body_elems = []
for child in doc.element.body:
    if child.tag.endswith("}p"):
        body_elems.append(Paragraph(child, doc))
    elif child.tag.endswith("}tbl"):
        body_elems.append(Table(child, doc))
    else:
        # ignore other block-level items
        continue

# === SPLIT INTO CHAPTERS (preserve tables) ===
chapters = []
current_chapter = {"raw_heading": None, "title": None, "elements": [], "kind": "frontmatter"}

for elem in body_elems:
    # only Paragraph can be a heading candidate
    if isinstance(elem, Paragraph):
        text = elem.text.strip()
        hdr = is_chapter_heading(text)
    else:
        hdr = None

    if hdr:
        kind, roman, title_part = hdr

        if kind == "references":
            # close any open chapter/frontmatter before starting References
            if current_chapter.get("elements"):
                chapters.append(current_chapter)
            # start a dedicated References container (do NOT treat as numbered chapter)
            current_chapter = {
                "raw_heading": text,
                "title": "References",
                "number": None,
                "kind": "references",
                "elements": [elem],
            }
            # continue collecting elements into the References container
            continue

        # start new chapter for real chapter headings
        if current_chapter.get("elements"):
            chapters.append(current_chapter)

        if kind == "chapter" and roman:
            num = roman_to_int(roman)
            if title_part:
                title = title_part
            else:
                m = re.split(r"\b"+re.escape(roman)+r"\b", text, flags=re.I)
                title = (m[1].strip() if len(m) > 1 else text)
        else:
            title = title_part or text
            num = None

        current_chapter = {
            "raw_heading": text,
            "title": title,
            "number": num,
            "kind": "chapter",
            "elements": [],
        }

    # append element (Paragraph or Table) to the currently active container
    current_chapter["elements"].append(elem)

# append the last container if it has content
if current_chapter.get("elements"):
    chapters.append(current_chapter)

# === HELPER: EXTRACT IMAGES IN RUN ORDER & RENDER PARAGRAPH WITH FILENAMES ===
def render_paragraph_with_image_names(para, saved_images_map, img_folder, image_counter):
    """
    Builds a string for the paragraph where each image/drawing is replaced by its filename.
    Saves images into img_folder and updates image_counter.
    Returns (rendered_text, new_image_counter).
    """
    nsmap = {
        "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    }

    parts = []

    # iterate over paragraph XML children to preserve order of text runs and drawings
    for child in para._p:
        # run element (w:r)
        if child.tag.endswith("}r"):
            # process in-run drawings (can be multiple)
            drawings = child.findall(".//w:drawing", namespaces=nsmap)
            if drawings:
                # Before processing drawings, collect any text nodes before the drawing(s)
                # collect text nodes in this run (they will be appended in sequence)
                texts = [t.text for t in child.findall(".//w:t", namespaces=nsmap) if t.text]
                if texts:
                    parts.append("".join(texts))

                for drawing in drawings:
                    blip = drawing.find(".//a:blip", namespaces=nsmap)
                    if blip is not None:
                        rId = blip.get(qn("r:embed"))
                        if rId:
                            image_part = para.part.related_parts[rId]
                            image_id = id(image_part)
                            if image_id in saved_images_map:
                                img_name = saved_images_map[image_id]
                            else:
                                img_data = image_part.blob
                                # try to determine proper extension from content type
                                content_type = getattr(image_part, "content_type", "").lower() if hasattr(image_part, "content_type") else ""
                                ext = None
                                if content_type:
                                    if content_type == "image/jpeg" or content_type == "image/jpg":
                                        ext = "jpg"
                                    elif content_type == "image/png":
                                        ext = "png"
                                    elif content_type == "image/gif":
                                        ext = "gif"
                                    elif content_type in ("image/tiff", "image/tif"):
                                        ext = "tif"
                                    elif content_type == "image/bmp":
                                        ext = "bmp"
                                if not ext:
                                    # fallback to imghdr to sniff header
                                    try:
                                        import imghdr
                                        guessed = imghdr.what(None, h=img_data)
                                        ext = guessed if guessed else "bin"
                                    except Exception:
                                        ext = "bin"

                                img_name = f"image{image_counter:03}.{ext}"
                                img_path = os.path.join(img_folder, img_name)
                                with open(img_path, "wb") as f:
                                    f.write(img_data)
                                saved_images_map[image_id] = img_name
                                image_counter += 1
                            # insert the image filename where the drawing was
                            parts.append(img_name)
            else:
                # no drawings in this run; collect text
                texts = [t.text for t in child.findall(".//w:t", namespaces=nsmap) if t.text]
                if texts:
                    parts.append("".join(texts))
        else:
            # other child types (e.g., hyperlinks) - attempt to extract text or drawings
            texts = [t.text for t in child.findall(".//w:t", namespaces=nsmap) if t.text]
            if texts:
                parts.append("".join(texts))
            drawings = child.findall(".//w:drawing", namespaces=nsmap)
            for drawing in drawings:
                blip = drawing.find(".//a:blip", namespaces=nsmap)
                if blip is not None:
                    rId = blip.get(qn("r:embed"))
                    if rId:
                        image_part = para.part.related_parts[rId]
                        image_id = id(image_part)
                        if image_id in saved_images_map:
                            img_name = saved_images_map[image_id]
                        else:
                            img_data = image_part.blob
                            # try to determine proper extension from content type
                            content_type = getattr(image_part, "content_type", "").lower() if hasattr(image_part, "content_type") else ""
                            ext = None
                            if content_type:
                                if content_type == "image/jpeg" or content_type == "image/jpg":
                                    ext = "jpg"
                                elif content_type == "image/png":
                                    ext = "png"
                                elif content_type == "image/gif":
                                    ext = "gif"
                                elif content_type in ("image/tiff", "image/tif"):
                                    ext = "tif"
                                elif content_type == "image/bmp":
                                    ext = "bmp"
                            if not ext:
                                # fallback to imghdr to sniff header
                                try:
                                    import imghdr
                                    guessed = imghdr.what(None, h=img_data)
                                    ext = guessed if guessed else "bin"
                                except Exception:
                                    ext = "bin"

                            img_name = f"image{image_counter:03}.{ext}"
                            img_path = os.path.join(img_folder, img_name)
                            with open(img_path, "wb") as f:
                                f.write(img_data)
                            saved_images_map[image_id] = img_name
                            image_counter += 1
                        parts.append(img_name)

    # join parts with spaces so filenames are visible between surrounding text
    rendered = " ".join(p for p in parts if p).strip()
    # if paragraph empty, preserve empty paragraph
    return rendered, image_counter

# === SAVE CHAPTERS & EXTRACT IMAGES ===
image_counter = 1
saved_images_map = {}  # image_id -> filename

# number chapters sequentially in order of appearance (only real chapters get numbers)
chapter_index = 0
for ch in chapters:
    kind = ch.get("kind", "chapter")
    if kind == "chapter":
        chapter_index += 1
        title = ch.get("title") or ch.get("raw_heading") or f"Chapter_{chapter_index}"
        sanitized_title = sanitize_title(title)
        chapter_filename = os.path.join(output_folder, f"Chapter_{chapter_index}-{sanitized_title}.docx")
    elif kind == "references":
        # fixed filename for References (not numbered)
        chapter_filename = os.path.join(output_folder, "References.docx")
    else:
        # frontmatter or unknown -> save with index if needed
        chapter_index += 1
        title = ch.get("title") or ch.get("raw_heading") or f"Chapter_{chapter_index}"
        sanitized_title = sanitize_title(title)
        chapter_filename = os.path.join(output_folder, f"Chapter_{chapter_index}-{sanitized_title}.docx")

    ch_doc = Document()

    for elem in ch["elements"]:
        if isinstance(elem, Paragraph):
            rendered_text, image_counter = render_paragraph_with_image_names(elem, saved_images_map, img_folder, image_counter)
            # if paragraph is empty, add empty paragraph
            if rendered_text:
                ch_doc.add_paragraph(rendered_text)
            else:
                ch_doc.add_paragraph("")
        elif isinstance(elem, Table):
            # create a real table in the new document preserving rows/cols and cell paragraphs
            # determine maximum columns across rows
            max_cols = max(len(r.cells) for r in elem.rows) if elem.rows else 0
            max_cols = max_cols or 1
            new_table = ch_doc.add_table(rows=len(elem.rows), cols=max_cols)
            # try to preserve table style if present
            try:
                new_table.style = elem.style
            except Exception:
                pass

            for r_idx, row in enumerate(elem.rows):
                for c_idx in range(max_cols):
                    target_cell = new_table.rows[r_idx].cells[c_idx]
                    # clear default first paragraph
                    if target_cell.paragraphs:
                        target_cell.paragraphs[0].text = ""
                    # if source row has this cell index, copy content; otherwise leave empty
                    if c_idx < len(row.cells):
                        src_cell = row.cells[c_idx]
                        first_para = True
                        for p in src_cell.paragraphs:
                            rt, image_counter = render_paragraph_with_image_names(p, saved_images_map, img_folder, image_counter)
                            if first_para:
                                # use the first paragraph in the target cell
                                target_cell.paragraphs[0].text = rt or ""
                                first_para = False
                            else:
                                target_cell.add_paragraph(rt or "")
        else:
            # fallback: try to get text attribute
            text = getattr(elem, "text", "")
            ch_doc.add_paragraph(text or "")

    ch_doc.save(chapter_filename)

print(f"✅ Done! Chapters saved ({len(chapters)} files) and {len(saved_images_map)} unique images extracted.")
print(f"Output folder: {os.path.abspath(output_folder)}")
