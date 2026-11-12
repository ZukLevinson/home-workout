import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Polyline, Circle, G, Text as SvgText } from 'react-native-svg';
import { fontForWeight } from '../theme';

export default function ProgressChart({ exerciseId, workoutHistory, colors, fontsLoaded }) {
  // workoutHistory is sorted oldest -> newest or newest -> oldest; sort chronologically by createdAtMs
  const chronological = [...workoutHistory].sort(
    (a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0)
  );

  const points = [];
  chronological.forEach((sess) => {
    const found = (sess.items || []).find(
      (it) => it.exId === exerciseId && Array.isArray(it.sets) && it.sets.length > 0
    );
    if (found) {
      const best = found.sets.reduce(
        (acc, cur) => (cur.weight > acc.weight ? cur : acc),
        found.sets[0]
      );
      const shortDate = (sess.displayDate || '').split(',')[0];
      points.push({
        date: shortDate,
        weight: best.weight,
        reps: best.reps,
      });
    }
  });

  if (points.length === 0) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text
          style={[
            styles.emptyText,
            { color: colors.mutedForeground, fontFamily: fontForWeight('regular', fontsLoaded) },
          ]}
        >
          אין עדיין נתונים שמורים לתרגיל הזה. ברגע שתשמור אימון שבו ביצעת את התרגיל, יופיע כאן גרף ההתקדמות שלך!
        </Text>
      </View>
    );
  }

  const firstW = points[0].weight;
  const latest = points[points.length - 1];
  const diff = Math.round((latest.weight - firstW) * 100) / 100;
  const diffStr =
    diff > 0 ? `+${diff} קילוגרם מאז ההתחלה! 🚀` : 'שמירה עקבית על משקל העבודה 💪';

  const chartPoints = points.slice(-8);
  const W = 520;
  const H = 170;
  const padX = 58;
  const padY = 30;
  const weights = chartPoints.map((p) => p.weight);
  const minW = Math.max(0, Math.min(...weights) - 2);
  const maxW = Math.max(...weights) + 2;
  const rangeW = Math.max(1, maxW - minW);

  const coords = chartPoints.map((p, idx) => {
    const x =
      chartPoints.length === 1
        ? W / 2
        : padX + (idx / (chartPoints.length - 1)) * (W - padX * 2);
    const y = H - padY - ((p.weight - minW) / rangeW) * (H - padY * 2);
    return { ...p, x, y };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <View style={[styles.chartBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.summaryRow}>
        <Text
          style={[
            styles.summaryText,
            { color: colors.mutedForeground, fontFamily: fontForWeight('regular', fontsLoaded) },
          ]}
        >
          משקל אחרון:{' '}
          <Text style={{ color: colors.foreground, fontFamily: fontForWeight('bold', fontsLoaded) }}>
            {latest.weight} קילוגרם ({latest.reps} חזרות)
          </Text>
        </Text>
        <Text
          style={[
            styles.diffText,
            { color: colors.primary, fontFamily: fontForWeight('bold', fontsLoaded) },
          ]}
        >
          {diffStr}
        </Text>
      </View>

      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={175}>
        <Line
          x1={padX}
          y1={H - padY}
          x2={W - padX}
          y2={H - padY}
          stroke={colors.foreground}
          strokeOpacity={0.2}
          strokeWidth={1.5}
        />
        {coords.length > 1 && (
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={colors.primary}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {coords.map((c, idx) => (
          <G key={`${c.date}-${idx}`}>
            <Circle cx={c.x} cy={c.y} r={6} fill={colors.primary} />
            <Circle cx={c.x} cy={c.y} r={2.5} fill={colors.card} />
            <SvgText
              x={c.x}
              y={c.y - 11}
              fontSize={12}
              fontWeight="700"
              fill={colors.foreground}
              textAnchor="middle"
            >
              {`${c.weight} קילוגרם`}
            </SvgText>
            <SvgText
              x={c.x}
              y={H - 8}
              fontSize={12}
              fill={colors.foreground}
              opacity={0.65}
              textAnchor="middle"
            >
              {c.date}
            </SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 20,
  },
  chartBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryText: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  diffText: {
    fontSize: 12,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
});
