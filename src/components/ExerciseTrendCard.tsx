import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Polyline, Circle, G, Text as SvgText } from 'react-native-svg';
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

export interface ExerciseTrendSummary {
  sessions: ExerciseSessionSummary[];
  last: ExerciseSessionSummary | null;
  trendBg: string;
  trendFg: string;
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
      strokeColor: colors.primary,
      trendLabel: '🆕 אין היסטוריה שמורה עדיין',
      shortLine: '🆕 עדיין לא בוצע אימון שמור לתרגיל זה',
    };
  }

  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const prev = sessions.length >= 2 ? sessions[sessions.length - 2] : null;

  let trendBg = colors.primarySoft;
  let trendFg = colors.primary;
  let strokeColor = colors.primary;
  let trendLabel = '🌱 אימון ראשון מתועד – בפעם הבאה תופיע כאן מגמת השינוי';
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
      strokeColor = colors.success;
      trendLabel = `📈 מגמת עלייה: +${deltaW} קילוגרם מהאימון שלפני${overallSuffix}`;
      shortDelta = `📈 +${deltaW} קילוגרם מהפעם שלפני`;
    } else if (deltaW < 0) {
      trendBg = colors.dangerSoft;
      trendFg = colors.danger;
      strokeColor = colors.danger;
      trendLabel = `📉 ירידה של ${Math.abs(deltaW)} קילוגרם מהאימון שלפני${overallSuffix}`;
      shortDelta = `📉 ${deltaW} קילוגרם מהפעם שלפני`;
    } else if (deltaReps > 0) {
      trendBg = colors.successSoft;
      trendFg = colors.success;
      strokeColor = colors.success;
      trendLabel = `📈 מגמת שיפור: +${deltaReps} חזרות באותו משקל (${last.bestWeight} קילוגרם)${overallSuffix}`;
      shortDelta = `📈 +${deltaReps} חזרות באותו משקל`;
    } else if (deltaReps < 0) {
      trendBg = colors.secondary;
      trendFg = colors.secondaryForeground;
      strokeColor = colors.primary;
      trendLabel = `➡️ משקל זהה (${last.bestWeight} קילוגרם), ${deltaReps} חזרות מהפעם שלפני${overallSuffix}`;
      shortDelta = '➡️ משקל זהה';
    } else {
      trendBg = colors.primarySoft;
      trendFg = colors.primary;
      strokeColor = colors.primary;
      trendLabel = `➡️ מגמה יציבה: שמירה על ${last.bestWeight} קילוגרם × ${last.bestReps} חזרות${overallSuffix}`;
      shortDelta = '➡️ מגמה יציבה';
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
    strokeColor,
    trendLabel,
    shortLine: `📌 פעם קודמת (${last.dateShort}): ${lastSummary}  •  ${shortDelta}`,
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
  const fSemi = fontForWeight('semibold', fontsLoaded);
  const fBold = fontForWeight('bold', fontsLoaded);

  const { sessions, last, trendBg, trendFg, strokeColor, trendLabel } =
    getExerciseTrendSummary(exerciseId, workoutHistory, colors);

  if (!last) {
    return (
      <View
        style={[
          styles.card,
          compact && { padding: 9 },
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fBold }]}>
            📊 מה עשית בפעם הקודמת ומגמת התקדמות
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
            <Text
              style={[
                styles.badgeText,
                { color: colors.secondaryForeground, fontFamily: fSemi },
              ]}
            >
              🆕 אין היסטוריה שמורה עדיין
            </Text>
          </View>
        </View>
        {!compact && (
          <Text style={[styles.emptySub, { color: colors.mutedForeground, fontFamily: fReg }]}>
            בסיום האימון, סמן סטים שבוצעו ולחץ על שמירת אימון כדי לראות כאן את המשקל האחרון ואת גרף המגמה לתרגיל זה.
          </Text>
        )}
      </View>
    );
  }

  const liveRounded = roundWeight(liveBestWeight);
  const liveDelta = roundWeight(liveRounded - last.bestWeight);
  let liveComparisonText = `✓ היום מוגדר: ${liveRounded} קילוגרם (זהה לפעם הקודמת)`;
  let liveComparisonColor = colors.mutedForeground;
  if (liveDelta > 0) {
    liveComparisonText = `🚀 היום מוגדר: ${liveRounded} קילוגרם (+${liveDelta} קילוגרם יותר מהפעם הקודמת!)`;
    liveComparisonColor = colors.success;
  } else if (liveDelta < 0) {
    liveComparisonText = `🎯 היום מוגדר: ${liveRounded} קילוגרם (${liveDelta} קילוגרם מהפעם הקודמת)`;
    liveComparisonColor = colors.foreground;
  }

  // Mini Sparkline of last up to 6 workouts
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
    <View
      style={[
        styles.card,
        compact && { padding: 9, gap: 4 },
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <View style={styles.topSplit}>
        <View style={[styles.infoCol, compact && { gap: 4 }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: fBold }]}>
            📌 מה היה בפעם הקודמת ({last.dateShort})
          </Text>

          <View style={styles.statsRow}>
            <View
              style={[
                styles.bigWeightPill,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.bigWeightText, { color: colors.foreground, fontFamily: fBold }]}>
                {last.bestWeight === 0
                  ? `משקל גוף × ${last.bestReps} חזרות`
                  : `${last.bestWeight} קילוגרם × ${last.bestReps} חזרות`}
              </Text>
            </View>

            <View style={[styles.badge, { backgroundColor: trendBg }]}>
              <Text style={[styles.badgeText, { color: trendFg, fontFamily: fBold }]}>
                {trendLabel}
              </Text>
            </View>
          </View>

          {!compact && (
            <Text style={[styles.setsBreakdown, { color: colors.mutedForeground, fontFamily: fReg }]}>
              סטים מהפעם הקודמת:{' '}
              {last.sets.map((s) => `${s.weight} קילוגרם (${s.reps} חזרות)`).join('  •  ')}
            </Text>
          )}

          <Text style={[styles.liveCompareText, { color: liveComparisonColor, fontFamily: fSemi }]}>
            {liveComparisonText}
          </Text>
        </View>

        {recent.length >= 2 && (
          <View
            style={[
              styles.sparkWrap,
              compact && { width: 220, paddingVertical: 4 },
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sparkTitle, { color: colors.mutedForeground, fontFamily: fSemi }]}>
              מגמת {recent.length} האימונים האחרונים
            </Text>
            <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={compact ? 66 : 92}>
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
                    fontWeight="700"
                    fill={colors.foreground}
                    textAnchor="middle"
                  >
                    {`${p.bestWeight}`}
                  </SvgText>
                  <SvgText
                    x={p.x}
                    y={H - 5}
                    fontSize={10}
                    fill={colors.foreground}
                    opacity={0.65}
                    textAnchor="middle"
                  >
                    {p.dateShort.slice(0, 5)}
                  </SvgText>
                </G>
              ))}
            </Svg>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topSplit: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  infoCol: {
    flex: 1,
    minWidth: 230,
    gap: 6,
  },
  title: {
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emptySub: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  bigWeightPill: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bigWeightText: {
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  badgeText: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  setsBreakdown: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  liveCompareText: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sparkWrap: {
    width: 260,
    maxWidth: '100%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  sparkTitle: {
    fontSize: 11,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
