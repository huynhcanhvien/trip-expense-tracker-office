#!/usr/bin/env python3
"""PaddleOCR raw-text extractor for the receipt bake-off.

Usage: python3 paddle_ocr.py <image_path>
Prints JSON to stdout: {"text": "<all recognized lines, top-to-bottom>"}

Kept deliberately dumb: PaddleOCR only turns pixels into text lines. The field
extraction (merchant / total / date) happens in a separate small LLM step so we
can compare the two-stage pipeline fairly against the end-to-end VLMs.
"""
import json
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no image path"}))
        return 1
    image_path = sys.argv[1]

    try:
        from paddleocr import PaddleOCR
    except Exception as e:  # not installed
        print(json.dumps({"error": f"import paddleocr failed: {e}"}))
        return 1

    try:
        # PaddleOCR 3.x API: no show_log; use_textline_orientation replaces use_angle_cls;
        # .predict() replaces .ocr(); each result is dict-like with a "rec_texts" list.
        ocr = PaddleOCR(lang="en", use_textline_orientation=True)
        runner = getattr(ocr, "predict", None) or ocr.ocr
        result = runner(image_path)

        lines = []
        for res in result or []:
            texts = None
            # 3.x: res is dict-like {"rec_texts": [...], ...}
            try:
                texts = res["rec_texts"]
            except Exception:
                pass
            if texts is None:
                try:
                    texts = res.json["res"]["rec_texts"]
                except Exception:
                    texts = None
            if texts is None:
                # legacy 2.x: [[box, (text, conf)], ...]
                try:
                    texts = [entry[1][0] for entry in res]
                except Exception:
                    texts = None
            if texts:
                lines.extend(t for t in texts if t)

        print(json.dumps({"text": "\n".join(lines)}))
        return 0
    except Exception as e:
        print(json.dumps({"error": f"ocr failed: {e}"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
