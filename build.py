"""בונה מתוך src/ את התוסף (extension/ + dist/*.zip) ואת סקריפט הטמפרמונקי (userscript/).

הגרסה נקבעת כאן במשתנה VERSION.
"""
import json
import shutil
import zipfile
from pathlib import Path

VERSION = "0.0.1"
NAME = "nodebb-link-shortener"
REPO = "tsoolgee/nodebb-link-shortener"
TITLE = "קיצור קישורים אוטומטי בפורומי NodeBB"
DESC = "מדביקים קישור של גוגל דרייב / ג'מבו מייל / מג'יקוד בעורך של פורום NodeBB – והוא מוחלף בשקט בקישור did.li מקוצר"
API_HOST = "6ejpppqpkh.execute-api.eu-west-1.amazonaws.com"

ROOT = Path(__file__).parent
SRC = ROOT / "src"
RAW = f"https://raw.githubusercontent.com/{REPO}/main/userscript/{NAME}.user.js"


def read(name):
    return (SRC / name).read_text(encoding="utf-8")


def wrap(*parts):
    body = "\n".join(parts)
    body = "\n".join(("  " + l) if l else l for l in body.splitlines())
    return "(function () {\n  'use strict';\n\n" + body + "\n})();\n"


def build_userscript():
    header = f"""// ==UserScript==
// @name         {TITLE}
// @namespace    https://github.com/{REPO}
// @version      {VERSION}
// @description  {DESC}
// @author       tsoolgee
// @homepageURL  https://github.com/{REPO}
// @supportURL   https://github.com/{REPO}/issues
// @updateURL    {RAW}
// @downloadURL  {RAW}
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      {API_HOST}
// @run-at       document-idle
// ==/UserScript==

"""
    out = ROOT / "userscript" / f"{NAME}.user.js"
    out.parent.mkdir(exist_ok=True)
    out.write_text(header + wrap(read("platform.userscript.js"), read("core.js")), encoding="utf-8")
    return out


def build_icons(dest):
    from PIL import Image, ImageDraw
    for size in (16, 48, 128):
        s = size * 4
        img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((0, 0, s - 1, s - 1), radius=s // 5, fill=(64, 123, 227))
        w = max(4, s // 11)
        # שתי חוליות שרשרת
        d.rounded_rectangle((s * .14, s * .34, s * .58, s * .66), radius=s // 6, outline="white", width=w)
        d.rounded_rectangle((s * .42, s * .34, s * .86, s * .66), radius=s // 6, outline="white", width=w)
        img.resize((size, size), Image.LANCZOS).save(dest / f"icon{size}.png")


def build_extension():
    ext = ROOT / "extension"
    if ext.exists():
        shutil.rmtree(ext)
    ext.mkdir()
    manifest = {
        "manifest_version": 3,
        "name": TITLE,
        "version": VERSION,
        "description": DESC,
        "icons": {str(s): f"icon{s}.png" for s in (16, 48, 128)},
        "background": {"service_worker": "background.js"},
        "host_permissions": [f"https://{API_HOST}/*"],
        "content_scripts": [{
            "matches": ["<all_urls>"],
            "js": ["content.js"],
            "run_at": "document_idle",
        }],
        "homepage_url": f"https://github.com/{REPO}",
    }
    (ext / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (ext / "background.js").write_text(read("background.js"), encoding="utf-8")
    (ext / "content.js").write_text(wrap(read("platform.extension.js"), read("core.js")), encoding="utf-8")
    build_icons(ext)

    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    zpath = dist / f"{NAME}.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(ext.iterdir()):
            z.write(f, f.name)
    shutil.copy(ROOT / "userscript" / f"{NAME}.user.js", dist)
    return zpath


if __name__ == "__main__":
    print(build_userscript())
    print(build_extension())
