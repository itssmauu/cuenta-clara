"use client";

import { TrendingUp } from "lucide-react";
import { useId, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { niceScale } from "@/components/dashboard/SpendingChart";
import { ScrollRegion } from "@/components/ui/ScrollRegion";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { useT } from "@/i18n/client";
import { msg, type Translate } from "@/i18n/translate";
import type { SavingsGoal } from "@/lib/finance-api";
import { normalizeMoney } from "@/lib/finance-validation";
import { formatDate, formatMoney } from "@/lib/format";
import {
  perWeek,
  projectGoal,
  type PaceUnit,
  type Projection,
  type TrendUnit,
} from "@/lib/goal-projection";

import { td, th } from "./RowActions";

const UNITS = [
  { value: "week", label: msg("Semanas") },
  { value: "month", label: msg("Meses") },
  { value: "year", label: msg("Años") },
] as const satisfies readonly { value: TrendUnit; label: string }[];

const COLOR = {
  pace: "var(--color-primary)",
  simulated: "var(--color-accent)",
  ink: "var(--color-ink)",
  muted: "var(--color-muted)",
  grid: "var(--color-line)",
};

const TICK: Record<TrendUnit, Intl.DateTimeFormatOptions> = {
  week: { day: "numeric", month: "short" },
  month: { month: "short", year: "2-digit" },
  year: { year: "numeric" },
};
const FULL: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

type Row = { date: string; tick: string; pace?: number; simulated?: number };

/** "la alcanzas hacia el 13 de febrero de 2027" / "no la alcanzas" / "más de 100 años" */
function reachText(projection: Projection, t: Translate): string {
  if (projection.reachDate) {
    return t("la alcanzas hacia el {date}", { date: formatDate(projection.reachDate, FULL) });
  }
  return projection.tooFar ? t("tardarías más de 100 años") : t("no la alcanzas");
}

/**
 * How much a goal without a due date will have over time: at the user's real pace (from
 * their contributions) and, if they type one, at a pace they choose. By weeks, months
 * or years, as a chart with the target line and as a table.
 */
export function GoalTrend({ goal, currency }: { goal: SavingsGoal; currency: string }) {
  const t = useT();
  const [unit, setUnit] = useState<TrendUnit>("month");
  const [amount, setAmount] = useState("");
  const [per, setPer] = useState<PaceUnit>("week");
  const money = (value: number | string) => formatMoney(value, currency);
  const saved = Number(goal.saved_amount);
  const target = Number(goal.target_amount);

  const pace = goal.pace_per_week === null ? null : Number(goal.pace_per_week);
  const paceProjection = pace === null ? null : projectGoal({ saved, target, weekly: pace, unit });
  const typed = Number(normalizeMoney(amount));
  const validAmount = amount.trim() !== "" && Number.isFinite(typed) && typed > 0;
  const simulated = validAmount
    ? projectGoal({ saved, target, weekly: perWeek(typed, per), unit })
    : null;
  const perWord = per === "week" ? t("semana") : t("mes");
  const simulatedName = t("Con {amount} por {per}", { amount: money(typed), per: perWord });

  const base = paceProjection ?? simulated;
  const rows: Row[] = (base?.points ?? []).map((point, i) => ({
    date: point.date,
    tick: formatDate(point.date, TICK[unit]),
    pace: paceProjection?.points[i]?.amount,
    simulated: simulated?.points[i]?.amount,
  }));

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label={t("Tu ritmo")}
        className="bg-primary-tint text-on-tint flex flex-col gap-1.5 rounded-3xl p-5 text-sm leading-relaxed"
      >
        <span className="text-ink flex items-center gap-2 font-bold">
          <TrendingUp aria-hidden="true" className="text-primary size-4" />
          {pace === null
            ? t("Aún no podemos calcular tu ritmo")
            : t("Tu ritmo: {amount} por semana", { amount: money(pace) })}
        </span>
        {pace === null ? (
          <p>
            {t(
              "Hace falta aportar en al menos dos días distintos y que pase una semana desde el primero. Mientras, prueba con un monto abajo.",
            )}
          </p>
        ) : (
          <p>
            {t("Según tus aportes desde el {date}.", {
              date: formatDate(goal.pace_since ?? "", FULL),
            })}{" "}
            {pace > 0
              ? t("A este ritmo, {reach}.", { reach: reachText(paceProjection!, t) })
              : t("Últimamente sacas más de lo que pones: a este ritmo no la alcanzas.")}
          </p>
        )}
      </section>

      <fieldset className="border-line flex flex-col gap-3 rounded-3xl border-2 p-4">
        <legend className="px-1 text-sm font-bold">{t("¿Y si apartas otro monto?")}</legend>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <TextField
            id={`trend-amount-${goal.id}`}
            label={t("Monto")}
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <SelectField
            id={`trend-per-${goal.id}`}
            label={t("Cada")}
            value={per}
            onChange={(event) => setPer(event.target.value as PaceUnit)}
            options={[
              { value: "week", label: msg("semana") },
              { value: "month", label: msg("mes") },
            ]}
          />
        </div>
        <p role="status" className="text-body text-sm font-semibold">
          {simulated
            ? t("{scenario}, {reach}.", { scenario: simulatedName, reach: reachText(simulated, t) })
            : null}
        </p>
      </fieldset>

      {rows.length > 0 ? (
        <>
          <SegmentedControl
            label={t("Ver por")}
            options={UNITS}
            value={unit}
            onChange={setUnit}
            optionClass="px-4 text-sm"
          />
          <TrendChart
            rows={rows}
            target={target}
            money={money}
            showPace={paceProjection !== null}
            simulatedName={simulated ? simulatedName : null}
          />
          <TrendTable
            rows={rows}
            money={money}
            showPace={paceProjection !== null}
            simulatedName={simulated ? simulatedName : null}
          />
        </>
      ) : null}
    </div>
  );
}

