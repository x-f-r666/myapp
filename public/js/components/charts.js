/** 纯手写 SVG 图表：无外部依赖、离线可用、风格统一。全部返回 HTML 字符串。 */

export const CHART_COLORS = ['#2C6353', '#C07A45', '#3F6A8A', '#8A5F8F', '#7C8B4E', '#B0453A', '#5C7A6E'];

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

export function compact(n) {
  const v = num(n);
  const abs = Math.abs(v);
  if (abs >= 100000000) return `${(v / 100000000).toFixed(1)}亿`;
  if (abs >= 10000) return `${(v / 10000).toFixed(abs >= 100000 ? 0 : 1)}万`;
  if (abs >= 1000) return `${(v / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

/** 让刻度落在 1 / 2 / 2.5 / 5 的整数倍上，避免出现 8.8k 这种奇怪标注 */
export function niceScale(min, max, ticks = 4) {
  const span = max - min || 1;
  const rough = span / ticks;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return {
    lo: Math.floor(min / step) * step,
    hi: Math.ceil(max / step) * step,
    step,
  };
}

let uidSeq = 0;
const nextId = (p) => `${p}_${(uidSeq += 1)}`;

const emptyBox = (h = 160, text = '暂无数据') =>
  `<div class="chart-empty" style="min-height:${h}px"><span class="chart-empty-dot"></span>${esc(text)}</div>`;

/* --------------------------------- 迷你折线 -------------------------------- */

export function sparkline(values = [], { width = 132, height = 38, color = '#2C6353', fill = true } = {}) {
  const vals = values.map(num);
  if (vals.length === 0) return emptyBox(height, '暂无数据');
  if (vals.every((v) => v === 0)) return emptyBox(height, '暂无趋势');
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const span = max - min || Math.max(max, 1);
  const stepX = vals.length > 1 ? width / (vals.length - 1) : width;
  const y = (v) => height - 4 - ((v - min) / span) * (height - 8);
  const pts = vals.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`);
  const id = nextId('spark');
  const area = `<path d="M0,${height} L${pts.join(' L')} L${width},${height} Z" fill="url(#${id})" />`;
  const grad = fill
    ? `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`
    : '';
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="趋势">${grad}${
    fill ? area : ''
  }<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${
    (vals.length - 1) * stepX
  }" cy="${y(vals[vals.length - 1])}" r="2.6" fill="${color}"/></svg>`;
}

/* --------------------------------- 折线图 --------------------------------- */

