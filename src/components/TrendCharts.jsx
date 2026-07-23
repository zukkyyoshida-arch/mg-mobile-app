/* eslint-disable react-refresh/only-export-components */
// 上記ルールを無効化する理由:
// このファイルは算出ロジック（buildTrendData 等）を純粋関数として
// node -e から直接 require/import してテストできるよう、あえてコンポーネントと
// 同一ファイルから複数 export している（タスク要件）。Fast Refresh の対象外になるだけで、
// 動作・ビルドには影響しない。
import { useMemo, useState } from 'react';
import { calculateFinancials } from '../utils/calculations';

/**
 * 期別推移グラフ (TrendCharts)
 *
 * props:
 *  - periods: App.jsx が保持する全期データ { [periodNumber]: { carryover, ledger, actuals, budget } }
 *  - currentPeriod: 現在の期番号
 *
 * 外部ライブラリ非依存。素のSVG（viewBox + width:100%）で描画する。
 */

// ---- 系列定義（純粋データ、UIから分離） ----
export const TREND_SERIES = [
  { key: 'netAssets', label: '純資産(サ)', varName: '--mg-pink' },
  { key: 'sales', label: '売上(PQ)', varName: '--mg-blue' },
  { key: 'profit', label: '経常利益(G)', varName: '--mg-green' },
  { key: 'cash', label: '現金残高', varName: '--mg-yellow' }
];

/**
 * 1期分のデータが「入力済み」かどうかを判定する純粋関数。
 * ledger に仕訳が1件でもあるか、carryover が初期値(資本金300円/現金300円のみ)から
 * 変化していれば「データあり」とみなす。
 */
export function isPeriodPopulated(periodData) {
  if (!periodData) return false;
  const hasLedger = Array.isArray(periodData.ledger) && periodData.ledger.length > 0;
  if (hasLedger) return true;

  const c = periodData.carryover;
  if (!c) return false;
  // 初期デフォルト (cash:300, capital:300, 他0) から何か変化していれば「入力あり」とみなす
  const defaultLikeKeys = ['materialsCount', 'materialsValue', 'wipCount', 'wipValue', 'productCount', 'productValue', 'machinesCount', 'machinesValue', 'loan', 'receivables', 'payables', 'retainedEarnings', 'workers', 'salesmen'];
  const changedFromDefault = defaultLikeKeys.some(k => Number(c[k]) !== 0);
  const capitalChanged = Number(c.cash) !== 300 || Number(c.capital) !== 300;
  return changedFromDefault || capitalChanged;
}

/**
 * periods オブジェクトから、期別の期末値サマリー配列を算出する純粋関数。
 * データが空の期は除外する。第1期〜第5期のみ対象（戦略MG研修の期数に合わせる）。
 *
 * 戻り値: [{ period, netAssets, sales, profit, cash }, ...] period昇順
 */
export function buildTrendData(periods) {
  if (!periods) return [];
  const result = [];
  for (let p = 1; p <= 5; p++) {
    const pData = periods[p];
    if (!isPeriodPopulated(pData)) continue;
    try {
      const r = calculateFinancials(pData.carryover, pData.ledger, pData.actuals, p);
      result.push({
        period: p,
        netAssets: r?.bs?.totalNetAssets || 0,
        sales: r?.pl?.salesRevenue || 0,
        profit: r?.pl?.operatingProfit || 0,
        cash: r?.bs?.cash || 0
      });
    } catch (e) {
      // 計算に失敗した期はグラフから除外（壊れたデータで全体を落とさない）
      console.error(`TrendCharts: calculateFinancials failed for period ${p}`, e);
    }
  }
  return result;
}

/**
 * 折れ線グラフ用に、データ配列とキーからSVGの polyline points 文字列と
 * 各点の座標を算出する純粋関数。min/max を渡さない場合は当該系列単独のレンジを使う。
 *
 * @param {Array} data - buildTrendData() の戻り値
 * @param {string} key - 系列キー ('netAssets' など)
 * @param {object} opts - { width, height, padLeft, padRight, padTop, padBottom, min, max }
 */
export function computeLinePoints(data, key, opts = {}) {
  const width = opts.width ?? 320;
  const height = opts.height ?? 200;
  const padLeft = opts.padLeft ?? 44;
  const padRight = opts.padRight ?? 12;
  const padTop = opts.padTop ?? 12;
  const padBottom = opts.padBottom ?? 28;

  const innerW = Math.max(1, width - padLeft - padRight);
  const innerH = Math.max(1, height - padTop - padBottom);

  const values = data.map(d => Number(d[key]) || 0);
  let min = opts.min ?? Math.min(0, ...values);
  let max = opts.max ?? Math.max(0, ...values);
  if (min === max) {
    // 全て同値（0含む）の場合、見た目上のレンジを確保
    min -= 1;
    max += 1;
  }
  const range = max - min;

  const points = data.map((d, i) => {
    const x = data.length === 1
      ? padLeft + innerW / 2
      : padLeft + (innerW * i) / (data.length - 1);
    const v = Number(d[key]) || 0;
    const y = padTop + innerH * (1 - (v - min) / range);
    return { x, y, value: v, period: d.period };
  });

  const zeroY = padTop + innerH * (1 - (0 - min) / range);

  return {
    points,
    zeroY,
    pointsAttr: points.map(p => `${p.x},${p.y}`).join(' '),
    width,
    height,
    min,
    max
  };
}

