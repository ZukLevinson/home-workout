import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Rect, Ellipse, G, Text as SvgText } from 'react-native-svg';
import { fontForWeight } from '../theme';

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t) {
  const u = clamp01(t);
  return 1 - Math.pow(1 - u, 3);
}

const PLATE_STYLES = {
  5: {
    weight: 5,
    label: '5',
    rY: 28,
    rX: 16,
    fill: '#334155',
    edge: '#1e293b',
    stroke: '#94a3b8',
    badgeBg: '#0f172a',
  },
  2.5: {
    weight: 2.5,
    label: '2.5',
    rY: 23,
    rX: 13.5,
    fill: '#2563eb',
    edge: '#1d4ed8',
    stroke: '#93c5fd',
    badgeBg: '#1e40af',
  },
  1.25: {
    weight: 1.25,
    label: '1.25',
    rY: 18.5,
    rX: 11,
    fill: '#0d9488',
    edge: '#0f766e',
    stroke: '#5eead4',
    badgeBg: '#115e59',
  },
  0.5: {
    weight: 0.5,
    label: '0.5',
    rY: 14.5,
    rX: 9,
    fill: '#d97706',
    edge: '#b45309',
    stroke: '#fde68a',
    badgeBg: '#92400e',
  },
};

function expandPlates(cfg) {
  if (!cfg) return [];
  const list = [];
  for (let i = 0; i < (cfg.c5 || 0); i++) list.push(PLATE_STYLES[5]);
  for (let i = 0; i < (cfg.c25 || 0); i++) list.push(PLATE_STYLES[2.5]);
  for (let i = 0; i < (cfg.c125 || 0); i++) list.push(PLATE_STYLES[1.25]);
  for (let i = 0; i < (cfg.c05 || 0); i++) list.push(PLATE_STYLES[0.5]);
  return list;
}

/**
 * Draws one horizontal bar (short dumbbell or long barbell) with 3D-angled circular
 * plates on both sleeves, spinlock collars, and clear non-overlapping weight tags.
 */
