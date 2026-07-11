(function () {
  const HALAKIM_PER_HOUR = 1080;
  const HALAKIM_PER_DAY = 25920;
  const HALAKIM_PER_LUNAR_CYCLE = (29 * HALAKIM_PER_DAY) + 13753;
  const NEW_MOON_OF_CREATION = 31524;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const HEBREW_YEAR_DISPLAY_OFFSET = 3760;
  const DEFAULT_DISPLAY_YEAR = 2026;
  const MIN_DISPLAY_YEAR = 1800;
  const MAX_DISPLAY_YEAR = 2200;
  const SERVICE_DESCRIPTION = "הדברים שאנשים הכי צריכים לפעמים נמצאים במקומות הכי נסתרים";
  const CHOICE_EXPLANATION = "השרטוט נקרא כאן מגן דוד מפני ששני המשולשים נוצרים דווקא דרך הדילוגים: כסלו, שבט ואדר מדלגים על טבת, חודש מזלם של ישראל; וניסן, אייר ותמוז מדלגים על סיוון, חודש פטירת דוד המלך. המקומות שאיננו רואים, אלה שנעשים שקופים בעינינו, מזכירים גם את מי שמכונים לפעמים משוגע.ת ומתמודדים עם מאניה, סכיזופרניה או מצוקה נפשית, כמוני, המחבר, נפתלי ביליג. דווקא החסר יוצר השלמה.";
  const ORIGIN_MONTH = { key: "heshvan", he: "חשוון", en: "Heshvan" };
  // השרטוט נקרא כאן מגן דוד מפני ששני המשולשים נוצרים דווקא דרך הדילוגים: כסלו, שבט ואדר מדלגים על טבת, חודש מזלם של ישראל; וניסן, אייר ותמוז מדלגים על סיוון, חודש פטירת דוד המלך. המקומות שאיננו רואים, אלה שנעשים שקופים בעינינו, מזכירים גם את מי שמכונים לפעמים משוגע.ת ומתמודדים עם מאניה, סכיזופרניה או מצוקה נפשית, כמוני, המחבר, נפתלי ביליג. דווקא החסר יוצר השלמה.
  const TRIANGLE_OUTLINE = [1, 3, 4, 1];
  const TRIANGLE_BACKGROUND = [5, 6, 8, 5];
  const VIEW = {
    width: 720,
    height: 360,
    plotLeft: 56,
    plotTop: 28,
    plotWidth: 620,
    plotHeight: 248
  };

  const elements = {
    open: document.getElementById("hidden-starr-open"),
    dateButton: document.getElementById("date-orbit"),
    panel: document.getElementById("hidden-starr-panel"),
    close: document.getElementById("hidden-starr-close"),
    title: document.getElementById("hidden-starr-title"),
    year: document.getElementById("hidden-starr-year"),
    network: document.getElementById("hidden-starr-network"),
    legend: document.getElementById("hidden-starr-legend")
  };

  if (!elements.open || !elements.dateButton || !elements.panel || !elements.close || !elements.year || !elements.network || !elements.legend) {
    return;
  }

  function positiveModulo(value, modulo) {
    const result = value % modulo;
    return result < 0 ? result + modulo : result;
  }

  function pad(value, size) {
    return String(Math.trunc(Number(value) || 0)).padStart(size, "0");
  }

  function canonicalMoladMonthKey(monthKey) {
    const key = String(monthKey || "").trim().toLowerCase().replace(/[\s_]/g, "");
    const aliases = {
      tishrei: "tishri",
      cheshvan: "heshvan",
      adar1: "adari",
      adari: "adari",
      adar2: "adarii",
      adarii: "adarii",
      nissan: "nisan",
      iyar: "iyyar",
      iyyar: "iyyar",
      tamuz: "tammuz"
    };
    return aliases[key] || key;
  }

  function isHebrewLeapYear(hebrewYear) {
    return positiveModulo(7 * Number(hebrewYear) + 1, 19) < 7;
  }

  function hebrewMonthKeysForYear(hebrewYear) {
    return isHebrewLeapYear(hebrewYear)
      ? ["tishri", "heshvan", "kislev", "tevet", "shevat", "adari", "adarii", "nisan", "iyyar", "sivan", "tammuz", "av", "elul"]
      : ["tishri", "heshvan", "kislev", "tevet", "shevat", "adar", "nisan", "iyyar", "sivan", "tammuz", "av", "elul"];
  }

  function getMonthOffsetFromTishrei(hebrewYear, monthKey) {
    const canonical = canonicalMoladMonthKey(monthKey);
    const months = hebrewMonthKeysForYear(hebrewYear);
    const index = months.indexOf(canonical);
    return index >= 0 ? index : 0;
  }

  function monthsBeforeTishrei(hebrewYear) {
    const completedYears = Number(hebrewYear) - 1;
    const cycles = Math.floor(completedYears / 19);
    const yearInCycle = completedYears % 19;
    return (235 * cycles) + (12 * yearInCycle) + Math.floor((7 * yearInCycle + 1) / 19);
  }

  function buildMoladInfoForMonth(hebrewYear, monthKey) {
    const monthOffset = getMonthOffsetFromTishrei(hebrewYear, monthKey);
    const monthsElapsed = monthsBeforeTishrei(hebrewYear) + monthOffset;
    const totalHalakim = NEW_MOON_OF_CREATION + monthsElapsed * HALAKIM_PER_LUNAR_CYCLE;
    const absoluteDay = Math.floor(totalHalakim / HALAKIM_PER_DAY);
    const halakimOfDay = positiveModulo(totalHalakim, HALAKIM_PER_DAY);
    return {
      jewishDay: positiveModulo(absoluteDay, 7) + 1,
      jewishHour: Math.floor(halakimOfDay / HALAKIM_PER_HOUR),
      parts: positiveModulo(halakimOfDay, HALAKIM_PER_HOUR),
      month: monthOffset + 1
    };
  }

  function commercialHourMidaNumber(hebrewDay, hebrewHour) {
    const dayOffset = {
      1: 6,
      2: 2,
      3: 5,
      4: 1,
      5: 4,
      6: 7,
      7: 3
    }[hebrewDay] || 6;
    let index = positiveModulo(dayOffset + Number(hebrewHour), 7);
    if (index === 0) index = 7;
    return {
      1: 4,
      2: 1,
      3: 2,
      4: 3,
      5: 5,
      6: 6,
      7: 7
    }[index] || 1;
  }

  function midaForNumber(number) {
    const colors = {
      1: "#5DBCD2",
      2: "#A6230E",
      3: "#815AA8",
      4: "#84C45E",
      5: "#BA8D1A",
      6: "#B45D02",
      7: "#808080"
    };
    return colors[number] || colors[1];
  }

  function moladColorsForHebrewMonth(hebrewYear, monthKey) {
    const molad = buildMoladInfoForMonth(hebrewYear, monthKey);
    return {
      year: Number(hebrewYear),
      month: molad.month,
      monthKey: canonicalMoladMonthKey(monthKey),
      jewishDay: molad.jewishDay,
      jewishHour: molad.jewishHour,
      parts: molad.parts,
      dayColor: midaForNumber(molad.jewishDay),
      hourColor: midaForNumber(commercialHourMidaNumber(molad.jewishDay, molad.jewishHour))
    };
  }

  function drawingMonthsForYear(hebrewYear) {
    const adar = isHebrewLeapYear(hebrewYear)
      ? { key: "adarii", he: "אדר ב׳", en: "Adar II" }
      : { key: "adar", he: "אדר", en: "Adar" };
    return [
      { key: "kislev", he: "כסלו", en: "Kislev" },
      { key: "tevet", he: "טבת", en: "Tevet" },
      { key: "shevat", he: "שבט", en: "Shevat" },
      adar,
      { key: "nisan", he: "ניסן", en: "Nisan" },
      { key: "iyyar", he: "אייר", en: "Iyyar" },
      { key: "sivan", he: "סיוון", en: "Sivan" },
      { key: "tammuz", he: "תמוז", en: "Tammuz" }
    ];
  }

  function buildPoint(index, hebrewYear, month) {
    const molad = moladColorsForHebrewMonth(hebrewYear, month.key);
    return {
      index,
      hebrewYear,
      monthKey: month.key,
      hebrewName: month.he,
      englishName: month.en,
      jewishDay: molad.jewishDay,
      jewishHour: molad.jewishHour,
      parts: molad.parts,
      hourWithParts: molad.jewishHour + molad.parts / HALAKIM_PER_HOUR,
      hourText: `${pad(molad.jewishHour, 2)}:${pad(molad.parts, 4)}`,
      dayColor: molad.dayColor,
      hourColor: molad.hourColor
    };
  }

  function buildYear(hebrewYear) {
    const origin = buildPoint(0, hebrewYear, ORIGIN_MONTH);
    const points = drawingMonthsForYear(hebrewYear).map((month, index) => buildPoint(index + 1, hebrewYear, month));
    return { hebrewYear, displayYear: Number(hebrewYear) - HEBREW_YEAR_DISPLAY_OFFSET, origin, points };
  }

  function clampDisplayYear(displayYear) {
    return Math.max(MIN_DISPLAY_YEAR, Math.min(MAX_DISPLAY_YEAR, Math.trunc(Number(displayYear) || DEFAULT_DISPLAY_YEAR)));
  }

  function populateYearSelector() {
    const fragment = document.createDocumentFragment();
    for (let year = MIN_DISPLAY_YEAR; year <= MAX_DISPLAY_YEAR; year += 1) {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      fragment.appendChild(option);
    }
    elements.year.replaceChildren(fragment);
  }

  function currentHebrewYear() {
    const now = new Date();
    if (typeof window.hebrewDate === "function") {
      try {
        const date = window.hebrewDate(now.getFullYear(), now.getMonth() + 1, now.getDate(), "English");
        const year = Number(date && date.year);
        if (Number.isFinite(year) && year > 0) return year;
      } catch (_) {
        // Fall through to the stable civil-year approximation.
      }
    }
    return now.getFullYear() + 3760;
  }

  function hexToRgb(hex) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return match
      ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) }
      : { r: 128, g: 128, b: 128 };
  }

  function rgbToHex(color) {
    const toHex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  }

  function mixPointColors(points, path) {
    const totals = { r: 0, g: 0, b: 0, count: 0 };
    for (const index of path.slice(0, 3)) {
      const point = points.find((item) => item.index === index);
      if (!point) continue;
      for (const color of [point.dayColor, point.hourColor]) {
        const rgb = hexToRgb(color);
        totals.r += rgb.r;
        totals.g += rgb.g;
        totals.b += rgb.b;
        totals.count += 1;
      }
    }
    if (!totals.count) return "#BA8D1A";
    return rgbToHex({
      r: totals.r / totals.count,
      g: totals.g / totals.count,
      b: totals.b / totals.count
    });
  }

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }
    return element;
  }

  function pointToSvg(point) {
    const x = VIEW.plotLeft + ((Math.max(1, Math.min(7, point.jewishDay)) - 1) / 6) * VIEW.plotWidth;
    const y = VIEW.plotTop + (1 - Math.max(0, Math.min(24, point.hourWithParts)) / 24) * VIEW.plotHeight;
    return { x, y };
  }

  function pointsAttribute(points) {
    return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  }

  function trianglePointList(points, path) {
    return path
      .slice(0, 3)
      .map((index) => points.find((point) => point.index === index))
      .filter(Boolean)
      .map(pointToSvg);
  }

  function trianglePoints(points, path) {
    return pointsAttribute(trianglePointList(points, path));
  }

  function polylinePoints(points, path) {
    return pointsAttribute(path
      .map((index) => points.find((point) => point.index === index))
      .filter(Boolean)
      .map(pointToSvg));
  }

  function appendText(svg, text, x, y, className, anchor = "middle") {
    const element = svgElement("text", {
      x,
      y,
      class: className,
      "text-anchor": anchor
    });
    element.textContent = text;
    svg.appendChild(element);
    return element;
  }

  function drawGrid(svg) {
    svg.appendChild(svgElement("rect", {
      class: "hidden-plot",
      x: VIEW.plotLeft,
      y: VIEW.plotTop,
      width: VIEW.plotWidth,
      height: VIEW.plotHeight
    }));

    for (let day = 1; day <= 7; day += 1) {
      const x = VIEW.plotLeft + ((day - 1) / 6) * VIEW.plotWidth;
      svg.appendChild(svgElement("line", {
        class: day === 1 || day === 7 ? "hidden-grid-major" : "hidden-grid",
        x1: x,
        y1: VIEW.plotTop,
        x2: x,
        y2: VIEW.plotTop + VIEW.plotHeight
      }));
      appendText(svg, String(day), x, VIEW.plotTop + VIEW.plotHeight + 25, "hidden-axis");
    }

    for (let hour = 0; hour <= 24; hour += 6) {
      const y = VIEW.plotTop + (1 - hour / 24) * VIEW.plotHeight;
      svg.appendChild(svgElement("line", {
        class: "hidden-grid-major",
        x1: VIEW.plotLeft,
        y1: y,
        x2: VIEW.plotLeft + VIEW.plotWidth,
        y2: y
      }));
      appendText(svg, pad(hour, 2), VIEW.plotLeft - 16, y + 4, "hidden-axis", "end");
    }
  }

  function drawOrigin(svg, origin) {
    const point = pointToSvg(origin);
    svg.appendChild(svgElement("circle", {
      class: "hidden-origin",
      cx: point.x,
      cy: point.y,
      r: 5
    }));
    appendText(svg, origin.hebrewName, point.x + 12, point.y + 4, "hidden-origin-label", "start");
  }

  function drawNetwork(svg, year) {
    const outlineColor = mixPointColors(year.points, TRIANGLE_OUTLINE);
    const backgroundColor = mixPointColors(year.points, TRIANGLE_BACKGROUND);
    const outlinePoints = trianglePoints(year.points, TRIANGLE_OUTLINE);
    const backgroundPoints = trianglePoints(year.points, TRIANGLE_BACKGROUND);

    const fillGroup = svgElement("g", { class: "hidden-star-fill" });
    fillGroup.appendChild(svgElement("polygon", { points: backgroundPoints, fill: backgroundColor }));
    fillGroup.appendChild(svgElement("polygon", { points: outlinePoints, fill: backgroundColor }));
    svg.appendChild(fillGroup);

    svg.appendChild(svgElement("polyline", {
      class: "hidden-star-outline hidden-outline-glow",
      points: polylinePoints(year.points, TRIANGLE_BACKGROUND),
      stroke: outlineColor
    }));
    svg.appendChild(svgElement("polyline", {
      class: "hidden-star-outline hidden-outline-glow",
      points: polylinePoints(year.points, TRIANGLE_OUTLINE),
      stroke: outlineColor
    }));
    svg.appendChild(svgElement("polyline", {
      class: "hidden-star-outline",
      points: polylinePoints(year.points, TRIANGLE_BACKGROUND),
      stroke: outlineColor
    }));
    svg.appendChild(svgElement("polyline", {
      class: "hidden-star-outline",
      points: polylinePoints(year.points, TRIANGLE_OUTLINE),
      stroke: outlineColor
    }));

    for (const point of year.points) {
      const position = pointToSvg(point);
      const labelOffset = point.index % 2 === 0 ? 28 : -18;
      svg.appendChild(svgElement("circle", {
        class: "hidden-point-shadow",
        cx: position.x + 2,
        cy: position.y + 2,
        r: point.index <= 6 ? 11 : 9
      }));
      svg.appendChild(svgElement("circle", {
        class: "hidden-point",
        cx: position.x,
        cy: position.y,
        r: point.index <= 6 ? 10 : 8,
        fill: point.dayColor,
        stroke: point.hourColor
      }));
      appendText(svg, String(point.index), position.x, position.y + 4, "hidden-point-number");
      appendText(svg, point.hebrewName, position.x, position.y + labelOffset, "hidden-point-label");
    }
  }

  function renderLegend(year) {
    elements.legend.replaceChildren();
    for (const point of year.points) {
      const item = document.createElement("div");
      item.className = "hidden-legend-item";

      const swatch = document.createElement("span");
      swatch.className = "hidden-legend-swatch";
      swatch.style.background = point.dayColor;
      swatch.style.borderColor = point.hourColor;

      const title = document.createElement("b");
      title.textContent = `${point.index}. ${point.hebrewName}`;

      const time = document.createElement("span");
      time.textContent = "יום " + point.jewishDay + " · " + point.hourText;

      item.append(swatch, title, time);
      elements.legend.appendChild(item);
    }
  }

  function render() {
    const requestedDisplayYear = clampDisplayYear(elements.year.value);
    elements.year.value = String(requestedDisplayYear);
    const year = buildYear(requestedDisplayYear + HEBREW_YEAR_DISPLAY_OFFSET);
    elements.title.textContent = "HiddenStarr · " + String(requestedDisplayYear).padStart(4, "0") + " · " + year.hebrewYear;
    elements.network.replaceChildren();

    const svg = svgElement("svg", {
      viewBox: `0 0 ${VIEW.width} ${VIEW.height}`,
      role: "img",
      "aria-label": `HiddenStarr network for represented Hebrew year ${requestedDisplayYear} (Hebrew year ${year.hebrewYear})`
    });
    drawGrid(svg);
    drawOrigin(svg, year.origin);
    drawNetwork(svg, year);
    elements.network.appendChild(svg);
    renderLegend(year);
  }

  function openPanel() {
    elements.panel.hidden = false;
    render();
  }

  function closePanel() {
    elements.panel.hidden = true;
  }

  populateYearSelector();
  elements.year.value = String(DEFAULT_DISPLAY_YEAR);
  elements.year.addEventListener("input", render);
  elements.year.addEventListener("change", render);
  elements.open.addEventListener("click", openPanel);
  elements.dateButton.addEventListener("click", openPanel);
  elements.close.addEventListener("click", closePanel);
  elements.network.addEventListener("dblclick", render);
  elements.panel.addEventListener("click", function (event) {
    if (event.target === elements.panel) closePanel();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !elements.panel.hidden) closePanel();
  });
})();
