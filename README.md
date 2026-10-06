# קיצור קישורים אוטומטי בפורומי NodeBB

בכל פורום שבנוי על NodeBB: מדביקים בעורך קישור לקובץ או לתיקייה, והוא מוחלף בשקט בקישור מקוצר של `did.li`. אין חלונות ואין שאלות.

אילו קישורים מתקצרים:

| אתר | מה מקוצר |
|---|---|
| Google Drive / Docs | קישור לקובץ, לתיקייה, למסמך, לגיליון, למצגת או לטופס |
| ג'מבו מייל (`jumbomail.me`) | קישור להורדת קובץ |
| מג'יקוד (`send.magicode.me`) | קישור צפייה בקובץ (`/send-file/file/...`) וקישור הורדה |

קישור לדף הבית של אתר (למשל `drive.google.com` בלבד) לא מתקצר.

## התקנה

### סקריפט טמפרמונקי (מתעדכן לבד)

צריך שתוסף [Tampermonkey](https://www.tampermonkey.net/) יהיה מותקן. אחר כך לוחצים על הקישור:

**[התקנה ישירה](https://raw.githubusercontent.com/tsoolgee/nodebb-link-shortener/main/userscript/nodebb-link-shortener.user.js)**

בפעם הראשונה שהסקריפט מקצר קישור, טמפרמונקי מבקש אישור לפנות ל-`amazonaws.com`. בוחרים "אפשר תמיד".

### תוסף מלא לכרום / אדג'

1. [מורידים את הגרסה האחרונה](https://github.com/tsoolgee/nodebb-link-shortener/releases/latest/download/nodebb-link-shortener.zip) ופורסים את ה-ZIP לתיקייה.
2. פותחים את `chrome://extensions` (או `edge://extensions`) ומפעילים את **מצב מפתח**.
3. לוחצים **טען פריט לא ארוז** ובוחרים את התיקייה.

## פיתוח

הקוד נמצא ב-`src/`. הפקודה `python build.py` בונה ממנו את `userscript/` ואת `extension/`, וגם את `dist/` לשחרור. הגרסה מוגדרת בראש `build.py`.
