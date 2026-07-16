# JClock — הודעות ורישיונות צד שלישי

הרישיון הראשי של JClock אינו גורע מזכויותיהם או מרישיונותיהם של צדדים
שלישיים. יש לשמר הודעות אלה בקוד המקור ובעותקים בינאריים ככל שהרישיון
הרלוונטי דורש זאת.

## 1. Hebrew-date conversion — Scott E. Lee

ההודעה הבאה נמצאת ב־`HebrewDate.js` ובעיבוד Monkey C שלה:

> This script was taken from `http://www.shamash.org/help/javadate.shtml`
> and ported to Node.js by Ionică Bizău.
>
> This script was adapted from C sources written by Scott E. Lee, which
> contain the following copyright notice:
>
> Copyright 1993-1995, Scott E. Lee, all rights reserved.  
> Permission granted to use, copy, modify, distribute and sell so long as
> the above copyright and this permission statement are retained in all
> copies. THERE IS NO WARRANTY — USE AT YOUR OWN RISK.
>
> Bill Hastings  
> RBI Software Systems  
> bhastings@rbi.com

## 2. SunCalc — Vladimir Agafonkin

הקבצים `suncalc.js` כוללים את ההודעה:

> (c) 2011-2015, Vladimir Agafonkin  
> SunCalc is a JavaScript library for calculating sun/moon position and
> light phases.  
> https://github.com/mourner/suncalc

המאגר הרשמי מגדיר את SunCalc כתוכנה ברישיון BSD. נוסח BSD-2-Clause שיש
לשמר עם העותקים:

BSD 2-Clause License

Copyright (c) 2011-2015, Vladimir Agafonkin  
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

מקור: [mourner/suncalc](https://github.com/mourner/suncalc).

## 3. הגרסה שפורסמה בעבר של JClock

ב־`C:\apps\simchanaftali669\JClock\LICENSE` נמצא רישיון BSD-2-Clause עם
ההודעה הבאה, שיש לשמר לגבי הקוד שפורסם תחתיו:

> Copyright (c) [5785-08-19], Naftali Bilig  
> All rights reserved.

היתר BSD שניתן כדין לגרסה מסוימת אינו מתבטל מעצם פרסום גרסאות חדשות תחת
תנאים קנייניים. תוספות חדשות יכולות להיות כפופות לרישיון אחר, אך הודעות
המקור והיתרי הצד השלישי נשמרים.

## 4. Garmin SDK sample headers

כמה קובצי Monkey C במקור Garmin נושאים את ההודעה:

> Copyright 2016-2021 by Garmin Ltd. or its subsidiaries.  
> Subject to Garmin SDK License Agreement and Wearables Application Developer
> Agreement.

אין לייחס לנפתלי ביליג בעלות ברכיבי SDK או קוד דוגמה של Garmin. מנגד,
הפעלת JClock על Garmin אינה מעניקה ל־Garmin בעלות אוטומטית בקוד המקורי של
JClock.

## 5. ספריות הפלטפורמות

- AndroidX ורכיבי Gradle רבים מופצים תחת Apache-2.0.
- Google Play Services כפופים לתנאי Google/Android SDK החלים עליהם.
- `@zeppos/zml` מופץ תחת MIT; כלי הבנייה של Zepp אינם הופכים את Zepp לבעלת
  זכויות בקוד JClock.

רשימות dependencies וקובצי lock עשויים לכלול רישיונות נוספים. לפני הפצה
מסחרית יש להפיק inventory של רכיבי runtime שנארזים בפועל ולצרף את נוסחיהם.

## 6. מדיה

רישיון תוכנה אינו מעניק אוטומטית זכות לפרסם מנגינות, הקלטות, תמונות,
אייקונים או לוגואים. לכל פריט מדיה יש לתעד בנפרד את היוצר, בעל זכויות
היצירה, בעל זכויות ההקלטה/הצילום וההרשאה שניתנה לפרסום.

