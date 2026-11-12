import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Rect, Polyline, G, Text as SvgText } from 'react-native-svg';
import { fontForWeight } from '../theme';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getRepState(ms, labels) {
  const cycle = (ms % 4800) / 4800;
  if (cycle < 0.26) {
    const u = cycle / 0.26;
    const t = 1 - Math.pow(1 - u, 2);
    return { t, label: labels.up };
  } else if (cycle < 0.4) {
    return { t: 1, label: labels.top };
  } else if (cycle < 0.86) {
    const u = (cycle - 0.4) / 0.46;
    const t = 1 - (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
    return { t, label: labels.down };
  } else {
    return { t: 0, label: labels.bottom };
  }
}

function DumbbellHorizontal({ x, y, fg, primary }) {
  return (
    <G>
      <Rect x={x - 14} y={y - 3} width={28} height={6} rx={2} fill={fg} />
      <Rect x={x - 11} y={y - 8} width={5} height={16} rx={1.5} fill={primary} />
      <Rect x={x + 6} y={y - 8} width={5} height={16} rx={1.5} fill={primary} />
    </G>
  );
}

function computeFrame(animKey, ms, colors) {
  const fg = colors.foreground;
  const primary = colors.primary;
  const card = colors.card;

  switch (animKey) {
    case 'floorPress': {
      const { t, label } = getRepState(ms, {
        up: '↑ דוחפים ישר למעלה',
        top: '✓ ידיים ישרות מעל החזה',
        down: '↓ מורידים לאט (3 שניות)',
        bottom: '⏸ נגיעה עדינה של המרפק ברצפה',
      });
      const sx = 105, sy = 118;
      const ex = lerp(120, 105, t), ey = lerp(132, 88, t);
      const wx = lerp(120, 105, t), wy = lerp(98, 56, t);
      return {
        label,
        elements: (
          <G>
            <Line x1={15} y1={140} x2={265} y2={140} stroke={fg} strokeOpacity={0.25} strokeWidth={2} />
            <Rect x={35} y={135} width={210} height={5} rx={2.5} fill={primary} fillOpacity={0.35} />
            <SvgText x={140} y={156} fontSize={12} fill={fg} opacity={0.65} textAnchor="middle">
              שכיבה על מזרן על הרצפה
            </SvgText>
            <Circle cx={70} cy={122} r={11} fill={fg} fillOpacity={0.82} />
            <Line x1={83} y1={125} x2={162} y2={128} stroke={fg} strokeWidth={11} strokeLinecap="round" strokeOpacity={0.82} />
            <Polyline points="162,128 195,93 224,135" fill="none" stroke={fg} strokeWidth={8.5} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.78} />
            <Polyline points={`${sx},${sy} ${ex},${ey} ${wx},${wy}`} fill="none" stroke={primary} strokeWidth={7.5} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={ex} cy={ey} r={3.5} fill={card} />
            <DumbbellHorizontal x={wx} y={wy} fg={fg} primary={primary} />
          </G>
        ),
      };
    }

    case 'benchRow': {
      const { t, label } = getRepState(ms, {
        up: '↑ מושכים מרפק לכיוון המותן',
        top: '✓ כיווץ של שנייה בגב',
        down: '↓ מורידים לאט למתיחה מלאה',
        bottom: '⏸ יד ישרה למטה, גב נשאר שטוח',
      });
      const sx = 122, sy = 70;
      const ex = lerp(124, 150, t), ey = lerp(98, 56, t);
      const wx = lerp(125, 148, t), wy = lerp(124, 84, t);
      return {
        label,
        elements: (
          <G>
            <Line x1={15} y1={142} x2={265} y2={142} stroke={fg} strokeOpacity={0.25} strokeWidth={2} />
            <Line x1={40} y1={30} x2={40} y2={142} stroke={fg} strokeOpacity={0.3} strokeWidth={3} />
            <SvgText x={56} y={44} fontSize={12} fill={fg} opacity={0.6} textAnchor="middle">
              קיר
            </SvgText>
            <Rect x={42} y={103} width={66} height={7} rx={2} fill={fg} fillOpacity={0.65} />
            <Line x1={50} y1={110} x2={50} y2={142} stroke={fg} strokeWidth={5} strokeOpacity={0.65} />
            <Line x1={100} y1={110} x2={100} y2={142} stroke={fg} strokeWidth={5} strokeOpacity={0.65} />
            <SvgText x={92} y={157} fontSize={12} fill={fg} opacity={0.7} textAnchor="middle">
              ספסל איקאה צמוד לקיר
            </SvgText>
            <Circle cx={95} cy={64} r={10} fill={fg} fillOpacity={0.85} />
            <Line x1={108} y1={68} x2={182} y2={74} stroke={fg} strokeWidth={10.5} strokeLinecap="round" strokeOpacity={0.85} />
            <Line x1={112} y1={70} x2={86} y2={103} stroke={fg} strokeWidth={6} strokeLinecap="round" strokeOpacity={0.55} />
            <Polyline points="182,74 205,108 218,140" fill="none" stroke={fg} strokeWidth={8} strokeLinecap="round" strokeOpacity={0.8} />
            <Polyline points="176,75 165,110 162,140" fill="none" stroke={fg} strokeWidth={7} strokeLinecap="round" strokeOpacity={0.45} />
            <Polyline points={`${sx},${sy} ${ex},${ey} ${wx},${wy}`} fill="none" stroke={primary} strokeWidth={7.5} strokeLinecap="round" strokeLinejoin="round" />
            <DumbbellHorizontal x={wx} y={wy} fg={fg} primary={primary} />
          </G>
        ),
      };
    }

    case 'elevatedPushup': {
      const { t, label } = getRepState(ms, {
        up: '↑ דוחפים את הרצפה חזק',
        top: '✓ גוף ישר כמו קרש',
        down: '↓ יורדים בשליטה עם בטן מוחזקת',
        bottom: '⏸ חזה קרוב לרצפה',
      });
      const ax = 196, ay = 101;
      const sx = lerp(76, 82, t), sy = lerp(120, 84, t);
      const hx = (sx + ax) / 2, hy = (sy + ay) / 2;
      const headX = sx - 15, headY = sy - 3;
      const wx = 80, wy = 140;
      const ex = lerp(98, 81, t), ey = lerp(114, 112, t);
      return {
        label,
        elements: (
          <G>
            <Line x1={15} y1={142} x2={265} y2={142} stroke={fg} strokeOpacity={0.25} strokeWidth={2} />
            <Line x1={244} y1={40} x2={244} y2={142} stroke={fg} strokeOpacity={0.3} strokeWidth={3} />
            <Rect x={182} y={103} width={60} height={7} rx={2} fill={fg} fillOpacity={0.65} />
            <Line x1={190} y1={110} x2={190} y2={142} stroke={fg} strokeWidth={5} strokeOpacity={0.65} />
            <Line x1={234} y1={110} x2={234} y2={142} stroke={fg} strokeWidth={5} strokeOpacity={0.65} />
            <SvgText x={212} y={157} fontSize={12} fill={fg} opacity={0.7} textAnchor="middle">
              ספסל צמוד לקיר
            </SvgText>
            <Circle cx={headX} cy={headY} r={10} fill={fg} fillOpacity={0.85} />
            <Polyline points={`${sx},${sy} ${hx},${hy} ${ax},${ay}`} fill="none" stroke={fg} strokeWidth={9.5} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.85} />
            <Polyline points={`${sx},${sy} ${ex},${ey} ${wx},${wy}`} fill="none" stroke={primary} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          </G>
        ),
      };
    }

    case 'skullcrusher': {
      const { t, label } = getRepState(ms, {
        up: '↑ מיישרים רק את המרפקים',
        top: '✓ זרועות ישרות, מרפק נשאר במקום',
        down: '↓ מכופפים מרפקים לאט לכיוון הראש',
        bottom: '⏸ משקולות לצידי הראש',
      });
      const sx = 108, sy = 120, ex = 96, ey = 84;
      const angle = lerp(2.65, 1.35, t), R = 34;
      const wx = ex + R * Math.cos(angle), wy = ey - R * Math.sin(angle);
      return {
        label,
        elements: (
          <G>
            <Line x1={15} y1={140} x2={265} y2={140} stroke={fg} strokeOpacity={0.25} strokeWidth={2} />
            <Rect x={40} y={135} width={200} height={5} rx={2.5} fill={primary} fillOpacity={0.35} />
            <SvgText x={140} y={156} fontSize={12} fill={fg} opacity={0.7} textAnchor="middle">
              החלק העליון של הזרוע נשאר קבוע ולא זז!
            </SvgText>
            <Circle cx={82} cy={123} r={11} fill={fg} fillOpacity={0.82} />
            <Line x1={95} y1={126} x2={172} y2={128} stroke={fg} strokeWidth={10.5} strokeLinecap="round" strokeOpacity={0.82} />
            <Polyline points="172,128 202,95 226,135" fill="none" stroke={fg} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.78} />
            <Line x1={sx} y1={sy} x2={ex} y2={ey} stroke={fg} strokeWidth={7.5} strokeLinecap="round" />
            <Line x1={ex} y1={ey} x2={wx} y2={wy} stroke={primary} strokeWidth={7} strokeLinecap="round" />
            <Circle cx={ex} cy={ey} r={4} fill={primary} />
            <DumbbellHorizontal x={wx} y={wy} fg={fg} primary={primary} />
          </G>
        ),
      };
    }

    case 'barbellCurl': {
      const { t, label } = getRepState(ms, {
        up: '↑ מרימים בקשת בלי להזיז מרפק',
        top: '✓ כיווץ ביד הקדמית',
        down: '↓ מורידים לאט (3 שניות)',
        bottom: '⏸ ידיים מתיישרות למטה',
      });
      const sx = 128, sy = 54, ex = 128, ey = 86;
      const angle = lerp(-1.28, 0.92, t), R = 30;
      const wx = ex + R * Math.cos(angle), wy = ey - R * Math.sin(angle);
      return {
        label,
        elements: (
          <G>
            <Line x1={15} y1={148} x2={265} y2={148} stroke={fg} strokeOpacity={0.25} strokeWidth={2} />
            <Line x1={112} y1={22} x2={112} y2={148} stroke={fg} strokeOpacity={0.25} strokeWidth={3} strokeDasharray="5 4" />
            <SvgText x={72} y={38} fontSize={12} fill={fg} opacity={0.6} textAnchor="middle">
              קיר ליציבות
            </SvgText>
            <Circle cx={128} cy={36} r={10} fill={fg} fillOpacity={0.85} />
            <Line x1={128} y1={48} x2={128} y2={98} stroke={fg} strokeWidth={10.5} strokeLinecap="round" strokeOpacity={0.85} />
            <Line x1={128} y1={98} x2={128} y2={145} stroke={fg} strokeWidth={9} strokeLinecap="round" strokeOpacity={0.8} />
            <Line x1={sx} y1={sy} x2={ex} y2={ey} stroke={fg} strokeWidth={7} strokeLinecap="round" />
            <Line x1={ex} y1={ey} x2={wx} y2={wy} stroke={primary} strokeWidth={7} strokeLinecap="round" />
            <Circle cx={wx} cy={wy} r={9.5} fill={primary} />
            <Circle cx={wx} cy={wy} r={3} fill={card} />
          </G>
        ),
      };
    }

    case 'kneelingPress': {
      const { t, label } = getRepState(ms, {
        up: '↑ דוחפים ישר מעל הראש',
        top: '✓ ידיים ישרות למעלה, גב זקוף',
        down: '↓ מורידים בשליטה לגובה הכתפיים',
        bottom: '⏸ משקולות בגובה הכתפיים',
      });
      const sx = 134, sy = 72;
      const ex = lerp(150, 135, t), ey = lerp(92, 47, t);
      const wx = lerp(148, 134, t), wy = lerp(65, 21, t);
      return {
        label,
        elements: (
          <G>
            <Line x1={15} y1={146} x2={265} y2={146} stroke={fg} strokeOpacity={0.25} strokeWidth={2} />
            <Rect x={116} y={139} width={36} height={7} rx={3} fill={primary} fillOpacity={0.45} />
            <SvgText x={140} y={161} fontSize={12} fill={fg} opacity={0.7} textAnchor="middle">
              כרית רכה מתחת לברך
            </SvgText>
            <Circle cx={134} cy={56} r={10} fill={fg} fillOpacity={0.85} />
            <Line x1={134} y1={68} x2={134} y2={108} stroke={fg} strokeWidth={10.5} strokeLinecap="round" strokeOpacity={0.85} />
            <Polyline points="134,108 134,139 102,139" fill="none" stroke={fg} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.75} />
            <Polyline points="134,108 168,108 168,144" fill="none" stroke={fg} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.85} />
            <Polyline points={`${sx},${sy} ${ex},${ey} ${wx},${wy}`} fill="none" stroke={primary} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
            <DumbbellHorizontal x={wx} y={wy} fg={fg} primary={primary} />
          </G>
        ),
      };
    }

    case 'barbellRow': {
      const { t, label } = getRepState(ms, {
        up: '↑ מושכים מוט לכיוון הטבור',
        top: '✓ מקרבים שכמות בגב',
        down: '↓ מורידים בשליטה, גב נשאר ישר',
        bottom: '⏸ ידיים ישרות למטה',
      });
      const sx = 118, sy = 68;
      const ex = lerp(118, 148, t), ey = lerp(96, 60, t);
      const wx = lerp(119, 138, t), wy = lerp(122, 88, t);
      return {
        label,
        elements: (
          <G>
            <Line x1={15} y1={146} x2={265} y2={146} stroke={fg} strokeOpacity={0.25} strokeWidth={2} />
            <SvgText x={140} y={161} fontSize={12} fill={fg} opacity={0.7} textAnchor="middle">
              פלג הגוף העליון נשאר יציב ולא מתרומם
            </SvgText>
            <Circle cx={96} cy={54} r={10} fill={fg} fillOpacity={0.85} />
            <Line x1={106} y1={61} x2={166} y2={92} stroke={fg} strokeWidth={10.5} strokeLinecap="round" strokeOpacity={0.85} />
            <Polyline points="166,92 152,118 158,144" fill="none" stroke={fg} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.85} />
            <Polyline points={`${sx},${sy} ${ex},${ey} ${wx},${wy}`} fill="none" stroke={primary} strokeWidth={7.5} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={wx} cy={wy} r={11} fill={primary} />
            <Circle cx={wx} cy={wy} r={3.5} fill={card} />
          </G>
        ),
      };
    }

    case 'floorFly': {
      const { t, label } = getRepState(ms, {
        up: '↑ סוגרים ידיים ב"חיבוק" מעל החזה',
        top: '✓ כיווץ של החזה למעלה',
        down: '↓ פותחים רחב ולאט לצדדים',
        bottom: '⏸ זרוע אחורית נוגעת בעדינות ברצפה',
      });
      const slx = 116, sly = 118, srx = 164, sry = 118;
      const elx = lerp(80, 102, t), ely = lerp(131, 84, t);
      const wlx = lerp(66, 127, t), wly = lerp(104, 52, t);
      const erx = lerp(200, 178, t), ery = lerp(131, 84, t);
      const wrx = lerp(214, 153, t), wry = lerp(104, 52, t);
      return {
        label,
        elements: (
          <G>
            <Line x1={20} y1={138} x2={260} y2={138} stroke={fg} strokeOpacity={0.25} strokeWidth={2} />
            <Rect x={45} y={133} width={190} height={5} rx={2.5} fill={primary} fillOpacity={0.35} />
            <SvgText x={140} y={156} fontSize={12} fill={fg} opacity={0.7} textAnchor="middle">
              מבט מלפנים – מרפקים תמיד מעט כפופים
            </SvgText>
            <Rect x={114} y={112} width={52} height={21} rx={9} fill={fg} fillOpacity={0.82} />
            <Polyline points={`${slx},${sly} ${elx},${ely} ${wlx},${wly}`} fill="none" stroke={primary} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
            <Polyline points={`${srx},${sry} ${erx},${ery} ${wrx},${wry}`} fill="none" stroke={primary} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
            <Rect x={wlx - 9} y={wly - 4} width={18} height={8} rx={2} fill={fg} />
            <Rect x={wrx - 9} y={wry - 4} width={18} height={8} rx={2} fill={fg} />
          </G>
        ),
      };
    }

    case 'deltSide': {
      const { t, label } = getRepState(ms, {
        up: '↑ מרימים לצדדים עד גובה הכתפיים',
        top: '✓ עצירה קצרה בגובה הכתף',
        down: '↓ מורידים לאט לצידי הגוף',
        bottom: '⏸ פלטות לצידי הגוף',
      });
      const slx = 126, sly = 56, srx = 154, sry = 56;
      const a = lerp(0.18, 1.48, t);
      const elx = slx - 26 * Math.sin(a), ely = sly + 26 * Math.cos(a) - 3 * t;
      const wlx = slx - 54 * Math.sin(a), wly = sly + 54 * Math.cos(a);
      const erx = srx + 26 * Math.sin(a), ery = sry + 26 * Math.cos(a) - 3 * t;
      const wrx = srx + 54 * Math.sin(a), wry = sry + 54 * Math.cos(a);
      return {
        label,
        elements: (
          <G>
            <Circle cx={140} cy={36} r={10} fill={fg} fillOpacity={0.85} />
            <Rect x={126} y={50} width={28} height={48} rx={8} fill={fg} fillOpacity={0.85} />
            <Line x1={132} y1={98} x2={128} y2={144} stroke={fg} strokeWidth={8} strokeLinecap="round" strokeOpacity={0.8} />
            <Line x1={148} y1={98} x2={152} y2={144} stroke={fg} strokeWidth={8} strokeLinecap="round" strokeOpacity={0.8} />
            <Polyline points={`${slx},${sly} ${elx},${ely} ${wlx},${wly}`} fill="none" stroke={primary} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
            <Polyline points={`${srx},${sry} ${erx},${ery} ${wrx},${wry}`} fill="none" stroke={primary} strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={wlx} cy={wly} r={9.5} fill={primary} />
            <Circle cx={wlx} cy={wly} r={3} fill={card} />
            <Circle cx={wrx} cy={wry} r={9.5} fill={primary} />
            <Circle cx={wrx} cy={wry} r={3} fill={card} />
            <SvgText x={140} y={160} fontSize={12} fill={fg} opacity={0.7} textAnchor="middle">
              תרגיל 1 בצמד: בעמידה זקופה (הרמה לצדדים)
            </SvgText>
          </G>
        ),
      };
    }

    case 'deltRear': {
      const { t, label } = getRepState(ms, {
        up: '↑ פותחים ידיים לצדדים במצב כפוף',
        top: '✓ כיווץ בחלק האחורי של הכתף',
        down: '↓ מורידים בשליטה למטה',
        bottom: '⏸ ידיים תלויות למטה, גב נשאר ישר',
      });
      const sx = 114, sy = 74;
      const ex = lerp(116, 130, t), ey = lerp(102, 56, t);
      const wx = lerp(116, 136, t), wy = lerp(126, 44, t);
      return {
        label,
        elements: (
          <G>
            <Line x1={15} y1={146} x2={265} y2={146} stroke={fg} strokeOpacity={0.25} strokeWidth={2} />
            <Circle cx={92} cy={64} r={10} fill={fg} fillOpacity={0.85} />
            <Line x1={103} y1={69} x2={168} y2={92} stroke={fg} strokeWidth={10.5} strokeLinecap="round" strokeOpacity={0.85} />
            <Polyline points="168,92 154,118 160,144" fill="none" stroke={fg} strokeWidth={8.5} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.85} />
            <Polyline points={`${sx},${sy} ${ex},${ey} ${wx},${wy}`} fill="none" stroke={primary} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={wx} cy={wy} r={9.5} fill={primary} />
            <Circle cx={wx} cy={wy} r={3} fill={card} />
            <SvgText x={140} y={161} fontSize={12} fill={fg} opacity={0.7} textAnchor="middle">
              תרגיל 2 בצמד: בהטיה קדימה (לחלק האחורי של הכתף)
            </SvgText>
          </G>
        ),
      };
    }

    case 'hammerCurl': {
      const { t, label } = getRepState(ms, {
        up: '↑ מכופפים מרפק כשהאגודל פונה למעלה',
        top: '✓ כיווץ למעלה בלי נדנוד',
        down: '↓ מורידים לאט לצידי הגוף',
        bottom: '⏸ יד ישרה לצידי הגוף',
      });
      const sx = 132, sy = 54, ex = 132, ey = 86;
      const angle = lerp(-1.28, 0.92, t), R = 30;
      const wx = ex + R * Math.cos(angle), wy = ey - R * Math.sin(angle);
      return {
        label,
        elements: (
          <G>
            <Line x1={15} y1={146} x2={265} y2={146} stroke={fg} strokeOpacity={0.25} strokeWidth={2} />
            <Circle cx={132} cy={36} r={10} fill={fg} fillOpacity={0.85} />
            <Line x1={132} y1={48} x2={132} y2={98} stroke={fg} strokeWidth={10.5} strokeLinecap="round" strokeOpacity={0.85} />
            <Line x1={132} y1={98} x2={132} y2={143} stroke={fg} strokeWidth={9} strokeLinecap="round" strokeOpacity={0.8} />
            <Line x1={sx} y1={sy} x2={ex} y2={ey} stroke={fg} strokeWidth={7} strokeLinecap="round" />
            <Line x1={ex} y1={ey} x2={wx} y2={wy} stroke={primary} strokeWidth={7} strokeLinecap="round" />
            <Rect x={wx - 3} y={wy - 12} width={6} height={24} rx={2} fill={fg} />
            <Rect x={wx - 7} y={wy - 10} width={14} height={5} rx={1.5} fill={primary} />
            <Rect x={wx - 7} y={wy + 5} width={14} height={5} rx={1.5} fill={primary} />
            <SvgText x={140} y={160} fontSize={12} fill={fg} opacity={0.7} textAnchor="middle">
              תרגיל 1 בצמד: כפיפת מרפקים בעמידה
            </SvgText>
          </G>
        ),
      };
    }

    case 'benchDips':
    default: {
      const { t, label } = getRepState(ms, {
        up: '↑ דוחפים את הגוף חזרה למעלה',
        top: '✓ ידיים ישרות על שפת הספסל',
        down: '↓ יורדים לאט עד 90 מעלות במרפק',
        bottom: '⏸ לא יורדים עמוק מדי!',
      });
      const drop = lerp(20, 0, t);
      const headY = 50 + drop, sy = 64 + drop, hy = 106 + drop;
      const ex = lerp(99, 114, t), ey = lerp(82, 83, t);
      return {
        label,
        elements: (
          <G>
            <Line x1={15} y1={142} x2={265} y2={142} stroke={fg} strokeOpacity={0.25} strokeWidth={2} />
            <Line x1={48} y1={35} x2={48} y2={142} stroke={fg} strokeOpacity={0.3} strokeWidth={3} />
            <Rect x={50} y={103} width={58} height={7} rx={2} fill={fg} fillOpacity={0.65} />
            <Line x1={56} y1={110} x2={56} y2={142} stroke={fg} strokeWidth={5} strokeOpacity={0.65} />
            <Line x1={100} y1={110} x2={100} y2={142} stroke={fg} strokeWidth={5} strokeOpacity={0.65} />
            <Circle cx={126} cy={headY} r={10} fill={fg} fillOpacity={0.85} />
            <Line x1={126} y1={sy} x2={126} y2={hy} stroke={fg} strokeWidth={10.5} strokeLinecap="round" strokeOpacity={0.85} />
            <Polyline points={`126,${hy} 166,112 186,140`} fill="none" stroke={fg} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.8} />
            <Polyline points={`124,${sy + 3} ${ex},${ey} 104,103`} fill="none" stroke={primary} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
            <SvgText x={140} y={158} fontSize={12} fill={fg} opacity={0.7} textAnchor="middle">
              תרגיל 2 בצמד: דחיפה אחורית על ספסל צמוד לקיר
            </SvgText>
          </G>
        ),
      };
    }
  }
}

