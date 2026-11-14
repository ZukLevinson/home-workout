import React from 'react';
import Svg, { Line, Polyline, Circle, G, Text as SvgText } from 'react-native-svg';
import {
  Activity,
  BarChart02,
  CheckCircle,
  Clock,
  Minus,
  TrendDown01,
  TrendUp01,
} from '@untitledui/icons';
import { Badge, BadgeWithIcon } from '@/components/base/badges/badges';
import { fontForWeight } from '../theme';
import type { LoggedSet, ThemeColors, WorkoutSession } from '../types';

function roundWeight(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

export interface ExerciseSessionSummary {
  dateShort: string;
  dateFull: string;
  bestWeight: number;
  bestReps: number;
  sets: LoggedSet[];
}

export type TrendDirection = 'up' | 'down' | 'flat' | 'first' | 'empty';

export interface ExerciseTrendSummary {
  sessions: ExerciseSessionSummary[];
  last: ExerciseSessionSummary | null;
  trendBg: string;
  trendFg: string;
  trendColor: 'gray' | 'brand' | 'success' | 'error';
  trendDirection: TrendDirection;
  strokeColor: string;
  trendLabel: string;
  shortLine: string;
}

export function getExerciseTrendSummary(
  exerciseId: string,
  workoutHistory: WorkoutSession[],
  colors: ThemeColors
): ExerciseTrendSummary {
  const chronological = [...(workoutHistory || [])].sort(
    (a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0)
  );

  const sessions: ExerciseSessionSummary[] = [];
  chronological.forEach((sess) => {
    const found = (sess.items || []).find(
      (it) => it.exId === exerciseId && Array.isArray(it.sets) && it.sets.length > 0
    );
    if (found) {
      const best = found.sets.reduce((acc, cur) => {
        if (cur.weight > acc.weight) return cur;
        if (cur.weight === acc.weight && cur.reps > acc.reps) return cur;
        return acc;
      }, found.sets[0]);
      const dateShort = (sess.displayDate || '').split(',')[0].trim();
      sessions.push({
        dateShort,
        dateFull: sess.displayDate || '',
        bestWeight: roundWeight(best.weight),
        bestReps: best.reps,
        sets: found.sets,
      });
    }
  });

  if (sessions.length === 0) {
    return {
      sessions,
      last: null,
      trendBg: colors.secondary,
      trendFg: colors.secondaryForeground,
      trendColor: 'gray',
      trendDirection: 'empty',
      strokeColor: colors.primary,
      trendLabel: 'אין היסטוריה שמורה עדיין',
      shortLine: 'עדיין לא בוצע אימון שמור לתרגיל זה',
    };
  }

  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const prev = sessions.length >= 2 ? sessions[sessions.length - 2] : null;

  let trendBg = colors.primarySoft;
  let trendFg = colors.primary;
  let trendColor: 'gray' | 'brand' | 'success' | 'error' = 'brand';
  let trendDirection: TrendDirection = 'first';
  let strokeColor = colors.primary;
  let trendLabel = 'אימון ראשון מתועד – בפעם הבאה תופיע כאן מגמת השינוי';
  let shortDelta = 'אימון ראשון מתועד';

  if (prev) {
    const deltaW = roundWeight(last.bestWeight - prev.bestWeight);
    const deltaReps = last.bestReps - prev.bestReps;
    const overallW = roundWeight(last.bestWeight - first.bestWeight);
    const overallSuffix =
      sessions.length >= 3 && overallW !== 0
        ? ` (מתחילת המעקב: ${overallW > 0 ? '+' : ''}${overallW} קילוגרם)`
        : '';

    if (deltaW > 0) {
      trendBg = colors.successSoft;
      trendFg = colors.success;
      trendColor = 'success';
      trendDirection = 'up';
      strokeColor = colors.success;
      trendLabel = `מגמת עלייה: +${deltaW} קילוגרם מהאימון שלפני${overallSuffix}`;
      shortDelta = `+${deltaW} קילוגרם מהפעם שלפני`;
    } else if (deltaW < 0) {
      trendBg = colors.dangerSoft;
      trendFg = colors.danger;
      trendColor = 'error';
      trendDirection = 'down';
      strokeColor = colors.danger;
      trendLabel = `ירידה של ${Math.abs(deltaW)} קילוגרם מהאימון שלפני${overallSuffix}`;
      shortDelta = `${deltaW} קילוגרם מהפעם שלפני`;
    } else if (deltaReps > 0) {
      trendBg = colors.successSoft;
      trendFg = colors.success;
      trendColor = 'success';
      trendDirection = 'up';
      strokeColor = colors.success;
      trendLabel = `מגמת שיפור: +${deltaReps} חזרות באותו משקל (${last.bestWeight} קילוגרם)${overallSuffix}`;
      shortDelta = `+${deltaReps} חזרות באותו משקל`;
    } else if (deltaReps < 0) {
      trendBg = colors.secondary;
      trendFg = colors.secondaryForeground;
      trendColor = 'gray';
      trendDirection = 'flat';
      strokeColor = colors.primary;
      trendLabel = `משקל זהה (${last.bestWeight} קילוגרם), ${deltaReps} חזרות מהפעם שלפני${overallSuffix}`;
      shortDelta = 'משקל זהה';
    } else {
      trendBg = colors.primarySoft;
      trendFg = colors.primary;
      trendColor = 'brand';
      trendDirection = 'flat';
      strokeColor = colors.primary;
      trendLabel = `מגמה יציבה: שמירה על ${last.bestWeight} קילוגרם × ${last.bestReps} חזרות${overallSuffix}`;
      shortDelta = 'מגמה יציבה';
    }
  }

  const lastSummary =
    last.bestWeight === 0
      ? `משקל גוף × ${last.bestReps}`
      : `${last.bestWeight} קילוגרם × ${last.bestReps}`;

  return {
    sessions,
    last,
    trendBg,
    trendFg,
    trendColor,
    trendDirection,
    strokeColor,
    trendLabel,
    shortLine: `פעם קודמת (${last.dateShort}): ${lastSummary} • ${shortDelta}`,
  };
}

export interface ExerciseTrendCardProps {
  exerciseId: string;
  workoutHistory: WorkoutSession[];
  liveBestWeight: number;
  colors: ThemeColors;
  fontsLoaded: boolean;
  compact?: boolean;
}

export default function ExerciseTrendCard({
  exerciseId,
  workoutHistory,
  liveBestWeight,
  colors,
  fontsLoaded,
  compact = false,
}: ExerciseTrendCardProps): React.ReactElement {
  const fReg = fontForWeight('regular', fontsLoaded);
  const fBold = fontForWeight('bold', fontsLoaded);

  const { sessions, last, trendColor, trendDirection, strokeColor, trendLabel } =
    getExerciseTrendSummary(exerciseId, workoutHistory, colors);

  const TrendIcon =
    trendDirection === 'up'
      ? TrendUp01
      : trendDirection === 'down'
      ? TrendDown01
      : trendDirection === 'first'
      ? Activity
      : Minus;

  if (!last) {
    return (
      <div
        className={`flex flex-col gap-1.5 rounded-xl bg-secondary_alt ring-1 ring-secondary ${
          compact ? 'px-3 py-2' : 'p-3.5'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <BarChart02 className="size-4 text-fg-brand-primary" />
            <span>מה עשית בפעם הקודמת ומגמת התקדמות</span>
          </div>
          <Badge size="sm" color="gray">
            {trendLabel}
          </Badge>
        </div>
        {!compact && (
          <p className="text-xs leading-relaxed text-tertiary">
            בסיום האימון, סמן סטים שבוצעו ולחץ על שמירת אימון כדי לראות כאן את המשקל האחרון ואת גרף המגמה לתרגיל זה.
          </p>
        )}
      </div>
    );
  }

  const liveRounded = roundWeight(liveBestWeight);
  const liveDelta = roundWeight(liveRounded - last.bestWeight);
  let liveComparisonText = `היום מוגדר: ${liveRounded} קילוגרם (זהה לפעם הקודמת)`;
  let liveComparisonTone = 'text-tertiary';
  if (liveDelta > 0) {
    liveComparisonText = `היום מוגדר: ${liveRounded} קילוגרם (+${liveDelta} קילוגרם יותר מהפעם הקודמת)`;
    liveComparisonTone = 'text-success-primary';
  } else if (liveDelta < 0) {
    liveComparisonText = `היום מוגדר: ${liveRounded} קילוגרם (${liveDelta} קילוגרם מהפעם הקודמת)`;
    liveComparisonTone = 'text-secondary';
  }

  const recent = sessions.slice(-6);
  const W = 280;
  const H = 96;
  const padX = 28;
  const padY = 22;
  const wVals = recent.map((s) => s.bestWeight);
  const minW = Math.max(0, Math.min(...wVals) - 2);
  const maxW = Math.max(...wVals) + 2;
  const rangeW = Math.max(1, maxW - minW);

  const pts = recent.map((s, i) => {
    const x =
      recent.length === 1
        ? W / 2
        : padX + (i / (recent.length - 1)) * (W - padX * 2);
    const y = H - padY - ((s.bestWeight - minW) / rangeW) * (H - padY * 2);
    return { ...s, x, y };
  });
  const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div
      className={`rounded-xl bg-secondary_alt ring-1 ring-secondary ${
        compact ? 'px-3 py-2' : 'p-3.5'
      }`}
    >
      <div className="flex flex-wrap items-stretch justify-between gap-3">
        <div className="flex min-w-56 flex-1 flex-col justify-center gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Clock className="size-3.5 text-fg-brand-primary" />
            <span>מה היה בפעם הקודמת ({last.dateShort})</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge type="modern" color="gray" size="sm">
              {last.bestWeight === 0
                ? `משקל גוף × ${last.bestReps} חזרות`
                : `${last.bestWeight} קילוגרם × ${last.bestReps} חזרות`}
            </Badge>

            <BadgeWithIcon size="sm" color={trendColor} iconLeading={TrendIcon}>
              {trendLabel}
            </BadgeWithIcon>
          </div>

          {!compact && (
            <p className="text-xs text-tertiary">
              סטים מהפעם הקודמת:{' '}
              {last.sets.map((s) => `${s.weight} קילוגרם (${s.reps} חזרות)`).join(' • ')}
            </p>
          )}

          <div className={`flex items-center gap-1 text-xs font-medium ${liveComparisonTone}`}>
            <CheckCircle className="size-3.5 shrink-0" />
            <span>{liveComparisonText}</span>
          </div>
        </div>

        {recent.length >= 2 && (
          <div
            className={`flex flex-col justify-center rounded-lg bg-primary px-2 py-1 ring-1 ring-secondary ${
              compact ? 'w-52' : 'w-64'
            } max-w-full`}
          >
            <span className="text-center text-[11px] font-medium text-tertiary">
              מגמת {recent.length} האימונים האחרונים
            </span>
            <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={compact ? 64 : 88}>
              <Line
                x1={padX}
                y1={H - padY}
                x2={W - padX}
                y2={H - padY}
                stroke={colors.foreground}
                strokeOpacity={0.18}
                strokeWidth={1}
              />
              <Polyline
                points={poly}
                fill="none"
                stroke={strokeColor}
                strokeWidth={2.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {pts.map((p, idx) => (
                <G key={`${p.dateShort}-${idx}`}>
                  <Circle cx={p.x} cy={p.y} r={4.5} fill={strokeColor} />
                  <Circle cx={p.x} cy={p.y} r={2} fill={colors.card} />
                  <SvgText
                    x={p.x}
                    y={p.y - 9}
                    fontSize={11}
                    fontFamily={fBold}
                    fontWeight={fontsLoaded ? undefined : '700'}
                    fill={colors.foreground}
                    textAnchor="middle"
                  >
                    {`${p.bestWeight}`}
                  </SvgText>
                  <SvgText
                    x={p.x}
                    y={H - 5}
                    fontSize={10}
                    fontFamily={fReg}
                    fill={colors.foreground}
                    opacity={0.65}
                    textAnchor="middle"
                  >
                    {p.dateShort.slice(0, 5)}
                  </SvgText>
                </G>
              ))}
            </Svg>
          </div>
        )}
      </div>
    </div>
  );
}