/**
 * 複数系列を通じた共通の [min, max] レンジを算出する純粋関数。
 * 0を必ず含める（G/経常利益が赤字の期があっても軸が破綻しないように）。
 */
export function computeSharedRange(data, keys) {
  const values = data.flatMap(d => keys.map(k => Number(d[k]) || 0));
  const min = Math.min(0, ...(values.length ? values : [0]));
  const max = Math.max(0, ...(values.length ? values : [0]));
  return { min, max };
}

function formatYen(v) {
  const n = Math.round(Number(v) || 0);
  return `${n >= 0 ? '' : '-'}¥${Math.abs(n).toLocaleString()}万`;
}

function TrendChart({ title, data, seriesKeys, visibleKeys, colorFor }) {
  const width = 320;
  const height = 200;
  const activeKeys = seriesKeys.filter(k => visibleKeys.has(k));

  // 全表示系列を通じた共通スケールにするため、まとめてmin/maxを算出
  const { min: globalMin, max: globalMax } = computeSharedRange(data, activeKeys);

  const seriesGeom = {};
  activeKeys.forEach(key => {
    seriesGeom[key] = computeLinePoints(data, key, { width, height, min: globalMin, max: globalMax });
  });

  const gridLines = buildGridLines(globalMin, globalMax, { height });

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={title}
      >
        {/* グリッド線 + 目盛りラベル */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={44}
              x2={width - 12}
              y1={g.y}
              y2={g.y}
              stroke="var(--border-glass, rgba(128,128,128,0.2))"
              strokeWidth="1"
            />
            <text x={2} y={g.y + 3} fontSize="8" fill="var(--text-muted)">
              {g.label}
            </text>
          </g>
        ))}

        {/* 各系列の折れ線＋点 */}
        {seriesKeys.filter(k => visibleKeys.has(k)).map(key => {
          const geom = seriesGeom[key];
          if (!geom) return null;
          const color = colorFor(key);
          return (
            <g key={key}>
              <polyline
                points={geom.pointsAttr}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {geom.points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="3.5" fill={color} stroke="var(--bg-card, #1c1e29)" strokeWidth="1" />
                </g>
              ))}
            </g>
          );
        })}

        {/* X軸: 期ラベル */}
        {data.map((d, i) => {
          const x = data.length === 1 ? 44 + (width - 44 - 12) / 2 : 44 + ((width - 44 - 12) * i) / (data.length - 1);
          return (
            <text key={i} x={x} y={height - 8} fontSize="9" textAnchor="middle" fill="var(--text-secondary)">
              第{d.period}期
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function buildGridLines(min, max, opts) {
  const height = opts.height ?? 200;
  const padTop = 12;
  const padBottom = 28;
  const innerH = height - padTop - padBottom;
  let lo = min, hi = max;
  if (lo === hi) { lo -= 1; hi += 1; }
  const range = hi - lo;

  const steps = 4;
  const lines = [];
  for (let i = 0; i <= steps; i++) {
    const v = lo + (range * i) / steps;
    const y = padTop + innerH * (1 - (v - lo) / range);
    lines.push({ y, label: `${Math.round(v).toLocaleString()}` });
  }
  return lines;
}

export default function TrendCharts({ periods, currentPeriod }) {
  const data = useMemo(() => buildTrendData(periods), [periods]);
  const [visibleKeys, setVisibleKeys] = useState(() => new Set(TREND_SERIES.map(s => s.key)));

  const colorFor = (key) => {
    const series = TREND_SERIES.find(s => s.key === key);
    return `var(${series?.varName || '--text-primary'})`;
  };

  const toggleKey = (key) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        // 最後の1系列は非表示にしない（グラフが空になるのを防ぐ）
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (data.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          まだ推移データがありません。出納帳に取引を入力すると、期末値がここに表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '4px', color: 'var(--text-primary)' }}>
        📈 期別推移
      </h3>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        第{data[0].period}期〜第{data[data.length - 1].period}期の期末値推移（現在: 第{currentPeriod}期）
      </p>

      {data.length === 1 && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          データが1期分のみのため、点のみ表示しています。期が進むと折れ線になります。
        </p>
      )}

      {/* 凡例（クリックで表示/非表示トグル） */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {TREND_SERIES.map(s => {
          const active = visibleKeys.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleKey(s.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '999px',
                border: `1px solid ${active ? colorFor(s.key) : 'var(--border-glass)'}`,
                background: active ? 'var(--surface-subtle, rgba(128,128,128,0.08))' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.7rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              type="button"
              aria-pressed={active}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: active ? colorFor(s.key) : 'var(--text-muted)', display: 'inline-block' }} />
              {s.label}
            </button>
          );
        })}
      </div>

      <TrendChart
        title="期別推移グラフ"
        data={data}
        seriesKeys={TREND_SERIES.map(s => s.key)}
        visibleKeys={visibleKeys}
        colorFor={colorFor}
      />

      {/* 直近期の数値サマリー（読み上げ・数値確認用） */}
      <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
        {TREND_SERIES.filter(s => visibleKeys.has(s.key)).map(s => {
          const last = data[data.length - 1];
          return (
            <div key={s.key} style={{ background: 'var(--surface-subtle, rgba(128,128,128,0.06))', borderRadius: '10px', padding: '8px 10px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{s.label} (第{last.period}期)</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: colorFor(s.key) }}>{formatYen(last[s.key])}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
