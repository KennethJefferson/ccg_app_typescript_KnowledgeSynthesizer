#!/usr/bin/env python3
"""
Word Document Content Extractor

Extracts Word document content to text/markdown format for use in LLM-based content synthesis.

Primary use case: Course material documents -> readable text for synthesis

Usage:
    python docx_extract.py document.docx                    # Extract to markdown
    python docx_extract.py document.docx -f txt             # Extract to plain text
    python docx_extract.py document.docx -o output.md       # Specify output file
    python docx_extract.py --dir /path/to/docs -o ./out     # Batch process directory
"""

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Optional


def check_pandoc() -> bool:
    """Check if pandoc is available."""
    try:
        subprocess.run(["pandoc", "--version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def extract_to_markdown(docx_path: Path, output_path: Path, track_changes: bool = False) -> Path:
    """Extract docx content to markdown using pandoc."""
    cmd = ["pandoc", "-f", "docx", "-t", "markdown"]

    if track_changes:
        cmd.extend(["--track-changes=all"])

    cmd.extend([str(docx_path), "-o", str(output_path)])

    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def extract_to_text(docx_path: Path, output_path: Path) -> Path:
    """Extract docx content to plain text using pandoc."""
    cmd = ["pandoc", "-f", "docx", "-t", "plain", str(docx_path), "-o", str(output_path)]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def process_file(docx_path: Path, output_dir: Path, fmt: str, track_changes: bool) -> Optional[Path]:
    """Process a single docx file."""
    try:
        ext = ".md" if fmt == "md" else ".txt"
        output_path = output_dir / f"{docx_path.stem}{ext}"

        if fmt == "md":
            return extract_to_markdown(docx_path, output_path, track_changes)
        else:
            return extract_to_text(docx_path, output_path)
    except subprocess.CalledProcessError as e:
        print(f"  WARNING: Failed to extract '{docx_path.name}': {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  WARNING: Error processing '{docx_path.name}': {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(
        description="Extract Word document content to text/markdown format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Extract to markdown (default)
  python docx_extract.py document.docx

  # Extract to plain text
  python docx_extract.py document.docx -f txt

  # Include tracked changes
  python docx_extract.py document.docx --track-changes

  # Batch process directory
  python docx_extract.py --dir /path/to/docs -o ./extracted
        """
    )

    parser.add_argument("document", nargs="?", help="Path to Word document (.docx)")
    parser.add_argument("-o", "--output",
                        help="Output file or directory")
    parser.add_argument("-f", "--format",
                        choices=["md", "txt"],
                        default="md",
                        help="Output format (default: md)")
    parser.add_argument("-d", "--dir",
                        help="Process directory of documents")
    parser.add_argument("-r", "--recursive", action="store_true",
                        help="Recursive directory scan")
    parser.add_argument("--track-changes", action="store_true",
                        help="Include tracked changes in output")
    parser.add_argument("-q", "--quiet", action="store_true",
                        help="Suppress progress output")

    args = parser.parse_args()

    def log(msg):
        if not args.quiet:
            print(msg)

    # Check pandoc availability
    if not check_pandoc():
        print("ERROR: pandoc is required but not found. Install from https://pandoc.org/", file=sys.stderr)
        sys.exit(1)

    # Determine input files
    if args.dir:
        input_dir = Path(args.dir)
        if not input_dir.exists():
            print(f"ERROR: Directory not found: {input_dir}", file=sys.stderr)
            sys.exit(1)

        pattern = "**/*.docx" if args.recursive else "*.docx"
        docx_files = list(input_dir.glob(pattern))

        if not docx_files:
            print("No .docx files found", file=sys.stderr)
            sys.exit(1)

        log(f"Found {len(docx_files)} documents")

        # Determine output directory
        output_dir = Path(args.output) if args.output else input_dir
        output_dir.mkdir(parents=True, exist_ok=True)

        # Process all files
        exported = 0
        failed = 0

        for docx_path in docx_files:
            result = process_file(docx_path, output_dir, args.format, args.track_changes)
            if result:
                log(f"  {docx_path.name} -> {result.name}")
                exported += 1
            else:
                failed += 1

        log(f"\nExtracted {exported} documents to: {output_dir}")
        if failed:
            log(f"Failed: {failed} documents")

    elif args.document:
        docx_path = Path(args.document)

        if not docx_path.exists():
            print(f"ERROR: File not found: {docx_path}", file=sys.stderr)
            sys.exit(1)

        # Determine output path
        if args.output:
            output_path = Path(args.output)
            if output_path.is_dir():
                output_dir = output_path
            else:
                output_dir = output_path.parent
                output_dir.mkdir(parents=True, exist_ok=True)
        else:
            output_dir = docx_path.parent

        log(f"Extracting: {docx_path.name}")
        result = process_file(docx_path, output_dir, args.format, args.track_changes)

        if result:
            log(f"Output: {result}")
        else:
            sys.exit(1)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