function renderLoadedBar({
  cx,
  barY,
  halfLen,
  gripHalf,
  plateStep,
  scale,
  isBarbell,
  plates,
  phaseMs,
  colors,
  keyPrefix,
}) {
  // Active assembly happens in first 1500ms of each 4800ms cycle
  const cycleMs = phaseMs % 4800;
  const n = plates.length;
  const sleeveStart = gripHalf + 5 * scale;
  const barTip = halfLen - 4 * scale;

  // Compute collar target right outside all plates (or right against stopper if empty)
  const collarRestOffset = sleeveStart + n * plateStep + 5 * scale;
  const collarStartOffset = halfLen + 8 * scale;
  const collarT = n === 0 ? 1 : easeOutCubic((cycleMs - 950) / 480);
  const collarOffset =
    cycleMs >= 1500 ? collarRestOffset : collarStartOffset + (collarRestOffset - collarStartOffset) * collarT;
  const collarOpacity = n === 0 ? 0.9 : clamp01((cycleMs - 880) / 220);

  const elements = [];

  // Chrome threaded bar shaft
  elements.push(
    <Rect
      key={`${keyPrefix}-shaft`}
      x={cx - halfLen}
      y={barY - 3 * scale}
      width={halfLen * 2}
      height={6 * scale}
      rx={3 * scale}
      fill="#94a3b8"
    />
  );

  // Knurled grip handle
  elements.push(
    <Rect
      key={`${keyPrefix}-grip`}
      x={cx - gripHalf}
      y={barY - 5 * scale}
      width={gripHalf * 2}
      height={10 * scale}
      rx={3 * scale}
      fill={colors.foreground}
      fillOpacity={0.85}
    />
  );

  // Two-piece coupler seam in center for 152cm barbell
  if (isBarbell) {
    elements.push(
      <Rect
        key={`${keyPrefix}-coupler`}
        x={cx - 6}
        y={barY - 6}
        width={12}
        height={12}
        rx={2}
        fill="#64748b"
        stroke={colors.card}
        strokeWidth={1}
      />
    );
  }

  // Inner bar stoppers (collars built into shaft before sleeves)
  elements.push(
    <Rect
      key={`${keyPrefix}-stopL`}
      x={cx - gripHalf - 4 * scale}
      y={barY - 7.5 * scale}
      width={4 * scale}
      height={15 * scale}
      rx={1.5 * scale}
      fill={colors.foreground}
    />,
    <Rect
      key={`${keyPrefix}-stopR`}
      x={cx + gripHalf}
      y={barY - 7.5 * scale}
      width={4 * scale}
      height={15 * scale}
      rx={1.5 * scale}
      fill={colors.foreground}
    />
  );

  // Helper to render plates for one side (-1 left, +1 right)
  const drawSidePlates = (dir) => {
    // Draw from outer to inner or inner to outer?
    // If angled slightly toward center / outward, drawing from INNERMOST -> OUTERMOST
    // means smaller outer discs sit cleanly in front of larger inner discs like real stacked plates!
    for (let i = 0; i < n; i++) {
      const p = plates[i];
      const ry = p.rY * scale;
      const rx = p.rX * scale;
      const restOff = sleeveStart + i * plateStep + plateStep * 0.45;
      const startOff = barTip + 14 * scale;

      const delay = i * 140;
      const t = cycleMs >= 1400 ? 1 : easeOutCubic((cycleMs - delay) / 520);
      const opacity = cycleMs >= 1400 ? 1 : clamp01((cycleMs - delay + 60) / 180);
      const off = startOff + (restOff - startOff) * t;
      const px = cx + dir * off;

      // 3D rim thickness offset toward inner side
      const rimShift = -dir * 3.5 * scale;

      // Only draw top/bottom weight callouts if plates are reasonably spaced, or alternate cleanly
      const showLabelAbove = i % 2 === 0;
      const tagY = showLabelAbove ? barY - ry - 12 * scale : barY + ry + 13 * scale;

      elements.push(
        <G key={`${keyPrefix}-plate-${dir}-${i}`} opacity={opacity}>
          {/* 3D Cylinder Back/Side Thickness */}
          <Ellipse
            cx={px + rimShift}
            cy={barY}
            rx={rx}
            ry={ry}
            fill={p.edge}
          />
          {/* Main Circular/Angled Disc Face */}
          <Ellipse
            cx={px}
            cy={barY}
            rx={rx}
            ry={ry}
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth={1.6}
          />
          {/* Inner Cast-Iron Groove Ring */}
          <Ellipse
            cx={px}
            cy={barY}
            rx={rx * 0.68}
            ry={ry * 0.68}
            fill="none"
            stroke={p.stroke}
            strokeOpacity={0.35}
            strokeWidth={1}
          />
          {/* Center Bar Hole */}
          <Ellipse
            cx={px}
            cy={barY}
            rx={Math.max(2, rx * 0.22)}
            ry={Math.max(3, 3.5 * scale)}
            fill="#64748b"
          />

          {/* Show big weight number directly on outermost plate face if single/outermost, AND clean leader tag for every plate */}
          {i === n - 1 && n <= 2 && rx >= 10 && (
            <SvgText
              x={px + dir * (rx * 0.36)}
              y={barY + 3.5 * scale}
              fontSize={Math.max(9.5, 11 * scale)}
              fontWeight="800"
              fill="#ffffff"
              textAnchor="middle"
            >
              {p.label}
            </SvgText>
          )}

          {/* Pointer stem + crisp weight callout badge */}
          <Line
            x1={px}
            y1={showLabelAbove ? barY - ry + 1 : barY + ry - 1}
            x2={px}
            y2={showLabelAbove ? tagY + 4 : tagY - 7}
            stroke={p.stroke}
            strokeWidth={1.2}
          />
          <Rect
            x={px - (p.label.length > 2 ? 14 : 10)}
            y={tagY - 7}
            width={p.label.length > 2 ? 28 : 20}
            height={13}
            rx={4}
            fill={p.badgeBg}
            stroke={p.stroke}
            strokeWidth={1}
          />
          <SvgText
            x={px}
            y={tagY + 2.8}
            fontSize={9.5}
            fontWeight="700"
            fill="#ffffff"
            textAnchor="middle"
          >
            {p.label}
          </SvgText>
        </G>
      );
    }

    // Spinlock Star Collar on outer end
    const collarX = cx + dir * collarOffset;
    elements.push(
      <G key={`${keyPrefix}-collar-${dir}`} opacity={collarOpacity}>
        <Rect
          x={collarX - 3.5 * scale}
          y={barY - 9 * scale}
          width={7 * scale}
          height={18 * scale}
          rx={2 * scale}
          fill={colors.primary}
          stroke={colors.card}
          strokeWidth={1}
        />
        <Line
          x1={collarX}
          y1={barY - 9 * scale}
          x2={collarX}
          y2={barY + 9 * scale}
          stroke="#ffffff"
          strokeOpacity={0.5}
          strokeWidth={1}
        />
      </G>
    );
  };

  drawSidePlates(-1);
  drawSidePlates(1);

  return elements;
}

