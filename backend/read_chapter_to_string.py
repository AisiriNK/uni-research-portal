import os
import sys
import json
from docx import Document

# === Helper: Convert table to formatted string ===
def convert_table_to_string(table):
    rows = table.rows
    num_cols = len(rows[0].cells)
    col_spec = ", ".join(["auto"] + ["1fr"] * (num_cols - 1))

    table_str = f"#table(\n  columns: ({col_spec}),"

    for r_idx, row in enumerate(rows):
        cells = []
        for cell in row.cells:
            text = cell.text.strip().replace("\n", " ")
            text = text if text else " "  # Avoid empty brackets
            cells.append(f"[{text}]")
        table_str += "\n  " + ", ".join(cells) + ","

    table_str = table_str.rstrip(",") + "\n)"
    return table_str


def wrap_table_with_caption(table_str, caption=None):
    """Wrap table with optional centered caption"""
    if caption:
        return f"{caption}\n{table_str}"
    return table_str


# === Helper: Extract document content (paragraphs + tables in order) ===
def extract_doc_content(doc_path):
    doc = Document(doc_path)
    content_parts = []

    # Walk through the document body elements in order so paragraphs, images
    # and tables are returned in the original order. We iterate by index so
    # we can look ahead to the next block when we encounter an image line.
    blocks = list(doc.element.body)
    i = 0
    import re

    image_re = re.compile(r"(?i)^(.*\.(?:jpg|jpeg|png|gif))$")
    caption_re = re.compile(r'(?i)^caption\s*:\s*"?(.*?)"?$')

    while i < len(blocks):
        block = blocks[i]

        if block.tag.endswith("p"):  # Paragraph
            paragraph = next((para for para in doc.paragraphs if para._p == block), None)
            text = paragraph.text.strip() if paragraph else ""

            # Detect an image filename on its own line (e.g., image001.jpg)
            m = image_re.match(text)
            if m:
                image_filename = m.group(1).strip()

                # Look ahead for the caption in the immediate next paragraph
                if i + 1 >= len(blocks):
                    caption = "Figure"
                    figure_str = (
                        f"#figure(\n  image(\"{image_filename}\", width: 100%),\n  caption: [{caption}]\n)"
                    )
                    content_parts.append(figure_str)
                    i += 1
                    continue

                next_block = blocks[i + 1]
                if not next_block.tag.endswith("p"):
                    caption = "Figure"
                    figure_str = (
                        f"#figure(\n  image(\"{image_filename}\", width: 100%),\n  caption: [{caption}]\n)"
                    )
                    content_parts.append(figure_str)
                    i += 1
                    continue

                caption_para = next((para for para in doc.paragraphs if para._p == next_block), None)
                caption_text = caption_para.text.strip() if caption_para else ""

                cm = caption_re.match(caption_text)
                if not cm or not cm.group(1).strip():
                    caption = "Figure"
                else:
                    caption = cm.group(1).strip()

                # Build Typst figure block with responsive width
                figure_str = (
                    f"#figure(\n  image(\"{image_filename}\", width: 100%),\n  caption: [{caption}]\n)"
                )
                content_parts.append(figure_str)

                # Skip the caption paragraph as we've consumed it
                i += 2
                continue

            # Regular paragraph with text
            if text:
                content_parts.append(text)

        elif block.tag.endswith("tbl"):  # Table
            table = next((tbl for tbl in doc.tables if tbl._tbl == block), None)
            if table:
                table_str = convert_table_to_string(table)
                content_parts.append(table_str)

        i += 1

    # Join all text + table + figure blocks
    return "\n\n".join(content_parts)


def print_usage():
    script = os.path.basename(sys.argv[0])
    print(f"Usage: python {script} <path-to-docx> [output-json-path]")
    print("Example: python {0} chapters_output/chapter1.docx chapter1.json".format(script))


def main():
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)

    doc_path = sys.argv[1]

    if not os.path.isfile(doc_path):
        print(f"Error: file not found: {doc_path}")
        sys.exit(2)

    if not doc_path.lower().endswith(".docx"):
        print(f"Error: not a .docx file: {doc_path}")
        sys.exit(3)

    chapter_name = os.path.splitext(os.path.basename(doc_path))[0]

    print(f"Processing: {chapter_name}")
    content = extract_doc_content(doc_path)

    # Print the resulting single string to stdout
    print("\n--- Begin Extracted Content ---\n")
    print(content)
    print("\n--- End Extracted Content ---\n")

    # Always save the extracted content to JSON next to the .docx (default)
    # unless the user provides an explicit output path as the second argument.
    if len(sys.argv) >= 3:
        out_path = sys.argv[2]
    else:
        # Save in same directory as doc with chapter_name.json
        base_dir = os.path.dirname(os.path.abspath(doc_path))
        out_path = os.path.join(base_dir, f"{chapter_name}.json")

    out_obj = {chapter_name: content}
    try:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out_obj, f, indent=2, ensure_ascii=False)
        print(f"Saved extracted content to: {out_path}")
    except Exception as e:
        print(f"Error saving JSON to {out_path}: {e}")


if __name__ == "__main__":
    main()
