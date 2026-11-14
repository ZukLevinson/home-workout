import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Rect, G, Text as SvgText } from 'react-native-svg';
import { fontForWeight } from '../theme';
import type { EquipmentMode, PlateConfig, ThemeColors } from '../types';

interface PlateStyleInfo {
  weight: number;
  label: string;
  height: number;
  fill: string;
  stroke: string;
  badgeBg: string;
}

const PLATE_STYLES: Record<number, PlateStyleInfo> = {
  5: {
    weight: 5,
    label: '5',
    height: 78,
    fill: '#334155',
    stroke: '#94a3b8',
    badgeBg: '#1e293b',
  },
  2.5: {
    weight: 2.5,
    label: '2.5',
    height: 64,
    fill: '#2563eb',
    stroke: '#93c5fd',
    badgeBg: '#1d4ed8',
  },
  1.25: {
    weight: 1.25,
    label: '1.25',
    height: 50,
    fill: '#0d9488',
    stroke: '#5eead4',
    badgeBg: '#0f766e',
  },
  0.5: {
    weight: 0.5,
    label: '0.5',
    height: 38,
    fill: '#d97706',
    stroke: '#fde68a',
    badgeBg: '#b45309',
  },
};

function expandPlates(cfg: PlateConfig | null | undefined): PlateStyleInfo[] {
  if (!cfg) return [];
  const list: PlateStyleInfo[] = [];
  for (let i = 0; i < (cfg.c5 || 0); i++) list.push(PLATE_STYLES[5]);
  for (let i = 0; i < (cfg.c25 || 0); i++) list.push(PLATE_STYLES[2.5]);
  for (let i = 0; i < (cfg.c125 || 0); i++) list.push(PLATE_STYLES[1.25]);
  for (let i = 0; i < (cfg.c05 || 0); i++) list.push(PLATE_STYLES[0.5]);
  return list;
}

interface PlateCountGroup {
  count: number;
  info: PlateStyleInfo;
}

function getPlateGroups(cfg: PlateConfig | null | undefined): PlateCountGroup[] {
  if (!cfg) return [];
  const groups: PlateCountGroup[] = [];
  if (cfg.c5 > 0) groups.push({ count: cfg.c5, info: PLATE_STYLES[5] });
  if (cfg.c25 > 0) groups.push({ count: cfg.c25, info: PLATE_STYLES[2.5] });
  if (cfg.c125 > 0) groups.push({ count: cfg.c125, info: PLATE_STYLES[1.25] });
  if (cfg.c05 > 0) groups.push({ count: cfg.c05, info: PLATE_STYLES[0.5] });
  return groups;
}

interface RenderOneSidePoleParams {
  plates: PlateStyleInfo[];
  isBarbell: boolean;
  colors: ThemeColors;
  boldFont?: string;
  medFont?: string;
  fontsLoaded: boolean;
}

/**
 * Draws a simple, easy-to-read static SVG of ONE side of the bar/pole,
 * emphasizing each plate weight clearly from inside to outside.
 */