export function lineChart({
  labels = [],
  series = [],
  height = 210,
  width = 680,
  yFormat = compact,
  area = true,
  valueSuffix = '',
} = {}) {
  const clean = series.map((s) => ({ ...s, values: (s.values || []).map(num) }));
  const totalPoints = clean.reduce((a, s) => a + s.values.length, 0);
  if (!labels.length || totalPoints === 0) return emptyBox(height, '暂无数据');

  const W = width;
  const H = height;
  const narrow = W < 460;
  const padL = narrow ? 34 : 46;
  const padR = narrow ? 8 : 14;
  const padT = 14;
  const padB = narrow ? 22 : 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const all = clean.flatMap((s) => s.values);
  const rawMax = Math.max(...all, 0);
  const rawMin = Math.min(...all, 0);
  const { lo, hi, step } = niceScale(rawMin, rawMax === rawMin ? rawMin + 1 : rawMax, narrow ? 3 : 4);
  const span = hi - lo || 1;

  const n = labels.length;
  const x = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => padT + innerH - ((v - lo) / span) * innerH;

  const grid = [];
  for (let v = lo; v <= hi + step / 2; v += step) {
    const yy = y(v);
    grid.push(
      `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="#EDE9E0" stroke-width="1" ${
        v === lo ? '' : 'stroke-dasharray="2 4"'
      }/>` +
        `<text x="${padL - 6}" y="${(yy + 3.5).toFixed(1)}" text-anchor="end" class="chart-axis">${esc(yFormat(v))}</text>`
    );
  }

  const labelEvery = Math.max(1, Math.ceil(n / (narrow ? 4 : 6)));
  const xLabels = labels
    .map((lab, i) =>
      i % labelEvery === 0 || i === n - 1
        ? `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="chart-axis">${esc(lab)}</text>`
        : ''
    )
    .join('');

  const defs = [];
  const paths = clean
    .map((s, si) => {
      const color = s.color || CHART_COLORS[si % CHART_COLORS.length];
      const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      if (pts.length === 0) return '';
      const id = nextId('lc');
      if (area) {
        defs.push(
          `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.16"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>`
        );
      }
      const areaPath = area
        ? `<path d="M${x(0).toFixed(1)},${(padT + innerH).toFixed(1)} L${pts.join(' L')} L${x(
            s.values.length - 1
          ).toFixed(1)},${(padT + innerH).toFixed(1)} Z" fill="url(#${id})"/>`
        : '';
      const dots = s.values
        .map(
          (v, i) =>
            `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${narrow ? 2 : 2.4}" fill="#fff" stroke="${color}" stroke-width="1.5"><title>${esc(
              labels[i]
            )} · ${esc(compact(v))}${esc(valueSuffix)}</title></circle>`
        )
        .join('');
      return `${areaPath}<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
    })
    .join('');

  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="折线图"><defs>${defs.join(
    ''
  )}</defs>${grid.join('')}${xLabels}${paths}</svg></div>`;
}

/* --------------------------------- 柱状图 --------------------------------- */

export function barChart({
  labels = [],
  values = [],
  height = 200,
  width = null,
  color = '#2C6353',
  yFormat = compact,
  valueFormat = compact,
  horizontal = false,
} = {}) {
  const vals = values.map(num);
  if (!labels.length || vals.length === 0) return emptyBox(height, '暂无数据');

  if (horizontal) {
    const W = width || 420;
    const rowH = 30;
    const chartH = Math.max(60, rowH * vals.length + 8);
    const max = Math.max(...vals, 1);
    const labelW = Math.min(110, Math.max(60, Math.round(W * 0.26)));
    const valueW = 52;
    const barMaxW = W - labelW - valueW - 8;
    const rows = labels
      .map((lab, i) => {
        const w = Math.max(vals[i] > 0 ? 3 : 0, (vals[i] / max) * barMaxW);
        const yy = 4 + i * rowH;
        const c = Array.isArray(color) ? color[i % color.length] : color;
        return `<text x="${labelW - 8}" y="${yy + rowH / 2 + 4}" text-anchor="end" class="chart-axis chart-axis-strong">${esc(lab)}</text>
          <rect x="${labelW}" y="${yy + rowH / 2 - 5}" width="${barMaxW}" height="10" rx="5" fill="#F0EDE5"/>
          <rect x="${labelW}" y="${yy + rowH / 2 - 5}" width="${w.toFixed(1)}" height="10" rx="5" fill="${c}"/>
          <text x="${labelW + barMaxW + 6}" y="${yy + rowH / 2 + 4}" class="chart-axis">${esc(valueFormat(vals[i]))}</text>`;
      })
      .join('');
    return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${chartH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="横向柱状图">${rows}</svg></div>`;
  }

  const W = width || 680;
  const H = height;
  const padL = 40;
  const padR = 10;
  const padT = 16;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxRaw = Math.max(...vals, 1);
  const { lo, hi, step } = niceScale(0, maxRaw, 3);
  const span = hi - lo || 1;
  const slot = innerW / vals.length;
  const barW = Math.min(40, slot * 0.55);

  const grid = [];
  for (let v = lo; v <= hi + step / 2; v += step) {
    const yy = padT + innerH - ((v - lo) / span) * innerH;
    grid.push(
      `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="#EDE9E0" ${
        v === lo ? '' : 'stroke-dasharray="2 4"'
      }/><text x="${padL - 8}" y="${(yy + 3.5).toFixed(1)}" text-anchor="end" class="chart-axis">${esc(yFormat(v))}</text>`
    );
  }

  const bars = vals
    .map((v, i) => {
      const h = (v / span) * innerH;
      const bx = padL + slot * i + (slot - barW) / 2;
      const by = padT + innerH - h;
      const c = Array.isArray(color) ? color[i % color.length] : color;
      const label = labels[i];
      return `<g><rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(
        h,
        v > 0 ? 2 : 0
      ).toFixed(1)}" rx="4" fill="${c}"><title>${esc(label)} · ${esc(valueFormat(v))}</title></rect>
        <text x="${(bx + barW / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="chart-axis">${esc(label)}</text></g>`;
    })
    .join('');

  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="柱状图">${grid.join(
    ''
  )}${bars}</svg></div>`;
}

/* ---------------------------------- 环形 ---------------------------------- */

export function donut({ items = [], size = 150, thickness = 18, centerValue = '', centerLabel = '' } = {}) {
  const clean = items.filter((i) => num(i.value) > 0);
  const total = clean.reduce((a, i) => a + num(i.value), 0);
  if (total <= 0) return emptyBox(size, '暂无数据');

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const rings = clean
    .map((item, i) => {
      const frac = num(item.value) / total;
      const dash = frac * c;
      const color = item.color || CHART_COLORS[i % CHART_COLORS.length];
      const seg = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${thickness}"
        stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"
        transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="butt"><title>${esc(item.label)} · ${esc(
        item.value
      )}</title></circle>`;
      offset += dash;
      return seg;
    })
    .join('');

  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="占比图">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#F0EDE5" stroke-width="${thickness}"/>
    ${rings}
    ${
      centerValue
        ? `<text x="${size / 2}" y="${size / 2 + (centerLabel ? -2 : 6)}" text-anchor="middle" class="donut-value">${esc(
            centerValue
          )}</text>`
        : ''
    }
    ${centerLabel ? `<text x="${size / 2}" y="${size / 2 + 16}" text-anchor="middle" class="donut-label">${esc(centerLabel)}</text>` : ''}
  </svg><ul class="legend">${clean
    .map(
      (item, i) =>
        `<li><span class="legend-dot" style="background:${item.color || CHART_COLORS[i % CHART_COLORS.length]}"></span><span class="legend-label">${esc(
          item.label
        )}</span><span class="legend-value">${esc(item.value)}</span></li>`
    )
    .join('')}</ul></div>`;
}

/* --------------------------------- 进度环 -------------------------------- */

export function progressRing({
  value = 0,
  max = 100,
  size = 104,
  thickness = 10,
  color = '#2C6353',
  label = '',
  sub = '',
} = {}) {
  const m = num(max);
  const v = num(value);
  const pct = m > 0 ? Math.max(0, Math.min(1, v / m)) : 0;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = pct * c;
  return `<div class="ring-wrap"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(
    label
  )} ${Math.round(pct * 100)}%">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#EDE9E0" stroke-width="${thickness}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round"
      stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="${size / 2}" y="${size / 2 + 1}" text-anchor="middle" class="ring-value">${Math.round(pct * 100)}%</text>
    ${sub ? `<text x="${size / 2}" y="${size / 2 + 18}" text-anchor="middle" class="ring-sub">${esc(sub)}</text>` : ''}
  </svg></div>`;
}