function TrendChart({
  rows,
  target,
  money,
  showPace,
  simulatedName,
}: {
  rows: Row[];
  target: number;
  money: (value: number) => string;
  showPace: boolean;
  simulatedName: string | null;
}) {
  const t = useT();
  const titleId = useId();
  const scale = niceScale(target * 1.08);

  return (
    <figure aria-labelledby={titleId} className="flex flex-col gap-3">
      <figcaption id={titleId} className="font-display text-base font-bold">
        {t("Cuánto tendrías con el tiempo")}
      </figcaption>
      {/* The chart repeats the table below; the table is what assistive tech reads */}
      <div aria-hidden="true" className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={COLOR.grid} />
            <XAxis
              dataKey="tick"
              tickLine={false}
              axisLine={{ stroke: COLOR.grid }}
              tick={{ fill: COLOR.muted, fontSize: 11, fontWeight: 700 }}
              interval="preserveStartEnd"
            />
            <YAxis
              width={64}
              domain={[0, scale.max]}
              ticks={scale.ticks}
              tickLine={false}
              axisLine={false}
              tick={{ fill: COLOR.muted, fontSize: 11, fontWeight: 700 }}
              tickFormatter={(value: number) => money(value)}
            />
            <ReferenceLine
              y={target}
              stroke={COLOR.ink}
              strokeDasharray="6 4"
              strokeWidth={2}
              label={{
                value: t("Meta {amount}", { amount: money(target) }),
                position: "insideTopLeft",
                fill: COLOR.ink,
                fontSize: 11,
                fontWeight: 700,
              }}
            />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: COLOR.muted, strokeDasharray: "4 4" }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as Row | undefined;
                if (!active || !row) return null;
                return (
                  <div className="border-line rounded-xl border bg-white px-3 py-2 text-sm shadow-sm">
                    <p className="text-muted font-semibold">{formatDate(row.date, FULL)}</p>
                    {showPace && row.pace !== undefined ? (
                      <p className="font-bold tabular-nums">
                        {t("A tu ritmo: {amount}", { amount: money(row.pace) })}
                      </p>
                    ) : null}
                    {simulatedName && row.simulated !== undefined ? (
                      <p className="font-bold tabular-nums">
                        {simulatedName}: {money(row.simulated)}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />
            {showPace ? (
              <Line
                type="monotone"
                dataKey="pace"
                stroke={COLOR.pace}
                strokeWidth={2}
                dot={{ r: 3, fill: COLOR.pace, stroke: "white", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "white", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ) : null}
            {simulatedName ? (
              <Line
                type="monotone"
                dataKey="simulated"
                stroke={COLOR.simulated}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ r: 3, fill: COLOR.simulated, stroke: "white", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "white", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="text-body flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold">
        {showPace ? (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="bg-primary h-0.5 w-5 rounded" />
            {t("A tu ritmo")}
          </li>
        ) : null}
        {simulatedName ? (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="border-accent w-5 border-t-2 border-dashed" />
            {simulatedName}
          </li>
        ) : null}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="border-ink w-5 border-t-2 border-dashed" />
          {t("Meta")}
        </li>
      </ul>
    </figure>
  );
}

function TrendTable({
  rows,
  money,
  showPace,
  simulatedName,
}: {
  rows: Row[];
  money: (value: number) => string;
  showPace: boolean;
  simulatedName: string | null;
}) {
  const t = useT();
  return (
    <details className="text-sm">
      <summary className="text-primary inline-flex min-h-11 cursor-pointer items-center font-bold">
        {t("Ver los datos como tabla")}
      </summary>
      <ScrollRegion label={t("Tabla de la tendencia de la meta")}>
        <table className="w-full border-collapse">
          <caption className="sr-only">{t("Cuánto tendrías con el tiempo")}</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>
                {t("FECHA")}
              </th>
              {showPace ? (
                <th scope="col" className={`${th} text-right`}>
                  {t("A TU RITMO")}
                </th>
              ) : null}
              {simulatedName ? (
                <th scope="col" className={`${th} text-right`}>
                  {simulatedName.toUpperCase()}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-line border-t">
                <th scope="row" className={`${td} text-left font-semibold`}>
                  {formatDate(row.date, FULL)}
                </th>
                {showPace ? (
                  <td className={`${td} text-right font-bold tabular-nums`}>
                    {row.pace === undefined ? "—" : money(row.pace)}
                  </td>
                ) : null}
                {simulatedName ? (
                  <td className={`${td} text-right font-bold tabular-nums`}>
                    {row.simulated === undefined ? "—" : money(row.simulated)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </details>
  );
}