function renderOneSidePole({
  plates,
  isBarbell,
  colors,
  boldFont,
  medFont,
  fontsLoaded,
}: RenderOneSidePoleParams): React.ReactElement[] {
  const barY = 58;
  const n = plates.length;
  const sleeveStart = 64;
  const maxSleeveLen = 152;
  const gap = n >= 7 ? 2.5 : 4;
  const plateW =
    n > 0 ? Math.min(34, Math.max(12, Math.floor((maxSleeveLen - (n - 1) * gap) / n))) : 28;
  const collarX = n === 0 ? sleeveStart + 8 : sleeveStart + n * (plateW + gap) + 2;
  const sleeveEnd = Math.max(236, collarX + 20);

  const elements: React.ReactElement[] = [];

  // Subtle dashed center-cut marker on left showing this is one side of the bar
  elements.push(
    <Line
      key="one-side-cut"
      x1={8}
      y1={36}
      x2={8}
      y2={80}
      stroke={colors.mutedForeground}
      strokeOpacity={0.35}
      strokeWidth={1.5}
      strokeDasharray="3 3"
    />
  );

  // Bar shaft extending through sleeve
  elements.push(
    <Rect
      key="pole-shaft"
      x={12}
      y={barY - 5}
      width={sleeveEnd - 12}
      height={10}
      rx={4}
      fill="#94a3b8"
    />,
    <Rect
      key="pole-highlight"
      x={14}
      y={barY - 3.5}
      width={sleeveEnd - 16}
      height={2.5}
      rx={1.25}
      fill="#e2e8f0"
      fillOpacity={0.7}
    />
  );

  // Knurled grip handle (one side stub)
  elements.push(
    <Rect
      key="pole-grip"
      x={12}
      y={barY - 9}
      width={isBarbell ? 34 : 38}
      height={18}
      rx={3}
      fill={colors.foreground}
      fillOpacity={0.86}
    />
  );

  // Inner bar stopper flange before plates
  elements.push(
    <Rect
      key="pole-stopper"
      x={50}
      y={barY - 14}
      width={7}
      height={28}
      rx={2.5}
      fill={colors.foreground}
    />
  );

  if (n === 0) {
    elements.push(
      <G key="empty-pole-note">
        <Rect
          x={96}
          y={barY - 16}
          width={136}
          height={32}
          rx={8}
          fill={colors.card}
          stroke={colors.border}
          strokeWidth={1.2}
        />
        <SvgText
          x={164}
          y={barY + 4}
          fontSize={11.5}
          fontFamily={medFont}
          fontWeight={fontsLoaded ? undefined : '600'}
          fill={colors.foreground}
          textAnchor="middle"
        >
          מוט ריק (ללא פלטות)
        </SvgText>
      </G>
    );
  }

  // Easy-to-read side-profile plates with centered bold weight labels
  for (let i = 0; i < n; i++) {
    const p = plates[i];
    const px = sleeveStart + i * (plateW + gap);
    const py = barY - p.height / 2;
    const cx = px + plateW / 2;
    const isNarrowMultiChar = plateW < 23 && p.label.length >= 3;
    const fontSize = isNarrowMultiChar
      ? 10.5
      : plateW >= 30
      ? 14
      : plateW >= 24
      ? 12
      : p.label.length === 1
      ? 12
      : 9.5;

    elements.push(
      <G key={`plate-${i}`}>
        <Rect
          x={px}
          y={py}
          width={plateW}
          height={p.height}
          rx={Math.min(5, plateW / 3)}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={1.5}
        />
        {/* Clean top bevel highlight for crisp depth without overlapping 3D ellipses */}
        <Rect
          x={px + 2}
          y={py + 3}
          width={Math.max(2, Math.min(4, plateW * 0.16))}
          height={Math.max(8, p.height - 6)}
          rx={1.5}
          fill="#ffffff"
          fillOpacity={0.18}
        />
        <SvgText
          x={cx}
          y={barY + (isNarrowMultiChar ? 3.5 : fontSize * 0.36)}
          fontSize={fontSize}
          fontFamily={boldFont}
          fontWeight={fontsLoaded ? undefined : '700'}
          fill="#ffffff"
          textAnchor="middle"
          transform={isNarrowMultiChar ? `rotate(-90 ${cx} ${barY})` : undefined}
        >
          {p.label}
        </SvgText>
      </G>
    );
  }

  // Spinlock collar locking the outer end of the one-side sleeve
  elements.push(
    <G key="pole-collar">
      <Rect
        x={collarX}
        y={barY - 15}
        width={10}
        height={30}
        rx={3}
        fill={colors.primary}
        stroke={colors.card}
        strokeWidth={1.2}
      />
      <Line
        x1={collarX + 5}
        y1={barY - 12}
        x2={collarX + 5}
        y2={barY + 12}
        stroke="#ffffff"
        strokeOpacity={0.65}
        strokeWidth={1.3}
      />
    </G>
  );

  return elements;
}

