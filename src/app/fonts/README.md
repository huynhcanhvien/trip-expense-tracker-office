# Be Vietnam Pro assets

These self-hosted faces come from [Be Vietnam Pro](https://github.com/bettergui/BeVietnamPro)
via [Google Fonts](https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;700&display=swap).
Copyright and the complete SIL Open Font License are in [OFL.txt](OFL.txt).

Each weight combines the Latin, Latin Extended and Vietnamese subsets into one
WOFF2 file. The two files total 39,768 bytes and each covers 418 codepoints,
including printable ASCII, all Vietnamese precomposed tone characters and ₫.
The app loads weights 400 and 700 through `next/font/local`; intermediate CSS
weights use these faces. `font-display: optional` avoids a late font swap on a
slow first visit, with an adjusted Arial fallback. Geist Mono is not preloaded.

To regenerate, collect the three upstream WOFF2 subsets for **one weight** from
the Google Fonts stylesheet and merge them with FontTools 4.60.1 and Brotli 1.2.0:

```python
from fontTools.merge import Merger
font = Merger().merge(["vietnamese.woff2", "latin-ext.woff2", "latin.woff2"])
font.flavor = "woff2"
font.save("be-vietnam-pro-400.woff2")
```

Repeat for weight 700. Preserve the license and validate the cmap against ASCII
U+0020–007E, Vietnamese U+1EA0–1EF9, Đ/đ, Ă/ă, Ĩ/ĩ, Ũ/ũ, Ơ/ơ, Ư/ư and U+20AB.
Python tools are only needed to regenerate the committed assets.