export default function ExerciseAnimation({ exercise, paused, colors, fontsLoaded }) {
  const [subIdx, setSubIdx] = useState(0);
  const [nowMs, setNowMs] = useState(1200);

  useEffect(() => {
    if (paused) return undefined;
    let rafId;
    const start = Date.now();
    const tick = () => {
      setNowMs(Date.now() - start);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [paused]);

  const activeKey = exercise.animKeys[subIdx] || exercise.animKeys[0];
  const frame = computeFrame(activeKey, nowMs, colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
      {exercise.animKeys.length > 1 && (
        <View style={styles.subToggleRow}>
          {exercise.animLabels.map((lbl, idx) => {
            const active = idx === subIdx;
            return (
              <Pressable
                key={lbl}
                onPress={() => setSubIdx(idx)}
                style={[
                  styles.subToggleBtn,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.subToggleText,
                    {
                      color: active ? colors.primaryForeground : colors.foreground,
                      fontFamily: fontForWeight('semibold', fontsLoaded),
                    },
                  ]}
                >
                  {lbl}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.cueHeader}>
        <Text
          style={[
            styles.cueText,
            { color: colors.primary, fontFamily: fontForWeight('semibold', fontsLoaded) },
          ]}
        >
          {frame.label}
        </Text>
        <View style={[styles.loopBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text
            style={[
              styles.loopBadgeText,
              { color: colors.mutedForeground, fontFamily: fontForWeight('regular', fontsLoaded) },
            ]}
          >
            הדגמה חיה בלופ
          </Text>
        </View>
      </View>

      <View style={styles.svgWrap}>
        <Svg viewBox="0 0 280 168" width="100%" height={164}>
          {frame.elements}
        </Svg>
      </View>

      <View style={[styles.metaFooter, { borderTopColor: colors.border }]}>
        <Text
          style={[
            styles.metaText,
            { color: colors.mutedForeground, fontFamily: fontForWeight('regular', fontsLoaded) },
          ]}
        >
          ⏱ <Text style={{ fontFamily: fontForWeight('bold', fontsLoaded), color: colors.foreground }}>קצב תנועה:</Text> {exercise.tempo}
        </Text>
        <Text
          style={[
            styles.metaText,
            { color: colors.mutedForeground, fontFamily: fontForWeight('regular', fontsLoaded) },
          ]}
        >
          ⏳ <Text style={{ fontFamily: fontForWeight('bold', fontsLoaded), color: colors.foreground }}>מנוחה בין סט לסט:</Text> {exercise.restSec} שניות
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  subToggleRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    marginBottom: 8,
  },
  subToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  subToggleText: {
    fontSize: 12,
    textAlign: 'center',
  },
  cueHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  cueText: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 1,
  },
  loopBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  loopBadgeText: {
    fontSize: 12,
  },
  svgWrap: {
    width: '100%',
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaFooter: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 4,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 18,
  },
});