export interface EquipmentBuildDiagramProps {
  cfg: PlateConfig;
  mode: EquipmentMode;
  paused?: boolean;
  colors: ThemeColors;
  fontsLoaded: boolean;
  compact?: boolean;
  micro?: boolean;
}

export default function EquipmentBuildDiagram({
  cfg,
  mode,
  colors,
  fontsLoaded,
  compact = false,
  micro = false,
}: EquipmentBuildDiagramProps): React.ReactElement {
  const plates = expandPlates(cfg);
  const plateGroups = getPlateGroups(cfg);

  const isPoleMode = mode === 'pair' || mode === 'single' || mode === 'barbell';
  const isPair = mode === 'pair' || mode === 'platePair';

  const modePillLabel =
    mode === 'pair'
      ? micro
        ? '× 2'
        : '× 2 מוטות יד'
      : mode === 'single'
      ? micro
        ? '× 1'
        : 'מוט יד 1'
      : mode === 'barbell'
      ? micro
        ? 'ארוך'
        : 'מוט ארוך'
      : mode === 'platePair'
      ? micro
        ? '× 2'
        : '× 2 פלטות'
      : 'משקל גוף';

  let headerCaption = '';
  if (isPoleMode) {
    headerCaption = micro
      ? `${cfg.sideWeight} קילוגרם לצד`
      : `משקל לכל צד של המוט: ${cfg.sideWeight} קילוגרם (סך הכל ${cfg.totalWeight} קילוגרם)`;
  } else if (mode === 'platePair') {
    headerCaption = micro
      ? `${cfg.totalWeight} קילוגרם ביד`
      : `פלטה של ${cfg.totalWeight} קילוגרם בכל יד (ללא מוט)`;
  } else {
    headerCaption =
      cfg.totalWeight === 0
        ? 'משקל גוף בלבד (ללא משקולות)'
        : `פלטת עזר: ${cfg.totalWeight} קילוגרם`;
  }

  const fReg = fontForWeight('regular', fontsLoaded);
  const fMed = fontForWeight('medium', fontsLoaded);
  const fSemi = fontForWeight('semibold', fontsLoaded);
  const fBold = fontForWeight('bold', fontsLoaded);

  return (
    <View
      style={[
        styles.wrapper,
        compact && styles.wrapperCompact,
        micro && styles.wrapperMicro,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      {/* Top Row: Emphasize side-weight summary + equipment count */}
      <View style={styles.topBar}>
        <View style={styles.captionGroup}>
          <View
            style={[
              styles.modePill,
              {
                backgroundColor: isPair ? colors.primarySoft : colors.card,
                borderColor: isPair ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.modePillText,
                {
                  color: isPair ? colors.primary : colors.foreground,
                  fontFamily: fBold,
                },
              ]}
            >
              {modePillLabel}
            </Text>
          </View>

          <Text
            numberOfLines={1}
            style={[styles.captionText, { color: colors.foreground, fontFamily: fSemi }]}
          >
            {headerCaption}
          </Text>
        </View>
      </View>

      {/* Weight Chips Row: Instant plate checklist for one side */}
      {isPoleMode && (
        <View style={styles.chipsRow}>
          {plateGroups.length === 0 ? (
            <View
              style={[
                styles.weightChip,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.weightChipText, { color: colors.mutedForeground, fontFamily: fMed }]}>
                {mode === 'barbell' ? 'מוט 6 קילוגרם בלבד' : 'מוט 2 קילוגרם בלבד'}
              </Text>
            </View>
          ) : (
            plateGroups.map((g) => (
              <View
                key={g.info.weight}
                style={[
                  styles.weightChip,
                  { backgroundColor: g.info.badgeBg, borderColor: g.info.stroke },
                ]}
              >
                <Text style={[styles.weightChipText, { color: '#ffffff', fontFamily: fBold }]}>
                  {g.count > 1 ? `${g.count} × ` : ''}
                  {g.info.label} קילוגרם
                </Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* Clean Static One-Side Pole / Plate SVG */}
      <View
        style={[
          styles.svgContainerBase,
          compact
            ? micro
              ? styles.svgContainerMicro
              : styles.svgContainerCompact
            : styles.svgContainerFixed,
        ]}
      >
        <Svg
          viewBox="0 0 260 116"
          width="100%"
          height={compact ? '100%' : 114}
          preserveAspectRatio="xMidYMid meet"
        >
          {isPoleMode && (
            <G>
              {renderOneSidePole({
                plates,
                isBarbell: mode === 'barbell',
                colors,
                boldFont: fBold,
                medFont: fMed,
                fontsLoaded,
              })}
            </G>
          )}

          {(mode === 'platePair' || (mode === 'bodyweight' && cfg.totalWeight > 0)) && (
            <G>
              {(() => {
                const cx = 130;
                const cy = 58;
                const p = PLATE_STYLES[cfg.totalWeight] || PLATE_STYLES[2.5];
                const r = p.weight >= 5 ? 42 : p.weight >= 2.5 ? 36 : 30;
                return (
                  <G key="single-loose-plate">
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={p.fill}
                      stroke={p.stroke}
                      strokeWidth={2.5}
                    />
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={r * 0.72}
                      fill="none"
                      stroke={p.stroke}
                      strokeOpacity={0.35}
                      strokeWidth={1.2}
                    />
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={6.5}
                      fill={colors.background}
                      stroke={p.stroke}
                      strokeWidth={1.2}
                    />
                    <SvgText
                      x={cx}
                      y={cy - r * 0.36}
                      fontSize={14}
                      fontFamily={fBold}
                      fontWeight={fontsLoaded ? undefined : '700'}
                      fill="#ffffff"
                      textAnchor="middle"
                    >
                      {p.label}
                    </SvgText>
                    <SvgText
                      x={cx}
                      y={cy + r * 0.56}
                      fontSize={10}
                      fontFamily={fMed}
                      fontWeight={fontsLoaded ? undefined : '600'}
                      fill="#ffffff"
                      fillOpacity={0.9}
                      textAnchor="middle"
                    >
                      קילוגרם
                    </SvgText>
                  </G>
                );
              })()}
            </G>
          )}

          {mode === 'bodyweight' && cfg.totalWeight === 0 && (
            <G>
              <Rect
                x={30}
                y={30}
                width={200}
                height={56}
                rx={12}
                fill={colors.card}
                stroke={colors.border}
                strokeWidth={1.5}
              />
              <SvgText
                x={130}
                y={54}
                fontSize={13}
                fontFamily={fBold}
                fontWeight={fontsLoaded ? undefined : '700'}
                fill={colors.foreground}
                textAnchor="middle"
              >
                משקל גוף בלבד (ללא משקולות)
              </SvgText>
              <SvgText
                x={130}
                y={73}
                fontSize={10.5}
                fontFamily={fReg}
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
    gap: 5,
  },
  wrapperCompact: {
    flex: 1,
    minHeight: 112,
    paddingVertical: 6,
  },
  wrapperMicro: {
    flex: 1,
    minHeight: 120,
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  captionGroup: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  modePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  modePillText: {
    fontSize: 10.5,
  },
  captionText: {
    fontSize: 11.5,
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 1,
  },
  chipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  weightChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  weightChipText: {
    fontSize: 10.5,
    writingDirection: 'rtl',
  },
  svgContainerBase: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgContainerFixed: {
    height: 114,
  },
  svgContainerCompact: {
    flex: 1,
    minHeight: 76,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgContainerMicro: {
    flex: 1,
    minHeight: 74,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