export default function EquipmentBuildDiagram({
  cfg,
  mode,
  paused,
  colors,
  fontsLoaded,
}) {
  const [phaseMs, setPhaseMs] = useState(0);
  const startRef = useRef(Date.now());

  // Reset assembly animation cleanly whenever weight or equipment mode changes
  useEffect(() => {
    startRef.current = Date.now();
    setPhaseMs(0);
  }, [cfg?.totalWeight, mode]);

  useEffect(() => {
    if (paused) return undefined;
    let rafId;
    let lastDraw = 0;

    const tick = (now) => {
      const elapsed = Date.now() - startRef.current;
      const cycle = elapsed % 4800;
      // Run smooth ~30fps during active sliding phase (0..1550ms), stay calm during hold (1550..4750ms)
      const shouldRender = cycle < 1600 || cycle > 4720;
      if (shouldRender && now - lastDraw >= 32) {
        lastDraw = now;
        setPhaseMs(elapsed);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [paused, cfg?.totalWeight, mode]);

  const plates = expandPlates(cfg);
  const cycleMs = phaseMs % 4800;
  const isAssembling = cycleMs < 1450;

  let headerCaption = '';
  if (mode === 'pair') {
    headerCaption = `איור הרכבה: 2 משקולות יד שוות (${cfg.totalWeight} קילוגרם כל אחת)`;
  } else if (mode === 'single') {
    headerCaption = `איור הרכבה: משקולת יד אחת (${cfg.totalWeight} קילוגרם)`;
  } else if (mode === 'barbell') {
    headerCaption = `איור הרכבה: המוט הארוך (${cfg.totalWeight} קילוגרם בסך הכל)`;
  } else if (mode === 'platePair') {
    headerCaption = `איור הרכבה: פלטה בודדת בכל יד (${cfg.totalWeight} קילוגרם ללא מוט)`;
  } else {
    headerCaption =
      cfg.totalWeight === 0
        ? 'איור ציוד: משקל גוף בלבד (ללא פלטות)'
        : `איור ציוד: תוספת פלטה של ${cfg.totalWeight} קילוגרם`;
  }

  const handleReplay = () => {
    startRef.current = Date.now();
    setPhaseMs(0);
  };

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <View style={styles.topBar}>
        <Text
          style={[
            styles.captionText,
            { color: colors.foreground, fontFamily: fontForWeight('semibold', fontsLoaded) },
          ]}
        >
          {headerCaption}
        </Text>
        <Pressable
          onPress={handleReplay}
          style={[styles.replayPill, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text
            style={[
              styles.replayText,
              {
                color: isAssembling ? colors.primary : colors.mutedForeground,
                fontFamily: fontForWeight('medium', fontsLoaded),
              },
            ]}
          >
            {isAssembling ? '🔩 מרכיב...' : '🔄 הראה הרכבה'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.svgContainer}>
        <Svg viewBox="0 0 360 124" width="100%" height={122}>
          {mode === 'pair' && (
            <G>
              {/* Dumbbell 1 (Left) */}
              {renderLoadedBar({
                cx: 90,
                barY: 62,
                halfLen: 80,
                gripHalf: 17,
                plateStep: 9.5,
                scale: 0.78,
                isBarbell: false,
                plates,
                phaseMs,
                colors,
                keyPrefix: 'db1',
              })}
              {/* Subtle divider line */}
              <Line
                x1={180}
                y1={20}
                x2={180}
                y2={106}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {/* Dumbbell 2 (Right) */}
              {renderLoadedBar({
                cx: 270,
                barY: 62,
                halfLen: 80,
                gripHalf: 17,
                plateStep: 9.5,
                scale: 0.78,
                isBarbell: false,
                plates,
                phaseMs,
                colors,
                keyPrefix: 'db2',
              })}
            </G>
          )}

          {mode === 'single' && (
            <G>
              {renderLoadedBar({
                cx: 180,
                barY: 62,
                halfLen: 126,
                gripHalf: 24,
                plateStep: 12.5,
                scale: 1,
                isBarbell: false,
                plates,
                phaseMs,
                colors,
                keyPrefix: 'single',
              })}
            </G>
          )}

          {mode === 'barbell' && (
            <G>
              {renderLoadedBar({
                cx: 180,
                barY: 62,
                halfLen: 164,
                gripHalf: 68,
                plateStep: Math.min(11, Math.max(7, 72 / Math.max(1, plates.length))),
                scale: 0.94,
                isBarbell: true,
                plates,
                phaseMs,
                colors,
                keyPrefix: 'bb',
              })}
            </G>
          )}

          {(mode === 'platePair' || (mode === 'bodyweight' && cfg.totalWeight > 0)) && (
            <G>
              {(mode === 'platePair' ? [116, 244] : [180]).map((cx, idx) => {
                const p = PLATE_STYLES[cfg.totalWeight] || PLATE_STYLES[2.5];
                const r = p.rY * 1.45;
                const delay = idx * 140;
                const t = cycleMs >= 1200 ? 1 : easeOutCubic((cycleMs - delay) / 500);
                const liftY = 62 + (1 - t) * 18;
                const alpha = cycleMs >= 1200 ? 1 : clamp01((cycleMs - delay + 80) / 220);

                return (
                  <G key={`loose-${idx}`} opacity={alpha}>
                    <Circle cx={cx + 3} cy={liftY + 3} r={r} fill={p.edge} />
                    <Circle
                      cx={cx}
                      cy={liftY}
                      r={r}
                      fill={p.fill}
                      stroke={p.stroke}
                      strokeWidth={2.5}
                    />
                    <Circle
                      cx={cx}
                      cy={liftY}
                      r={r * 0.72}
                      fill="none"
                      stroke={p.stroke}
                      strokeOpacity={0.35}
                      strokeWidth={1.2}
                    />
                    <Circle
                      cx={cx}
                      cy={liftY}
                      r={6.5}
                      fill={colors.background}
                      stroke={p.stroke}
                      strokeWidth={1.2}
                    />
                    <SvgText
                      x={cx}
                      y={liftY - r * 0.38}
                      fontSize={13}
                      fontWeight="800"
                      fill="#ffffff"
                      textAnchor="middle"
                    >
                      {p.label}
                    </SvgText>
                    <SvgText
                      x={cx}
                      y={liftY + r * 0.56}
                      fontSize={10}
                      fontWeight="600"
                      fill="#ffffff"
                      fillOpacity={0.85}
                      textAnchor="middle"
                    >
                      קילוגרם
                    </SvgText>
                  </G>
                );
              })}
            </G>
          )}

          {mode === 'bodyweight' && cfg.totalWeight === 0 && (
            <G>
              <Rect
                x={85}
                y={34}
                width={190}
                height={54}
                rx={14}
                fill={colors.card}
                stroke={colors.border}
                strokeWidth={1.5}
              />
              <SvgText
                x={180}
                y={57}
                fontSize={13}
                fontWeight="700"
                fill={colors.foreground}
                textAnchor="middle"
              >
                משקל גוף בלבד (ללא משקולות)
              </SvgText>
              <SvgText
                x={180}
                y={76}
                fontSize={11}
                fill={colors.mutedForeground}
                textAnchor="middle"
              >
                אפשר להוסיף פלטה בבחירה למעלה
              </SvgText>
            </G>
          )}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  captionText: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 1,
  },
  replayPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  replayText: {
    fontSize: 12,
  },
  svgContainer: {
    width: '100%',
    height: 122,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
