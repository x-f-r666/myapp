import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sparkline, lineChart, barChart, donut, progressRing, compact, CHART_COLORS } from '../public/js/components/charts.js';

const svgClosed = (html) => (html.match(/<svg/g) || []).length === (html.match(/<\/svg>/g) || []).length;
const noBadNumbers = (html) => !/NaN|Infinity|undefined/.test(html);

test('compact 数字压缩（万/亿/k）', () => {
  assert.equal(compact(0), '0');
  assert.equal(compact(999), '999');
  assert.equal(compact(1200), '1.2k');
  assert.equal(compact(12345), '1.2万');
  assert.equal(compact(1234567), '123万');
  assert.equal(compact(123456789), '1.2亿');
  assert.equal(compact('abc'), '0');
});

test('sparkline：空数据给占位，单点不报错', () => {
  assert.match(sparkline([]), /暂无数据/);
  const one = sparkline([42]);
  assert.match(one, /<svg/);
  assert.ok(svgClosed(one));
  assert.ok(noBadNumbers(one));
});

test('sparkline：全 0 序列给占位而不是一条贴底的假线', () => {
  const html = sparkline([0, 0, 0, 0]);
  assert.match(html, /暂无趋势/);
  assert.ok(!html.includes('<svg'), '全 0 不应画线');
});

test('lineChart：多序列、空数据、全 0', () => {
  const html = lineChart({
    labels: ['11/1', '11/2', '11/3'],
    series: [
      { name: '播放', values: [100, 200, 150] },
      { name: '涨粉', values: [1, 3, 2], color: '#C07A45' },
    ],
  });
  assert.ok(svgClosed(html));
  assert.ok(noBadNumbers(html));
  assert.equal((html.match(/<polyline/g) || []).length, 2);
  assert.ok(html.includes('11/2'));

  assert.match(lineChart({ labels: [], series: [] }), /暂无数据/);
  const zero = lineChart({ labels: ['a', 'b'], series: [{ values: [0, 0] }] });
  assert.ok(svgClosed(zero));
  assert.ok(noBadNumbers(zero));
});

test('lineChart：单点也能画（不出现负宽度/NaN）', () => {
  const html = lineChart({ labels: ['今天'], series: [{ values: [7] }] });
  assert.ok(svgClosed(html));
  assert.ok(noBadNumbers(html));
});

test('barChart：纵向与横向，空数据占位', () => {
  const v = barChart({ labels: ['抖音', 'B站'], values: [3000, 500] });
  assert.ok(svgClosed(v));
  assert.ok(noBadNumbers(v));
  assert.equal((v.match(/<rect/g) || []).length, 2);

  const h = barChart({ labels: ['项目A', '项目B'], values: [5.5, 4], horizontal: true, valueFormat: (x) => `${x}h` });
  assert.ok(svgClosed(h));
  assert.ok(noBadNumbers(h));
  assert.ok(h.includes('项目A'));

  assert.match(barChart({ labels: [], values: [] }), /暂无数据/);
});

test('donut：占比与图例，全 0 给占位', () => {
  const html = donut({
    items: [
      { label: '胸', value: 3 },
      { label: '背', value: 2 },
      { label: '腿', value: 0 },
    ],
    centerValue: '5',
    centerLabel: '次',
  });
  assert.ok(svgClosed(html));
  assert.ok(noBadNumbers(html));
  // 0 值不进入图例
  assert.equal((html.match(/legend-dot/g) || []).length, 2);
  assert.ok(html.includes('胸'));

  assert.match(donut({ items: [{ label: 'a', value: 0 }] }), /暂无数据/);
  assert.match(donut({ items: [] }), /暂无数据/);
});

test('progressRing：百分比夹取到 0-100，超目标不溢出', () => {
  assert.ok(progressRing({ value: 50, max: 100 }).includes('50%'));
  assert.ok(progressRing({ value: 300, max: 100 }).includes('100%'));
  assert.ok(progressRing({ value: -5, max: 100 }).includes('0%'));
  assert.ok(noBadNumbers(progressRing({ value: 0, max: 0 })));
});

test('调色板数量足够给多个序列复用', () => {
  assert.ok(CHART_COLORS.length >= 5);
  CHART_COLORS.forEach((c) => assert.match(c, /^#[0-9A-Fa-f]{6}$/));
});
