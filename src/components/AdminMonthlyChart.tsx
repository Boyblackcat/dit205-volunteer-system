'use client';

import React, { useState } from 'react';
import { BarChart3, Calendar, Award, Layers } from 'lucide-react';

export interface MonthlyStatItem {
  month?: number;
  year?: string;
  label: string;
  fullLabel: string;
  term1ApprovedHours: number;
  term2ApprovedHours: number;
  term1PendingHours: number;
  term2PendingHours: number;
  term1ActivitiesCount: number;
  term2ActivitiesCount: number;
  term1RegistrationsCount: number;
  term2RegistrationsCount: number;
  approvedHours: number;
  pendingHours: number;
  activitiesCount: number;
  registrationsCount: number;
}

interface AdminMonthlyChartProps {
  data: MonthlyStatItem[];
  yearlyData?: MonthlyStatItem[];
  chartMode?: 'monthly' | 'yearly';
  activeTab?: 'hours' | 'activity';
  periodLabel: string;
}

export const AdminMonthlyChart: React.FC<AdminMonthlyChartProps> = ({
  data,
  yearlyData,
  chartMode = 'monthly',
  activeTab = 'hours',
  periodLabel,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const isYearlyMode =
    chartMode === 'yearly' && Array.isArray(yearlyData) && yearlyData.length > 0;
  const chartItems = isYearlyMode ? yearlyData! : data;

  const getItemKey = (item: MonthlyStatItem, idx: number) =>
    item.year ? `yr-${item.year}` : `m-${item.month ?? idx}`;

  // Term 1 vs Term 2 totals across the active period
  const totalT1Hours = chartItems.reduce((sum, d) => sum + (d.term1ApprovedHours || 0), 0);
  const totalT2Hours = chartItems.reduce((sum, d) => sum + (d.term2ApprovedHours || 0), 0);
  const totalT1Acts = chartItems.reduce((sum, d) => sum + (d.term1ActivitiesCount || 0), 0);
  const totalT2Acts = chartItems.reduce((sum, d) => sum + (d.term2ActivitiesCount || 0), 0);

  const peakItem = chartItems.reduce(
    (best, cur) => (cur.approvedHours > best.approvedHours ? cur : best),
    chartItems[0] || { fullLabel: '-', approvedHours: 0 }
  );

  // Max scales for grouped bar charts (Term 1 vs Term 2)
  const maxHours = Math.max(
    10,
    ...chartItems.map((d) => Math.max(d.term1ApprovedHours || 0, d.term2ApprovedHours || 0))
  );
  const yMaxHours = Math.ceil(maxHours / 5) * 5;

  const maxActs = Math.max(
    5,
    ...chartItems.map((d) => Math.max(d.term1ActivitiesCount || 0, d.term2ActivitiesCount || 0))
  );
  const yMaxActs = Math.ceil(maxActs / 5) * 5;

  const activeItem =
    hoveredKey !== null
      ? chartItems.find((d, i) => getItemKey(d, i) === hoveredKey) || null
      : null;

  // Shared SVG geometry
  const chartW = Math.max(720, chartItems.length * 64);
  const chartH = 240;
  const padL = 44;
  const padR = 20;
  const padT = 22;
  const padB = 34;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const getY = (val: number, maxVal: number) => padT + innerH - (val / maxVal) * innerH;

  const isHoursTab = activeTab === 'hours';
  const yMax = isHoursTab ? yMaxHours : yMaxActs;
  const term1Color = isHoursTab ? '#10b981' : '#3b82f6';
  const term2Color = isHoursTab ? '#f59e0b' : '#8b5cf6';
  const hoverAccentClass = isHoursTab ? 'text-emerald-500' : 'text-blue-500';
  const hoverLabelClass = isHoursTab ? 'text-emerald-600' : 'text-blue-600';

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                {isHoursTab
                  ? isYearlyMode
                    ? 'กราฟชั่วโมงทุนเปรียบเทียบทุกปีการศึกษา'
                    : 'กราฟชั่วโมงทุนรายเดือน'
                  : isYearlyMode
                  ? 'กราฟกิจกรรมเปรียบเทียบทุกปีการศึกษา'
                  : 'กราฟกิจกรรมรายเดือน'}
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {periodLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isYearlyMode
                ? 'เปรียบเทียบยอดเทอม 1 และเทอม 2 ครบทุกปีการศึกษา'
                : 'เปรียบเทียบยอดเทอม 1 และเทอม 2 แยกตามเดือน มกราคม – ธันวาคม'}
            </p>
          </div>
        </div>
      </div>

      {/* Term 1 vs Term 2 Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5 sm:px-6 bg-slate-50/70 border-b border-slate-100">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>ชั่วโมงทุน เทอม 1</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">
            {totalT1Hours} <span className="text-xs font-normal text-slate-500">ชม.</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>ชั่วโมงทุน เทอม 2</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-extrabold text-amber-600 mt-1">
            {totalT2Hours} <span className="text-xs font-normal text-slate-500">ชม.</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>กิจกรรม เทอม 1 / เทอม 2</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            <span className="text-blue-600">{totalT1Acts}</span>
            <span className="text-slate-400 mx-1 text-base">/</span>
            <span className="text-purple-600">{totalT2Acts}</span>{' '}
            <span className="text-xs font-normal text-slate-500">กิจกรรม</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>{isYearlyMode ? 'ปีที่อนุมัติสูงสุด' : 'เดือนที่อนุมัติสูงสุด'}</span>
            <Calendar className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-base sm:text-lg font-extrabold text-slate-900 mt-1 truncate">
            {peakItem.approvedHours > 0
              ? `${peakItem.fullLabel} (${peakItem.approvedHours} ชม.)`
              : 'ยังไม่มีข้อมูล'}
          </div>
        </div>
      </div>

      {/* Grouped Bar Chart (Term 1 vs Term 2) */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs min-h-[28px]">
          {isHoursTab ? (
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                เทอม 1 — ชั่วโมงทุนอนุมัติแล้ว (ชม.)
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
                เทอม 2 — ชั่วโมงทุนอนุมัติแล้ว (ชม.)
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                เทอม 1 — จำนวนกิจกรรมที่จัด (กิจกรรม)
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                <span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" />
                เทอม 2 — จำนวนกิจกรรมที่จัด (กิจกรรม)
              </span>
            </div>
          )}

          {activeItem ? (
            <div className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-semibold text-xs">
              {isYearlyMode ? activeItem.fullLabel : `เดือน${activeItem.fullLabel}`}:{' '}
              <span className="text-emerald-600 font-bold">
                เทอม 1 ({activeItem.term1ApprovedHours} ชม. / {activeItem.term1ActivitiesCount} กิจกรรม)
              </span>{' '}
              •{' '}
              <span className="text-amber-600 font-bold">
                เทอม 2 ({activeItem.term2ApprovedHours} ชม. / {activeItem.term2ActivitiesCount} กิจกรรม)
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">
              {isYearlyMode
                ? 'ชี้หรือแตะที่ปีการศึกษาเพื่อดูรายละเอียดแยกเทอม 1 และเทอม 2'
                : 'ชี้หรือแตะที่เดือนเพื่อดูรายละเอียดแยกเทอม 1 และเทอม 2'}
            </span>
          )}
        </div>

        <div className="w-full pb-1">
          <div className="w-full">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-auto select-none"
              role="img"
              aria-label={
                isYearlyMode
                  ? 'กราฟแท่งเปรียบเทียบเทอม 1 และเทอม 2 ทุกปีการศึกษา'
                  : 'กราฟแท่งเปรียบเทียบเทอม 1 และเทอม 2 รายเดือน'
              }
            >
              {/* Horizontal Grid Lines & Y-Axis Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const val = Math.round(yMax * ratio);
                const y = getY(val, yMax);
                return (
                  <g key={ratio}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={chartW - padR}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity={ratio === 0 ? 0.25 : 0.1}
                      strokeDasharray={ratio === 0 ? undefined : '4 4'}
                      className="text-slate-400"
                    />
                    <text
                      x={padL - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10.5"
                      fill="currentColor"
                      className="text-slate-400"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Grouped Bars (Term 1 vs Term 2) */}
              {chartItems.map((d, idx) => {
                const count = Math.max(chartItems.length, 1);
                const slotW = innerW / count;
                const centerX = padL + idx * slotW + slotW / 2;
                const barW = isYearlyMode
                  ? Math.min(34, slotW * 0.26)
                  : Math.min(18, slotW * 0.34);
                const barGap = isYearlyMode ? 4 : 1.5;

                const val1 = isHoursTab ? d.term1ApprovedHours || 0 : d.term1ActivitiesCount || 0;
                const val2 = isHoursTab ? d.term2ApprovedHours || 0 : d.term2ActivitiesCount || 0;

                const h1 = (val1 / yMax) * innerH;
                const h2 = (val2 / yMax) * innerH;
                const itemKey = getItemKey(d, idx);
                const isHovered = hoveredKey === itemKey;

                return (
                  <g
                    key={itemKey}
                    onMouseEnter={() => setHoveredKey(itemKey)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={() => setHoveredKey(isHovered ? null : itemKey)}
                    className="cursor-pointer"
                  >
                    {/* Hover column backdrop */}
                    <rect
                      x={padL + idx * slotW + 4}
                      y={padT - 6}
                      width={Math.max(slotW - 8, 12)}
                      height={innerH + 8}
                      rx="8"
                      fill="currentColor"
                      fillOpacity={isHovered ? 0.08 : 0}
                      className={`${hoverAccentClass} transition-opacity`}
                    />

                    {/* Term 1 Bar */}
                    <rect
                      x={centerX - barW - barGap}
                      y={padT + innerH - Math.max(h1, val1 > 0 ? 4 : 0)}
                      width={barW}
                      height={Math.max(h1, val1 > 0 ? 4 : 0)}
                      rx="4"
                      fill={term1Color}
                      opacity={hoveredKey && !isHovered ? 0.45 : 1}
                    />
                    {val1 > 0 && (
                      <text
                        x={centerX - barW / 2 - barGap}
                        y={padT + innerH - Math.max(h1, 4) - 5}
                        textAnchor="middle"
                        fontSize={isYearlyMode ? '11' : '10'}
                        fontWeight="700"
                        fill={term1Color}
                      >
                        {val1}
                      </text>
                    )}

                    {/* Term 2 Bar */}
                    <rect
                      x={centerX + barGap}
                      y={padT + innerH - Math.max(h2, val2 > 0 ? 4 : 0)}
                      width={barW}
                      height={Math.max(h2, val2 > 0 ? 4 : 0)}
                      rx="4"
                      fill={term2Color}
                      opacity={hoveredKey && !isHovered ? 0.45 : 1}
                    />
                    {val2 > 0 && (
                      <text
                        x={centerX + barW / 2 + barGap}
                        y={padT + innerH - Math.max(h2, 4) - 5}
                        textAnchor="middle"
                        fontSize={isYearlyMode ? '11' : '10'}
                        fontWeight="700"
                        fill={term2Color}
                      >
                        {val2}
                      </text>
                    )}

                    {/* X-axis Label */}
                    <text
                      x={centerX}
                      y={chartH - 10}
                      textAnchor="middle"
                      fontSize={isYearlyMode ? '12' : '11'}
                      fontWeight={isHovered || isYearlyMode ? '700' : '500'}
                      fill="currentColor"
                      className={isHovered ? hoverLabelClass : 'text-slate-500'}
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
