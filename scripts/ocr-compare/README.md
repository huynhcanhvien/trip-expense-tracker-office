# Receipt-extraction bake-off

Runs one receipt image through three approaches and prints their
`{merchant, amount, date}` + latency side by side, so we can pick one for the
`Scan receipt` feature.

```bash
node scripts/ocr-compare/compare.mjs [imagePath]
# default image: public/uploads/d0f843c9-5704-4b6b-8265-c3d7ca1ef334.webp
```

Each backend self-skips (with a reason) if its dependency isn't set up, so you
can enable them one at a time and re-run.

## 1. Gemini API (cloud)

No install — just a key. Add to `.env.local`:

```
GEMINI_API_KEY=your-key-here
# optional: GEMINI_MODEL=gemini-2.5-flash   (default)
```

Get a key at https://aistudio.google.com/apikey.
Docs: image understanding + structured output on ai.google.dev.

## 2. Local VLMs via Ollama (self-hosted)

```bash
brew install ollama
ollama serve            # leave running in another terminal
ollama pull qwen2.5-vl:3b   # ~3.2 GB
ollama pull moondream       # ~1.7 GB
```

Overrides: `OLLAMA_URL`, `OLLAMA_VLM_MODEL`, `OLLAMA_MOONDREAM_MODEL`.

## 3. PaddleOCR -> small text LLM (two-stage, self-hosted)

PaddleOCR turns the image into raw text; a small text LLM (`qwen2.5:1.5b` via
Ollama) then extracts the fields.

```bash
# Python side (a venv is recommended — this machine has Python 3.9.6)
python3 -m venv scripts/ocr-compare/.venv
scripts/ocr-compare/.venv/bin/pip install paddleocr paddlepaddle
# point the harness at the venv python if you use one:
#   (edit compare.mjs spawn, or run paddle_ocr.py with the venv python)

# LLM side (Ollama, as above)
ollama pull qwen2.5:1.5b     # ~1 GB
```

Override the extractor model with `OLLAMA_TEXT_MODEL`.

## Ground truth (sample receipt)

`merchant="RESTAURANT"  amount="131.78"  date=null`
(`131.78` is the Total Due; `103.75` is the subtotal — the trap.)
