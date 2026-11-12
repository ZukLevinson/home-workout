import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Linking,
  Share,
  Platform,
  SafeAreaView,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from '@expo-google-fonts/rubik';

import { lightColors, darkColors, fontForWeight } from './src/theme';
import {
  EXERCISES,
  EQUIPMENT_SUMMARY_ITEMS,
  GLOSSARY_ITEMS,
  WEEKLY_SCHEDULE,
  SETUP_MESSAGES,
  WORKOUT_NAMES_MAP,
  MUSCLE_FILTERS,
  buildConfigsForMode,
  snapToSupportedWeight,
  describeConfigSetup,
} from './src/data/exercises';
import ExerciseAnimation from './src/components/ExerciseAnimation';
import EquipmentBuildDiagram from './src/components/EquipmentBuildDiagram';
import ProgressChart from './src/components/ProgressChart';
import { isFirebaseConfigured } from './src/firebaseConfig';
import {
  loadLocalState,
  saveLocalDraft,
  saveLocalHistory,
  subscribeAuthAndFirestore,
  syncDraftToCloud,
  saveWorkoutToCloud,
  deleteWorkoutFromCloud,
  connectGoogleAccount,
} from './src/services/firebase';

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

const CONFIG_CACHE = {
  pair: buildConfigsForMode('pair'),
  single: buildConfigsForMode('single'),
  barbell: buildConfigsForMode('barbell'),
  platePair: buildConfigsForMode('platePair'),
  bodyweight: buildConfigsForMode('bodyweight'),
};

export default function App() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const { width } = useWindowDimensions();
  const isWide = width >= 760;

  const [fontsLoaded] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  // Navigation & UI state
  const [currentTab, setCurrentTab] = useState('workoutA');
  const [guideOpen, setGuideOpen] = useState(false);
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [animPaused, setAnimPaused] = useState(false);

  // Optional per-exercise mode override (e.g. ex1 Floor Press can toggle pair <-> barbell)
  const [exModeOverrides, setExModeOverrides] = useState({});

  // Rest timer state
  const [timerSeconds, setTimerSeconds] = useState(90);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);

  // Progress & Firebase Cloud state
  const [activeDraft, setActiveDraft] = useState({});
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [workoutNote, setWorkoutNote] = useState('');
  const [saveFeedback, setSaveFeedback] = useState(null);
  const [chartExerciseId, setChartExerciseId] = useState('ex1');
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState({
    mode: isFirebaseConfigured() ? 'connecting' : 'local',
    message: isFirebaseConfigured()
      ? 'מתחבר למסד הנתונים בענן...'
      : 'שמירה מקומית על המכשיר',
  });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  // Plate calculator state
  const [calcMode, setCalcMode] = useState('pair');
  const calcConfigs = useMemo(() => CONFIG_CACHE[calcMode] || buildConfigsForMode(calcMode), [calcMode]);
  const [calcIdx, setCalcIdx] = useState(6);

  const draftSyncTimeout = useRef(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = 'he';
      document.title = 'תכנית אימונים ביתית – הדגמות ומעקב התקדמות';
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    loadLocalState().then(({ draft, history }) => {
      if (!mounted) return;
      if (draft && Object.keys(draft).length > 0) setActiveDraft(draft);
      if (Array.isArray(history) && history.length > 0) setWorkoutHistory(history);
    });

    const unsubscribe = subscribeAuthAndFirestore({
      onUserChange: (u) => {
        if (mounted) setFirebaseUser(u);
      },
      onDraftRemote: (remoteDraft) => {
        if (!mounted) return;
        setActiveDraft(remoteDraft);
        saveLocalDraft(remoteDraft);
      },
      onHistoryRemote: (remoteList) => {
        if (!mounted) return;
        setWorkoutHistory(remoteList);
        saveLocalHistory(remoteList);
      },
      onSyncStatus: (st) => {
        if (mounted) setSyncStatus(st);
      },
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const id = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          setTimerFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const startTimer = (sec) => {
    setTimerFinished(false);
    setTimerSeconds(sec);
    setTimerRunning(true);
  };

  const toggleTimer = () => {
    if (timerRunning) {
      setTimerRunning(false);
    } else {
      setTimerFinished(false);
      if (timerSeconds <= 0) setTimerSeconds(90);
      setTimerRunning(true);
    }
  };

  const sortedHistoryDesc = useMemo(
    () => [...workoutHistory].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)),
    [workoutHistory]
  );

  const getLastExerciseLog = (exId) => {
    for (let i = 0; i < sortedHistoryDesc.length; i++) {
      const sess = sortedHistoryDesc[i];
      const found = (sess.items || []).find(
        (it) => it.exId === exId && Array.isArray(it.sets) && it.sets.length > 0
      );
      if (found) {
        return { date: sess.displayDate, sets: found.sets };
      }
    }
    return null;
  };

  const getEffectiveMode = (ex) => {
    if (exModeOverrides[ex.id]) return exModeOverrides[ex.id];
    if (activeDraft[`__mode_${ex.id}`]?.mode) return activeDraft[`__mode_${ex.id}`].mode;
    return ex.equipmentMode || 'pair';
  };

  const getConfigsForExercise = (ex) => {
    const mode = getEffectiveMode(ex);
    return CONFIG_CACHE[mode] || CONFIG_CACHE.pair;
  };

  const getSetEntry = (ex, setNum) => {
    const configs = getConfigsForExercise(ex);
    const key = `${ex.id}-${setNum}`;
    if (activeDraft[key]) {
      const snapped = snapToSupportedWeight(activeDraft[key].weight, configs);
      return {
        ...activeDraft[key],
        weight: snapped,
      };
    }
    const last = getLastExerciseLog(ex.id);
    let rawWeight = ex.defaultWeight;
    let reps = ex.defaultReps;
    if (last && last.sets.length > 0) {
      const match = last.sets.find((s) => s.setNum === setNum) || last.sets[last.sets.length - 1];
      rawWeight = match.weight;
      reps = match.reps;
    }
    return {
      weight: snapToSupportedWeight(rawWeight, configs),
      reps,
      done: false,
    };
  };

  const persistDraft = (nextDraft) => {
    setActiveDraft(nextDraft);
    saveLocalDraft(nextDraft);
    if (firebaseUser) {
      if (draftSyncTimeout.current) clearTimeout(draftSyncTimeout.current);
      draftSyncTimeout.current = setTimeout(() => {
        syncDraftToCloud(firebaseUser.uid, nextDraft).catch(() => {});
      }, 450);
    }
  };

  const setExerciseEquipmentMode = (ex, nextMode) => {
    setExModeOverrides((prev) => ({ ...prev, [ex.id]: nextMode }));
    const nextConfigs = CONFIG_CACHE[nextMode] || CONFIG_CACHE.pair;
    const effectiveSets = currentTab === 'express' ? 3 : ex.sets;
    const updated = {
      ...activeDraft,
      [`__mode_${ex.id}`]: { mode: nextMode },
    };
    for (let s = 1; s <= effectiveSets; s++) {
      const key = `${ex.id}-${s}`;
      const cur = getSetEntry(ex, s);
      updated[key] = {
        ...cur,
        weight: snapToSupportedWeight(cur.weight, nextConfigs),
      };
    }
    persistDraft(updated);
  };

  // Step weight strictly along the supported home-equipment weights array!
  const stepSupportedWeight = (ex, setNum, direction) => {
    const configs = getConfigsForExercise(ex);
    const cur = getSetEntry(ex, setNum);
    let idx = configs.findIndex((c) => c.totalWeight === cur.weight);
    if (idx === -1) {
      const snapped = snapToSupportedWeight(cur.weight, configs);
      idx = Math.max(0, configs.findIndex((c) => c.totalWeight === snapped));
    }
    const nextIdx = Math.max(0, Math.min(configs.length - 1, idx + direction));
    const key = `${ex.id}-${setNum}`;
    persistDraft({
      ...activeDraft,
      [key]: { ...cur, weight: configs[nextIdx].totalWeight },
    });
  };

  const selectWeightForSet = (ex, setNum, exactWeight) => {
    const cur = getSetEntry(ex, setNum);
    const key = `${ex.id}-${setNum}`;
    persistDraft({
      ...activeDraft,
      [key]: { ...cur, weight: exactWeight },
    });
  };

  // Apply chosen supported weight to all uncompleted sets of this exercise (or all sets if all done)
  const selectWeightForExercise = (ex, exactWeight) => {
    const effectiveSets = currentTab === 'express' ? 3 : ex.sets;
    const updated = { ...activeDraft };
    let changedAny = false;
    for (let s = 1; s <= effectiveSets; s++) {
      const cur = getSetEntry(ex, s);
      if (!cur.done) {
        updated[`${ex.id}-${s}`] = { ...cur, weight: exactWeight };
        changedAny = true;
      }
    }
    if (!changedAny) {
      for (let s = 1; s <= effectiveSets; s++) {
        const cur = getSetEntry(ex, s);
        updated[`${ex.id}-${s}`] = { ...cur, weight: exactWeight };
      }
    }
    persistDraft(updated);
  };

  const stepReps = (ex, setNum, delta) => {
    const key = `${ex.id}-${setNum}`;
    const cur = getSetEntry(ex, setNum);
    const nextVal = Math.max(1, Math.round((Number(cur.reps) || 1) + delta));
    persistDraft({
      ...activeDraft,
      [key]: { ...cur, reps: nextVal },
    });
  };

  const updateRepsText = (ex, setNum, raw) => {
    const key = `${ex.id}-${setNum}`;
    const cur = getSetEntry(ex, setNum);
    const parsed = parseInt(raw, 10);
    const nextVal = Number.isNaN(parsed) || parsed < 1 ? 1 : Math.min(200, parsed);
    persistDraft({
      ...activeDraft,
      [key]: { ...cur, reps: nextVal },
    });
  };

  const toggleSetDone = (ex, setNum) => {
    const key = `${ex.id}-${setNum}`;
    const cur = getSetEntry(ex, setNum);
    const nextDone = !cur.done;
    persistDraft({
      ...activeDraft,
      [key]: { ...cur, done: nextDone },
    });
    if (nextDone) {
      startTimer(ex.restSec);
    }
  };

  const clearSetCheckmarks = () => {
    const cleaned = {};
    Object.keys(activeDraft).forEach((k) => {
      if (k.startsWith('__mode_')) {
        cleaned[k] = activeDraft[k];
      } else {
        cleaned[k] = { ...activeDraft[k], done: false };
      }
    });
    persistDraft(cleaned);
  };

  const visibleExercises = useMemo(() => {
    if (currentTab === 'workoutA') {
      return EXERCISES.filter((e) => e.workouts.includes('workoutA')).sort(
        (a, b) => a.orderA - b.orderA
      );
    }
    if (currentTab === 'workoutB') {
      return EXERCISES.filter((e) => e.workouts.includes('workoutB')).sort(
        (a, b) => a.orderB - b.orderB
      );
    }
    if (currentTab === 'express') {
      return EXERCISES.filter((e) => e.workouts.includes('express')).sort(
        (a, b) => a.orderExpress - b.orderExpress
      );
    }
    if (currentTab === 'all') {
      return muscleFilter === 'all'
        ? EXERCISES
        : EXERCISES.filter((e) => e.muscle === muscleFilter);
    }
    return [];
  }, [currentTab, muscleFilter]);

  const { totalDoneInView, totalSetsInView } = useMemo(() => {
    let doneCount = 0;
    let totalCount = 0;
    visibleExercises.forEach((ex) => {
      const effectiveSets = currentTab === 'express' ? 3 : ex.sets;
      totalCount += effectiveSets;
      for (let s = 1; s <= effectiveSets; s++) {
        if (getSetEntry(ex, s).done) doneCount++;
      }
    });
    return { totalDoneInView: doneCount, totalSetsInView: totalCount };
  }, [visibleExercises, activeDraft, exModeOverrides, currentTab, sortedHistoryDesc]);

  const handleSaveWorkoutSession = async () => {
    const items = [];
    let sessionTotalSets = 0;

    visibleExercises.forEach((ex) => {
      const effectiveSets = currentTab === 'express' ? 3 : ex.sets;
      const doneSets = [];
      for (let s = 1; s <= effectiveSets; s++) {
        const entry = getSetEntry(ex, s);
        if (entry.done) {
          doneSets.push({
            setNum: s,
            weight: Number(entry.weight) || 0,
            reps: Math.max(1, Math.round(Number(entry.reps) || 1)),
          });
        }
      }
      if (doneSets.length > 0) {
        sessionTotalSets += doneSets.length;
        items.push({
          exId: ex.id,
          exName: ex.name,
          sets: doneSets,
        });
      }
    });

    if (items.length === 0) {
      setSaveFeedback({
        error: true,
        text: '⚠️ סמן לפחות סט אחד שבוצע ("בוצע ✓") לפני שמירת האימון ביומן.',
      });
      return;
    }

    const now = new Date();
    const nowMs = now.getTime();
    const displayDate = now.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const allowedTabs = ['workoutA', 'workoutB', 'express', 'all'];
    const workoutTab = allowedTabs.includes(currentTab) ? currentTab : 'workoutA';

    const sessionDoc = {
      id: `sess_${nowMs}`,
      isoDate: now.toISOString(),
      createdAtMs: nowMs,
      displayDate,
      workoutTab,
      workoutTitle: WORKOUT_NAMES_MAP[workoutTab] || 'אימון ביתי',
      note: workoutNote.trim().slice(0, 500),
      totalSets: sessionTotalSets,
      items,
    };

    const nextHistory = [sessionDoc, ...sortedHistoryDesc];
    setWorkoutHistory(nextHistory);
    await saveLocalHistory(nextHistory);

    if (firebaseUser) {
      try {
        await saveWorkoutToCloud(firebaseUser.uid, sessionDoc);
      } catch (err) {
        // Local copy already saved
      }
    }

    clearSetCheckmarks();
    setWorkoutNote('');
    setSaveFeedback(null);
    setCurrentTab('progress');
  };

  const handleDeleteSession = async (sessionId) => {
    const nextHistory = sortedHistoryDesc.filter((s) => s.id !== sessionId);
    setWorkoutHistory(nextHistory);
    await saveLocalHistory(nextHistory);
    if (firebaseUser) {
      try {
        await deleteWorkoutFromCloud(firebaseUser.uid, sessionId);
      } catch (err) {
        // ignore
      }
    }
  };

  const handleExportBackup = async () => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        workoutHistory: sortedHistoryDesc,
        activeDraft,
      },
      null,
      2
    );

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'home-workout-progress-backup.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ message: payload, title: 'גיבוי יומן אימונים' });
    }
  };

  const handleApplyImportJson = async () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (Array.isArray(parsed.workoutHistory)) {
        const normalized = parsed.workoutHistory
          .map((s, idx) => {
            const ts =
              s.createdAtMs ||
              new Date(s.isoDate || Date.now()).getTime() ||
              Date.now() - idx * 1000;
            const setsSum = (s.items || []).reduce(
              (acc, it) => acc + ((it.sets || []).length || 0),
              0
            );
            return {
              id: String(s.id || `sess_${ts}`).slice(0, 80),
              isoDate: String(s.isoDate || new Date(ts).toISOString()),
              createdAtMs: ts,
              displayDate: String(
                s.displayDate || new Date(ts).toLocaleDateString('he-IL')
              ).slice(0, 120),
              workoutTab: ['workoutA', 'workoutB', 'express', 'all', 'imported'].includes(
                s.workoutTab
              )
                ? s.workoutTab
                : 'imported',
              workoutTitle: String(s.workoutTitle || 'אימון מיובא').slice(0, 150),
              note: String(s.note || '').slice(0, 500),
              totalSets: Math.max(1, Math.min(150, setsSum || 1)),
              items: Array.isArray(s.items) ? s.items.slice(0, 30) : [],
            };
          })
          .filter((s) => s.items.length > 0);

        setWorkoutHistory(normalized);
        await saveLocalHistory(normalized);
        if (firebaseUser) {
          for (const docItem of normalized) {
            await saveWorkoutToCloud(firebaseUser.uid, docItem).catch(() => {});
          }
        }
      }
      if (parsed.activeDraft && typeof parsed.activeDraft === 'object') {
        persistDraft(parsed.activeDraft);
      }
      setImportJsonText('');
      setImportModalOpen(false);
    } catch (e) {
      setSaveFeedback({ error: true, text: 'הטקסט שהודבק אינו קובץ גיבוי תקין.' });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const prevHistory = [...sortedHistoryDesc];
      const user = await connectGoogleAccount();
      for (const sess of prevHistory) {
        await saveWorkoutToCloud(user.uid, sess).catch(() => {});
      }
    } catch (err) {
      // User closed popup
    }
  };

  const progressStats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let weekCount = 0;
    let setsSum = 0;
    sortedHistoryDesc.forEach((s) => {
      const t = s.createdAtMs || new Date(s.isoDate).getTime();
      if (t >= sevenDaysAgo) weekCount++;
      (s.items || []).forEach((it) => {
        setsSum += (it.sets || []).length;
      });
    });
    return {
      totalWorkouts: sortedHistoryDesc.length,
      weekWorkouts: weekCount,
      totalSets: setsSum,
    };
  }, [sortedHistoryDesc]);

  const safeCalcIdx = Math.min(calcIdx, Math.max(0, calcConfigs.length - 1));
  const activeCalcCfg = calcConfigs[safeCalcIdx] || calcConfigs[0];

  const fReg = fontForWeight('regular', fontsLoaded);
  const fMed = fontForWeight('medium', fontsLoaded);
  const fSemi = fontForWeight('semibold', fontsLoaded);
  const fBold = fontForWeight('bold', fontsLoaded);

  const navTabs = [
    { key: 'workoutA', label: 'אימון בית 1: חזה, גב וזרועות' },
    { key: 'workoutB', label: 'אימון בית 2: כתפיים, גב וזרועות' },
    { key: 'express', label: '⚡ אימון קצר (20 דקות)' },
    { key: 'progress', label: '📈 ההתקדמות שלי', badge: sortedHistoryDesc.length },
    { key: 'all', label: 'כל התרגילים' },
    { key: 'calculator', label: '🔩 מחשבון פלטות' },
  ];

  return (
    <SafeAreaView style={[styles.safeRoot, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.maxWidthWrap}>
          {/* HEADER + REST TIMER */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.headerRow, isWide && styles.headerRowWide]}>
              <View style={styles.headerTextCol}>
                <View style={styles.badgesWrap}>
                  <View style={[styles.pillBadge, { backgroundColor: colors.secondary }]}>
                    <Text
                      style={[
                        styles.pillBadgeText,
                        { color: colors.secondaryForeground, fontFamily: fMed },
                      ]}
                    >
                      הדגמה חיה + סרטונים • מותאם לפלטות שלך בלבד • ללא קיצורים
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.pillBadge,
                      {
                        backgroundColor:
                          syncStatus.mode === 'cloud' ? colors.successSoft : colors.secondary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillBadgeText,
                        {
                          color:
                            syncStatus.mode === 'cloud' ? colors.success : colors.mutedForeground,
                          fontFamily: fSemi,
                        },
                      ]}
                    >
                      ☁️ {syncStatus.message}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.appTitle, { color: colors.foreground, fontFamily: fBold }]}>
                  תכנית אימונים ביתית לפלג גוף עליון
                </Text>
                <Text
                  style={[
                    styles.appSubtitle,
                    { color: colors.mutedForeground, fontFamily: fReg },
                  ]}
                >
                  מותאמת לערכה שלך ולספסל העץ של איקאה{' '}
                  <Text style={{ color: colors.foreground, fontFamily: fSemi }}>STOREDAMM</Text>. כל משקל שתבחר באתר מחושב אך ורק מהפלטות והמוטות שיש לך בארגז!
                </Text>

                {Platform.OS === 'web' &&
                  isFirebaseConfigured() &&
                  (!firebaseUser || firebaseUser.isAnonymous) && (
                    <Pressable
                      onPress={handleGoogleSignIn}
                      style={[
                        styles.googleSyncBtn,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.googleSyncBtnText,
                          { color: colors.primary, fontFamily: fSemi },
                        ]}
                      >
                        🔗 התחבר עם Google כדי לסנכרן בין האייפון למחשב
                      </Text>
                    </Pressable>
                  )}
              </View>

              {/* Rest Timer Box */}
              <View
                style={[
                  styles.timerBox,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <View style={styles.timerReadoutCol}>
                  <Text
                    style={[styles.timerLabel, { color: colors.mutedForeground, fontFamily: fReg }]}
                  >
                    שעון מנוחה בין סטים
                  </Text>
                  <Text
                    style={[
                      styles.timerValue,
                      {
                        color: timerFinished ? colors.success : colors.foreground,
                        fontFamily: fBold,
                      },
                    ]}
                  >
                    {timerFinished ? 'אפשר להמשיך! 💪' : formatTime(timerSeconds)}
                  </Text>
                </View>
                <View style={styles.timerButtonsCol}>
                  <View style={styles.timerPresetRow}>
                    <Pressable
                      onPress={() => startTimer(60)}
                      style={[styles.smallBtn, { backgroundColor: colors.secondary }]}
                    >
                      <Text
                        style={[
                          styles.smallBtnText,
                          { color: colors.secondaryForeground, fontFamily: fMed },
                        ]}
                      >
                        60 שניות
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => startTimer(90)}
                      style={[styles.smallBtn, { backgroundColor: colors.secondary }]}
                    >
                      <Text
                        style={[
                          styles.smallBtnText,
                          { color: colors.secondaryForeground, fontFamily: fMed },
                        ]}
                      >
                        90 שניות
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={toggleTimer}
                    style={[styles.primarySmallBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text
                      style={[
                        styles.smallBtnText,
                        { color: colors.primaryForeground, fontFamily: fSemi },
                      ]}
                    >
                      {timerRunning ? 'עצור שעון' : 'הפעל שעון'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* MY HOME EQUIPMENT INVENTORY STRIP */}
            <View
              style={[
                styles.inventoryStrip,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.inventoryTitle,
                  { color: colors.foreground, fontFamily: fBold },
                ]}
              >
                📦 תכולת ארגז המשקולות שלך (האתר מאפשר לבחור אך ורק משקלים שניתן להרכיב מהרשימה הזו):
              </Text>
              <View style={styles.filterRow}>
                {EQUIPMENT_SUMMARY_ITEMS.map((item) => (
                  <View
                    key={item}
                    style={[
                      styles.inventoryChip,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillBadgeText,
                        { color: colors.foreground, fontFamily: fMed },
                      ]}
                    >
                      • {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* COLLAPSIBLE BEGINNER GUIDE + SAFETY + SCHEDULE */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable onPress={() => setGuideOpen((o) => !o)} style={styles.accordionHeader}>
              <Text style={[styles.accordionTitle, { color: colors.foreground, fontFamily: fBold }]}>
                📖 מדריך מהיר למתחילים, בטיחות בספסל איקאה ולוח שבועי מומלץ
              </Text>
              <View style={[styles.smallBtn, { backgroundColor: colors.secondary }]}>
                <Text
                  style={[
                    styles.smallBtnText,
                    { color: colors.secondaryForeground, fontFamily: fMed },
                  ]}
                >
                  {guideOpen ? 'הסתר ▲' : 'הצג ▼'}
                </Text>
              </View>
            </Pressable>

            {guideOpen && (
              <View style={[styles.accordionBody, { borderTopColor: colors.border }]}>
                <View style={[styles.glossaryGrid, isWide && styles.glossaryGridWide]}>
                  {GLOSSARY_ITEMS.map((item) => (
                    <View
                      key={item.title}
                      style={[
                        styles.subCard,
                        isWide && styles.glossaryItemWide,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.subCardText,
                          { color: colors.mutedForeground, fontFamily: fReg },
                        ]}
                      >
                        {item.body}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.twoColGrid, isWide && styles.twoColGridWide]}>
                  <View
                    style={[
                      styles.subCard,
                      { flex: 1, backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <Text
                        style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}
                      >
                        ⚠️ בטיחות עם ספסל איקאה STOREDAMM
                      </Text>
                      <View style={[styles.pillBadge, { backgroundColor: colors.secondary }]}>
                        <Text
                          style={[
                            styles.pillBadgeText,
                            { color: colors.secondaryForeground, fontFamily: fMed },
                          ]}
                        >
                          אורך 63 סנטימטר | עד 100 קילוגרם
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.subCardText,
                        { color: colors.mutedForeground, fontFamily: fReg },
                      ]}
                    >
                      הספסל מוגבל ל-100 קילוגרם בסך הכל (משקל הגוף שלך + המשקולות יחד). לכן לא שוכבים או יושבים עליו עם משקולות, אלא רק נשענים עליו עם יד אחת או שמים עליו רגליים או ידיים כשהוא צמוד לקיר.
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.subCard,
                      { flex: 1, backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}
                    >
                      🏋️ דוגמה לשילוב בשבוע עם 3 אימוני קרוספיט
                    </Text>
                    <View style={styles.weekRow}>
                      {WEEKLY_SCHEDULE.map((d) => {
                        const isPrimary = d.highlight === 'primary';
                        const isSec = d.highlight === 'secondary';
                        const bg = isPrimary
                          ? colors.primary
                          : isSec
                          ? colors.secondary
                          : colors.card;
                        const fg = isPrimary
                          ? colors.primaryForeground
                          : isSec
                          ? colors.secondaryForeground
                          : colors.foreground;
                        return (
                          <View
                            key={d.day}
                            style={[
                              styles.dayBox,
                              { backgroundColor: bg, borderColor: colors.border },
                            ]}
                          >
                            <Text style={[styles.dayBoxTitle, { color: fg, fontFamily: fBold }]}>
                              {d.day}
                            </Text>
                            <Text style={[styles.dayBoxSub, { color: fg, fontFamily: fReg }]}>
                              {d.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* MAIN NAVIGATION TABS */}
          <View style={[styles.tabsWrap, { borderBottomColor: colors.border }]}>
            {navTabs.map((t) => {
              const active = currentTab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => {
                    setSaveFeedback(null);
                    setOpenSetPickerKey(null);
                    setCurrentTab(t.key);
                  }}
                  style={[
                    styles.tabBtn,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      {
                        color: active ? colors.primaryForeground : colors.foreground,
                        fontFamily: fSemi,
                      },
                    ]}
                  >
                    {t.label}
                  </Text>
                  {typeof t.badge === 'number' && (
                    <View
                      style={[
                        styles.tabCountBadge,
                        {
                          backgroundColor: active ? 'rgba(255,255,255,0.22)' : colors.secondary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabCountText,
                          {
                            color: active ? colors.primaryForeground : colors.secondaryForeground,
                            fontFamily: fBold,
                          },
                        ]}
                      >
                        {t.badge}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* SETUP BANNER FOR WORKOUT TABS */}
          {SETUP_MESSAGES[currentTab] && (
            <View
              style={[
                styles.card,
                styles.setupBanner,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}>
                  {SETUP_MESSAGES[currentTab].title}
                </Text>
                <Text
                  style={[styles.subCardText, { color: colors.mutedForeground, fontFamily: fReg }]}
                >
                  {SETUP_MESSAGES[currentTab].desc}
                </Text>
              </View>
              <View style={styles.setupActionsRow}>
                <Pressable
                  onPress={() => setAnimPaused((p) => !p)}
                  style={[
                    styles.outlineBtn,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.smallBtnText, { color: colors.foreground, fontFamily: fMed }]}>
                    {animPaused ? '▶ המשך אנימציות' : '⏸ השהה אנימציות'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={clearSetCheckmarks}
                  style={[
                    styles.outlineBtn,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.smallBtnText,
                      { color: colors.mutedForeground, fontFamily: fMed },
                    ]}
                  >
                    נקה סימוני סטים
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* MUSCLE FILTER BAR ON 'ALL' TAB */}
          {currentTab === 'all' && (
            <View style={styles.filterRow}>
              {MUSCLE_FILTERS.map((mf) => {
                const active = muscleFilter === mf;
                const lbl = mf === 'all' ? 'כל התרגילים (10)' : mf;
                return (
                  <Pressable
                    key={mf}
                    onPress={() => setMuscleFilter(mf)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.smallBtnText,
                        {
                          color: active ? colors.primaryForeground : colors.foreground,
                          fontFamily: fSemi,
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

          {/* EXERCISES LIST */}
          {currentTab !== 'progress' && currentTab !== 'calculator' && (
            <View style={styles.exercisesList}>
              {visibleExercises.map((ex, idx) => {
                const effectiveSets = currentTab === 'express' ? 3 : ex.sets;
                const effectiveMode = getEffectiveMode(ex);
                const exConfigs = getConfigsForExercise(ex);

                const unitLabel =
                  effectiveMode === 'barbell'
                    ? 'קילוגרם בסך הכל במוט הארוך'
                    : ex.weightUnitLabel;

                const lastLog = getLastExerciseLog(ex.id);
                const bestLastSet = lastLog
                  ? lastLog.sets.reduce(
                      (acc, cur) => (cur.weight > acc.weight ? cur : acc),
                      lastLog.sets[0]
                    )
                  : null;

                return (
                  <View
                    key={ex.id}
                    style={[
                      styles.card,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    {/* Exercise Header */}
                    <View style={[styles.exHeader, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={styles.exTitleRow}>
                          <View style={[styles.indexBadge, { backgroundColor: colors.primary }]}>
                            <Text
                              style={[
                                styles.indexBadgeText,
                                { color: colors.primaryForeground, fontFamily: fBold },
                              ]}
                            >
                              {idx + 1}
                            </Text>
                          </View>
                          <Text
                            style={[styles.exTitle, { color: colors.foreground, fontFamily: fBold }]}
                          >
                            {ex.name}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.subCardText,
                            { color: colors.mutedForeground, fontFamily: fReg },
                          ]}
                        >
                          <Text style={{ fontFamily: fBold, color: colors.foreground }}>
                            ציוד נדרש:{' '}
                          </Text>
                          {ex.equipment}
                        </Text>
                        {lastLog && bestLastSet && (
                          <View
                            style={[styles.lastLogBadge, { backgroundColor: colors.secondary }]}
                          >
                            <Text
                              style={[
                                styles.lastLogText,
                                { color: colors.secondaryForeground, fontFamily: fMed },
                              ]}
                            >
                              📌 בפעם הקודמת ({lastLog.date}):{' '}
                              <Text style={{ fontFamily: fBold }}>
                                {bestLastSet.weight} קילוגרם × {bestLastSet.reps} חזרות
                              </Text>
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.exPillsCol}>
                        <View style={[styles.pillBadge, { backgroundColor: colors.secondary }]}>
                          <Text
                            style={[
                              styles.pillBadgeText,
                              { color: colors.secondaryForeground, fontFamily: fSemi },
                            ]}
                          >
                            {ex.muscle}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.pillBadge,
                            {
                              backgroundColor: colors.background,
                              borderColor: colors.border,
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pillBadgeText,
                              { color: colors.mutedForeground, fontFamily: fReg },
                            ]}
                          >
                            {effectiveSets} סטים של {ex.reps}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Exercise Body: Animation + Instructions + Supported-Weight Logger */}
                    <View style={[styles.exBodyGrid, isWide && styles.exBodyGridWide]}>
                      <View style={[styles.exAnimCol, isWide && styles.exAnimColWide]}>
                        <ExerciseAnimation
                          exercise={ex}
                          paused={animPaused}
                          colors={colors}
                          fontsLoaded={fontsLoaded}
                        />
                        <View style={styles.videosRow}>
                          {ex.videos.map((v) => (
                            <Pressable
                              key={v.url}
                              onPress={() => Linking.openURL(v.url)}
                              style={[
                                styles.videoBtn,
                                { backgroundColor: colors.secondary, borderColor: colors.border },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.smallBtnText,
                                  { color: colors.secondaryForeground, fontFamily: fSemi },
                                ]}
                              >
                                🎬 {v.label} ↗
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <View style={[styles.exDetailsCol, isWide && styles.exDetailsColWide]}>
                        <Text
                          style={[
                            styles.subCardTitle,
                            { color: colors.foreground, fontFamily: fBold },
                          ]}
                        >
                          איך לבצע צעד-אחר-צעד:
                        </Text>
                        <View style={{ gap: 8 }}>
                          {ex.steps.map((st, sIdx) => (
                            <View key={sIdx} style={styles.stepRow}>
                              <View
                                style={[
                                  styles.stepNumCircle,
                                  { backgroundColor: colors.secondary },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.stepNumText,
                                    { color: colors.secondaryForeground, fontFamily: fBold },
                                  ]}
                                >
                                  {sIdx + 1}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.stepBodyText,
                                  { color: colors.foreground, fontFamily: fReg },
                                ]}
                              >
                                {st}
                              </Text>
                            </View>
                          ))}
                        </View>

                        {/* Tips & Warnings */}
                        <View style={[styles.twoColGrid, isWide && styles.twoColGridWide]}>
                          <View
                            style={[
                              styles.subCard,
                              {
                                flex: 1,
                                backgroundColor: colors.background,
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.subCardText,
                                { color: colors.mutedForeground, fontFamily: fReg },
                              ]}
                            >
                              <Text style={{ color: colors.success, fontFamily: fBold }}>
                                💡 למה זה טוב:{' '}
                              </Text>
                              {ex.homeTip}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.subCard,
                              {
                                flex: 1,
                                backgroundColor: colors.background,
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.subCardText,
                                { color: colors.mutedForeground, fontFamily: fReg },
                              ]}
                            >
                              <Text style={{ color: colors.danger, fontFamily: fBold }}>
                                ⚠️ ממה להיזהר:{' '}
                              </Text>
                              {ex.avoid}
                            </Text>
                          </View>
                        </View>

                        {/* PER-SET SUPPORTED WEIGHT PICKER + ANIMATED BUILD DRAWING + REPS LOGGER */}
                        <View style={[styles.loggerSection, { borderTopColor: colors.border }]}>
                          <View style={styles.rowBetween}>
                            <Text
                              style={[
                                styles.loggerHeader,
                                { color: colors.foreground, fontFamily: fBold },
                              ]}
                            >
                              ✍️ בחירת משקל והרכבת ציוד בכל סט ({unitLabel}):
                            </Text>

                            {ex.allowBarbellToggle && (
                              <View style={styles.modeToggleWrap}>
                                {[
                                  { id: 'pair', label: 'שתי משקולות יד' },
                                  { id: 'barbell', label: 'המוט הארוך' },
                                ].map((opt) => {
                                  const active = effectiveMode === opt.id;
                                  return (
                                    <Pressable
                                      key={opt.id}
                                      onPress={() => setExerciseEquipmentMode(ex, opt.id)}
                                      style={[
                                        styles.modeToggleBtn,
                                        {
                                          backgroundColor: active
                                            ? colors.primary
                                            : colors.background,
                                          borderColor: active ? colors.primary : colors.border,
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.smallBtnText,
                                          {
                                            color: active
                                              ? colors.primaryForeground
                                              : colors.foreground,
                                            fontFamily: fSemi,
                                          },
                                        ]}
                                      >
                                        {opt.label}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            )}
                          </View>

                          {/* Per-Set Self-Contained Cards */}
                          <View style={{ gap: 12 }}>
                            {Array.from({ length: effectiveSets }, (_, i) => i + 1).map((setNum) => {
                              const entry = getSetEntry(ex, setNum);
                              const setCfg =
                                exConfigs.find((c) => c.totalWeight === entry.weight) ||
                                exConfigs[0];
                              const curCfgIdx = exConfigs.findIndex(
                                (c) => c.totalWeight === entry.weight
                              );
                              const atMin = curCfgIdx <= 0;
                              const atMax = curCfgIdx >= exConfigs.length - 1;

                              return (
                                <View
                                  key={setNum}
                                  style={[
                                    styles.setCard,
                                    {
                                      backgroundColor: colors.background,
                                      borderColor: entry.done ? colors.primary : colors.border,
                                    },
                                  ]}
                                >
                                  {/* Set Top Controls: Label + Weight Stepper + Reps Stepper + Done */}
                                  <View style={styles.setCardHeaderRow}>
                                    <Text
                                      style={[
                                        styles.setLabel,
                                        { color: colors.foreground, fontFamily: fBold },
                                      ]}
                                    >
                                      סט {setNum}
                                    </Text>

                                    {/* Supported Weight Stepper */}
                                    <View style={styles.stepperGroup}>
                                      <Pressable
                                        disabled={atMin}
                                        onPress={() => stepSupportedWeight(ex, setNum, -1)}
                                        style={[
                                          styles.stepperBtn,
                                          {
                                            backgroundColor: colors.card,
                                            borderColor: colors.border,
                                            opacity: atMin ? 0.35 : 1,
                                          },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.stepperBtnText,
                                            { color: colors.foreground, fontFamily: fBold },
                                          ]}
                                        >
                                          −
                                        </Text>
                                      </Pressable>

                                      <View
                                        style={[
                                          styles.weightDisplayPill,
                                          {
                                            backgroundColor: colors.card,
                                            borderColor: colors.primary,
                                          },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.smallBtnText,
                                            { color: colors.foreground, fontFamily: fBold },
                                          ]}
                                        >
                                          {entry.weight === 0
                                            ? 'משקל גוף (0)'
                                            : `${entry.weight} קילוגרם`}
                                        </Text>
                                      </View>

                                      <Pressable
                                        disabled={atMax}
                                        onPress={() => stepSupportedWeight(ex, setNum, 1)}
                                        style={[
                                          styles.stepperBtn,
                                          {
                                            backgroundColor: colors.card,
                                            borderColor: colors.border,
                                            opacity: atMax ? 0.35 : 1,
                                          },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.stepperBtnText,
                                            { color: colors.foreground, fontFamily: fBold },
                                          ]}
                                        >
                                          +
                                        </Text>
                                      </Pressable>
                                    </View>

                                    {/* Reps Stepper */}
                                    <View style={styles.stepperGroup}>
                                      <Pressable
                                        onPress={() => stepReps(ex, setNum, -1)}
                                        style={[
                                          styles.stepperBtn,
                                          {
                                            backgroundColor: colors.card,
                                            borderColor: colors.border,
                                          },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.stepperBtnText,
                                            { color: colors.foreground, fontFamily: fBold },
                                          ]}
                                        >
                                          −
                                        </Text>
                                      </Pressable>
                                      <TextInput
                                        value={String(entry.reps)}
                                        onChangeText={(txt) => updateRepsText(ex, setNum, txt)}
                                        keyboardType="number-pad"
                                        style={[
                                          styles.stepperInputSmall,
                                          {
                                            backgroundColor: colors.card,
                                            borderColor: colors.border,
                                            color: colors.foreground,
                                            fontFamily: fBold,
                                          },
                                        ]}
                                      />
                                      <Pressable
                                        onPress={() => stepReps(ex, setNum, 1)}
                                        style={[
                                          styles.stepperBtn,
                                          {
                                            backgroundColor: colors.card,
                                            borderColor: colors.border,
                                          },
                                        ]}
                                      >
                                        <Text
                                          style={[
                                            styles.stepperBtnText,
                                            { color: colors.foreground, fontFamily: fBold },
                                          ]}
                                        >
                                          +
                                        </Text>
                                      </Pressable>
                                      <Text
                                        style={[
                                          styles.unitLabel,
                                          { color: colors.mutedForeground, fontFamily: fReg },
                                        ]}
                                      >
                                        חזרות
                                      </Text>
                                    </View>

                                    {/* Mark Done Button */}
                                    <Pressable
                                      onPress={() => toggleSetDone(ex, setNum)}
                                      style={[
                                        styles.doneBtn,
                                        {
                                          backgroundColor: entry.done
                                            ? colors.primarySoft
                                            : colors.card,
                                          borderColor: entry.done ? colors.primary : colors.border,
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.smallBtnText,
                                          {
                                            color: entry.done ? colors.primary : colors.foreground,
                                            fontFamily: fBold,
                                          },
                                        ]}
                                      >
                                        {entry.done ? 'בוצע ✓' : 'סמן בוצע'}
                                      </Text>
                                    </Pressable>
                                  </View>

                                  {/* Per-Set Weight Picker Chips (Directly Inside Set) */}
                                  <View
                                    style={[
                                      styles.setWeightSection,
                                      { borderTopColor: colors.border },
                                    ]}
                                  >
                                    <View style={styles.setCopyRow}>
                                      <Text
                                        style={[
                                          styles.supportedWeightsCaption,
                                          { color: colors.mutedForeground, fontFamily: fMed },
                                        ]}
                                      >
                                        משקלים זמינים בערכה לסט {setNum}:
                                      </Text>
                                      {effectiveSets > 1 && (
                                        <Pressable
                                          onPress={() =>
                                            selectWeightForExercise(ex, entry.weight)
                                          }
                                          style={[
                                            styles.copyAllSetsBtn,
                                            {
                                              backgroundColor: colors.card,
                                              borderColor: colors.border,
                                            },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.copyAllSetsText,
                                              { color: colors.primary, fontFamily: fSemi },
                                            ]}
                                          >
                                            העתק משקל לכל הסטים הפתוחים
                                          </Text>
                                        </Pressable>
                                      )}
                                    </View>

                                    <ScrollView
                                      horizontal
                                      showsHorizontalScrollIndicator={false}
                                      contentContainerStyle={styles.chipsScrollRow}
                                    >
                                      {exConfigs.map((cfg) => {
                                        const selected = cfg.totalWeight === entry.weight;
                                        return (
                                          <Pressable
                                            key={cfg.totalWeight}
                                            onPress={() =>
                                              selectWeightForSet(ex, setNum, cfg.totalWeight)
                                            }
                                            style={[
                                              styles.weightOptionChip,
                                              {
                                                backgroundColor: selected
                                                  ? colors.primary
                                                  : colors.card,
                                                borderColor: selected
                                                  ? colors.primary
                                                  : colors.border,
                                              },
                                            ]}
                                          >
                                            <Text
                                              style={[
                                                styles.smallBtnText,
                                                {
                                                  color: selected
                                                    ? colors.primaryForeground
                                                    : colors.foreground,
                                                  fontFamily: selected ? fBold : fMed,
                                                },
                                              ]}
                                            >
                                              {cfg.totalWeight === 0
                                                ? '0 (משקל גוף)'
                                                : `${cfg.totalWeight}`}
                                            </Text>
                                          </Pressable>
                                        );
                                      })}
                                    </ScrollView>

                                    {/* Animated Circular-Plate Equipment Diagram Inside Set */}
                                    <EquipmentBuildDiagram
                                      cfg={setCfg}
                                      mode={effectiveMode}
                                      paused={animPaused}
                                      colors={colors}
                                      fontsLoaded={fontsLoaded}
                                    />

                                    {/* Plate Recipe Summary Inside Set */}
                                    <View
                                      style={[
                                        styles.plateRecipeBar,
                                        { backgroundColor: colors.card, borderColor: colors.border },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.plateRecipeText,
                                          { color: colors.foreground, fontFamily: fMed },
                                        ]}
                                      >
                                        🔩{' '}
                                        <Text style={{ color: colors.primary, fontFamily: fBold }}>
                                          איך מרכיבים {setCfg.totalWeight} קילוגרם:{' '}
                                        </Text>
                                        {describeConfigSetup(setCfg, effectiveMode)}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* SAVE WORKOUT TO LOG CARD */}
          {SETUP_MESSAGES[currentTab] && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                  borderWidth: 2,
                },
              ]}
            >
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={[styles.saveCardTitle, { color: colors.foreground, fontFamily: fBold }]}
                  >
                    🎉 סיימת את האימון? שמור אותו ביומן ההתקדמות!
                  </Text>
                  <Text
                    style={[
                      styles.subCardText,
                      { color: colors.mutedForeground, fontFamily: fReg },
                    ]}
                  >
                    כל הסטים שסימנת (כולל המשקלים ומספר החזרות) יישמרו עם התאריך של היום בענן ועל המכשיר, ובאימון הבא יתמלאו אוטומטית.
                  </Text>
                </View>
                <View style={[styles.pillBadge, { backgroundColor: colors.secondary }]}>
                  <Text
                    style={[
                      styles.pillBadgeText,
                      { color: colors.secondaryForeground, fontFamily: fBold },
                    ]}
                  >
                    {totalDoneInView} מתוך {totalSetsInView} סטים סומנו
                  </Text>
                </View>
              </View>

              <View style={[styles.saveInputRow, isWide && styles.saveInputRowWide]}>
                <TextInput
                  value={workoutNote}
                  onChangeText={setWorkoutNote}
                  placeholder="הערה לעצמך לפעם הבאה (לא חובה – למשל: היה קל בלחיצת חזה, לעלות מדרגה במשקל)"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.noteInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.foreground,
                      fontFamily: fReg,
                    },
                  ]}
                />
                <Pressable
                  onPress={handleSaveWorkoutSession}
                  style={[styles.savePrimaryBtn, { backgroundColor: colors.primary }]}
                >
                  <Text
                    style={[
                      styles.savePrimaryBtnText,
                      { color: colors.primaryForeground, fontFamily: fBold },
                    ]}
                  >
                    💾 שמור אימון ביומן
                  </Text>
                </Pressable>
              </View>

              {saveFeedback && (
                <Text
                  style={[
                    styles.feedbackText,
                    {
                      color: saveFeedback.error ? colors.danger : colors.success,
                      fontFamily: fSemi,
                    },
                  ]}
                >
                  {saveFeedback.text}
                </Text>
              )}
            </View>
          )}

          {/* PROGRESS & ANALYTICS SECTION */}
          {currentTab === 'progress' && (
            <View style={{ gap: 16 }}>
              <View style={[styles.statsGrid, isWide && styles.statsGridWide]}>
                <View
                  style={[
                    styles.card,
                    styles.statCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.subCardText,
                      { color: colors.mutedForeground, fontFamily: fReg },
                    ]}
                  >
                    אימונים ששמרת ביומן
                  </Text>
                  <Text style={[styles.statBigNum, { color: colors.foreground, fontFamily: fBold }]}>
                    {progressStats.totalWorkouts}
                  </Text>
                </View>
                <View
                  style={[
                    styles.card,
                    styles.statCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.subCardText,
                      { color: colors.mutedForeground, fontFamily: fReg },
                    ]}
                  >
                    אימונים ב-7 הימים האחרונים
                  </Text>
                  <Text style={[styles.statBigNum, { color: colors.primary, fontFamily: fBold }]}>
                    {progressStats.weekWorkouts}
                  </Text>
                </View>
                <View
                  style={[
                    styles.card,
                    styles.statCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.subCardText,
                      { color: colors.mutedForeground, fontFamily: fReg },
                    ]}
                  >
                    סך הכל סטים שביצעת
                  </Text>
                  <Text style={[styles.statBigNum, { color: colors.foreground, fontFamily: fBold }]}>
                    {progressStats.totalSets}
                  </Text>
                </View>
              </View>

              {/* Chart Card */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fBold }]}>
                  📊 גרף התקדמות במשקלים לפי תרגיל
                </Text>
                <Text
                  style={[styles.subCardText, { color: colors.mutedForeground, fontFamily: fReg }]}
                >
                  בחר תרגיל כדי לראות איך המשקל המקסימלי שלך בו עולה מאימון לאימון:
                </Text>

                <View style={styles.filterRow}>
                  {EXERCISES.map((ex, i) => {
                    const active = chartExerciseId === ex.id;
                    return (
                      <Pressable
                        key={ex.id}
                        onPress={() => setChartExerciseId(ex.id)}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: active ? colors.primary : colors.background,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.smallBtnText,
                            {
                              color: active ? colors.primaryForeground : colors.foreground,
                              fontFamily: fMed,
                            },
                          ]}
                        >
                          {i + 1}. {ex.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <ProgressChart
                  exerciseId={chartExerciseId}
                  workoutHistory={sortedHistoryDesc}
                  colors={colors}
                  fontsLoaded={fontsLoaded}
                />
              </View>

              {/* Workout Log + Backup */}
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View
                  style={[
                    styles.rowBetween,
                    {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      paddingBottom: 12,
                    },
                  ]}
                >
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fBold }]}
                    >
                      🗓️ יומן האימונים שלך
                    </Text>
                    <Text
                      style={[
                        styles.subCardText,
                        { color: colors.mutedForeground, fontFamily: fReg },
                      ]}
                    >
                      {syncStatus.message}
                    </Text>
                  </View>
                  <View style={styles.setupActionsRow}>
                    <Pressable
                      onPress={handleExportBackup}
                      style={[styles.smallBtn, { backgroundColor: colors.secondary }]}
                    >
                      <Text
                        style={[
                          styles.smallBtnText,
                          { color: colors.secondaryForeground, fontFamily: fSemi },
                        ]}
                      >
                        ⬇️ גיבוי נתונים
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setImportModalOpen((o) => !o)}
                      style={[
                        styles.outlineBtn,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[styles.smallBtnText, { color: colors.foreground, fontFamily: fSemi }]}
                      >
                        ⬆️ שחזור מגיבוי
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {importModalOpen && (
                  <View
                    style={[
                      styles.subCard,
                      { backgroundColor: colors.background, borderColor: colors.border, gap: 8 },
                    ]}
                  >
                    <Text
                      style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}
                    >
                      הדבק תוכן קובץ גיבוי (JSON):
                    </Text>
                    <TextInput
                      value={importJsonText}
                      onChangeText={setImportJsonText}
                      multiline
                      numberOfLines={4}
                      placeholder='{"workoutHistory": [...]}'
                      placeholderTextColor={colors.mutedForeground}
                      style={[
                        styles.noteInput,
                        {
                          minHeight: 90,
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          color: colors.foreground,
                          fontFamily: fReg,
                        },
                      ]}
                    />
                    <View style={styles.setupActionsRow}>
                      <Pressable
                        onPress={handleApplyImportJson}
                        style={[styles.primarySmallBtn, { backgroundColor: colors.primary }]}
                      >
                        <Text
                          style={[
                            styles.smallBtnText,
                            { color: colors.primaryForeground, fontFamily: fBold },
                          ]}
                        >
                          טען גיבוי
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {sortedHistoryDesc.length === 0 ? (
                  <View
                    style={[
                      styles.subCard,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        padding: 24,
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <Text
                      style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}
                    >
                      עדיין לא שמרת אימונים ביומן
                    </Text>
                    <Text
                      style={[
                        styles.subCardText,
                        { color: colors.mutedForeground, fontFamily: fReg, textAlign: 'center' },
                      ]}
                    >
                      בחר אימון בלשוניות למעלה, סמן את הסטים שביצעת עם המשקל ומספר החזרות, ולחץ בתחתית העמוד על "שמור אימון ביומן".
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {sortedHistoryDesc.map((sess) => (
                      <View
                        key={sess.id}
                        style={[
                          styles.subCard,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            gap: 10,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.rowBetween,
                            {
                              borderBottomWidth: 1,
                              borderBottomColor: colors.border,
                              paddingBottom: 8,
                            },
                          ]}
                        >
                          <View style={{ gap: 2 }}>
                            <Text
                              style={[
                                styles.subCardTitle,
                                { color: colors.foreground, fontFamily: fBold },
                              ]}
                            >
                              {sess.workoutTitle}
                            </Text>
                            <Text
                              style={[
                                styles.subCardText,
                                { color: colors.mutedForeground, fontFamily: fReg },
                              ]}
                            >
                              📅 {sess.displayDate}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => handleDeleteSession(sess.id)}
                            style={[
                              styles.outlineBtn,
                              { backgroundColor: colors.card, borderColor: colors.border },
                            ]}
                          >
                            <Text
                              style={[
                                styles.smallBtnText,
                                { color: colors.danger, fontFamily: fSemi },
                              ]}
                            >
                              מחק רישום
                            </Text>
                          </Pressable>
                        </View>

                        {Boolean(sess.note) && (
                          <View
                            style={[
                              styles.subCard,
                              {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                                padding: 10,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.subCardText,
                                { color: colors.foreground, fontFamily: fReg },
                              ]}
                            >
                              📝 <Text style={{ fontFamily: fBold }}>הערה:</Text> {sess.note}
                            </Text>
                          </View>
                        )}

                        <View style={{ gap: 8 }}>
                          {(sess.items || []).map((item, idx2) => (
                            <View
                              key={`${item.exId}-${idx2}`}
                              style={[
                                styles.subCard,
                                {
                                  backgroundColor: colors.card,
                                  borderColor: colors.border,
                                  padding: 10,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.subCardText,
                                  { color: colors.foreground, fontFamily: fBold },
                                ]}
                              >
                                {item.exName}
                              </Text>
                              <View style={styles.filterRow}>
                                {(item.sets || []).map((st) => (
                                  <View
                                    key={st.setNum}
                                    style={[
                                      styles.pillBadge,
                                      { backgroundColor: colors.secondary },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.pillBadgeText,
                                        { color: colors.secondaryForeground, fontFamily: fMed },
                                      ]}
                                    >
                                      סט {st.setNum}: {st.weight} קילוגרם × {st.reps} חזרות
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* PLATE CALCULATOR SECTION */}
          {currentTab === 'calculator' && activeCalcCfg && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: fBold }]}>
                מחשבון הרכבת פלטות – מותאם בדיוק לארגז המשקולות שלך
              </Text>
              <Text
                style={[styles.subCardText, { color: colors.mutedForeground, fontFamily: fReg }]}
              >
                מה שיש לך בארגז: 4 פלטות של 5 קילוגרם, 4 פלטות של 2.5 קילוגרם, 6 פלטות של 1.25 קילוגרם, ו-6 פלטות של 0.5 קילוגרם. בחר איזה מוט אתה מרכיב ולאיזה משקל תרצה להגיע, והמחשבון יראה לך אילו פלטות לשים בכל צד.
              </Text>

              <View style={[styles.statsGrid, isWide && styles.statsGridWide]}>
                {[
                  {
                    id: 'pair',
                    title: 'שתי משקולות יד שוות',
                    sub: 'שני המוטות הקצרים | עד 20.5 קילוגרם בכל יד',
                  },
                  {
                    id: 'single',
                    title: 'משקולת יד אחת כבדה',
                    sub: 'מוט קצר אחד | עד 34.5 קילוגרם (לתרגיל חתירה)',
                  },
                  {
                    id: 'barbell',
                    title: 'המוט הארוך (152 סנטימטר)',
                    sub: 'המוט שמתחבר משני חלקים | עד 46.5 קילוגרם',
                  },
                ].map((m) => {
                  const active = calcMode === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => {
                        setCalcMode(m.id);
                        setCalcIdx(6);
                      }}
                      style={[
                        styles.subCard,
                        {
                          flex: 1,
                          backgroundColor: active ? colors.primary : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subCardTitle,
                          {
                            color: active ? colors.primaryForeground : colors.foreground,
                            fontFamily: fBold,
                          },
                        ]}
                      >
                        {m.title}
                      </Text>
                      <Text
                        style={[
                          styles.subCardText,
                          {
                            color: active ? colors.primaryForeground : colors.mutedForeground,
                            opacity: active ? 0.9 : 1,
                            fontFamily: fReg,
                          },
                        ]}
                      >
                        {m.sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View
                style={[
                  styles.subCard,
                  { backgroundColor: colors.background, borderColor: colors.border, gap: 12 },
                ]}
              >
                <View style={styles.rowBetween}>
                  <Text
                    style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fSemi }]}
                  >
                    בחר משקל רצוי (כולל משקל המוט עצמו):
                  </Text>
                  <View style={styles.stepperGroup}>
                    <Pressable
                      onPress={() => setCalcIdx((i) => Math.max(0, i - 1))}
                      style={[
                        styles.stepperBtn,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepperBtnText,
                          { color: colors.foreground, fontFamily: fBold },
                        ]}
                      >
                        −
                      </Text>
                    </Pressable>
                    <Text
                      style={[styles.calcBigWeight, { color: colors.primary, fontFamily: fBold }]}
                    >
                      {activeCalcCfg.totalWeight}{' '}
                      {calcMode === 'pair' ? 'קילוגרם בכל יד' : 'קילוגרם בסך הכל'}
                    </Text>
                    <Pressable
                      onPress={() => setCalcIdx((i) => Math.min(calcConfigs.length - 1, i + 1))}
                      style={[
                        styles.stepperBtn,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepperBtnText,
                          { color: colors.foreground, fontFamily: fBold },
                        ]}
                      >
                        +
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.filterRow}>
                  {calcConfigs.map((c, i) => {
                    const active = i === safeCalcIdx;
                    return (
                      <Pressable
                        key={c.totalWeight}
                        onPress={() => setCalcIdx(i)}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: active ? colors.primary : colors.card,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.smallBtnText,
                            {
                              color: active ? colors.primaryForeground : colors.foreground,
                              fontFamily: fMed,
                            },
                          ]}
                        >
                          {c.totalWeight}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.twoColGrid, isWide && styles.twoColGridWide]}>
                <View
                  style={[
                    styles.subCard,
                    {
                      flex: 1,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      gap: 10,
                    },
                  ]}
                >
                  <Text
                    style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}
                  >
                    אילו פלטות להשחיל בכל צד של המוט:
                  </Text>
                  {activeCalcCfg.totalPlatesSide === 0 ? (
                    <Text
                      style={[
                        styles.subCardText,
                        { color: colors.mutedForeground, fontFamily: fReg },
                      ]}
                    >
                      מוט ריק עם סוגרים בלבד (שוקל בערך {activeCalcCfg.barWeight} קילוגרם).
                    </Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {[
                        { count: activeCalcCfg.c5, label: 'פלטה של 5 קילוגרם' },
                        { count: activeCalcCfg.c25, label: 'פלטה של 2.5 קילוגרם' },
                        { count: activeCalcCfg.c125, label: 'פלטה של 1.25 קילוגרם' },
                        { count: activeCalcCfg.c05, label: 'פלטה של 0.5 קילוגרם' },
                      ]
                        .filter((p) => p.count > 0)
                        .map((p) => (
                          <View
                            key={p.label}
                            style={[
                              styles.plateRow,
                              { backgroundColor: colors.card, borderColor: colors.border },
                            ]}
                          >
                            <Text
                              style={[
                                styles.subCardText,
                                { color: colors.foreground, fontFamily: fSemi },
                              ]}
                            >
                              {p.label}
                            </Text>
                            <View style={[styles.pillBadge, { backgroundColor: colors.secondary }]}>
                              <Text
                                style={[
                                  styles.pillBadgeText,
                                  { color: colors.secondaryForeground, fontFamily: fBold },
                                ]}
                              >
                                {p.count} בכל צד של המוט
                              </Text>
                            </View>
                          </View>
                        ))}
                    </View>
                  )}

                  <Text
                    style={[
                      styles.subCardText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: fReg,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        paddingTop: 8,
                      },
                    ]}
                  >
                    {(() => {
                      const mult = calcMode === 'pair' ? 4 : 2;
                      return `כמה פלטות לקחנו בסך הכל מתוך הארגז: ${
                        activeCalcCfg.c5 * mult
                      } מתוך 4 של 5 קילוגרם • ${
                        activeCalcCfg.c25 * mult
                      } מתוך 4 של 2.5 קילוגרם • ${
                        activeCalcCfg.c125 * mult
                      } מתוך 6 של 1.25 קילוגרם • ${
                        activeCalcCfg.c05 * mult
                      } מתוך 6 של 0.5 קילוגרם.`;
                    })()}
                  </Text>
                </View>

                {/* Visual Sleeve */}
                <View
                  style={[
                    styles.subCard,
                    {
                      flex: 1,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 160,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.subCardText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: fReg,
                        marginBottom: 14,
                        textAlign: 'center',
                      },
                    ]}
                  >
                    כך נראה צד אחד של המוט (הפלטות הגדולות בפנים והקטנות בחוץ)
                  </Text>
                  <View style={styles.sleeveVisualRow}>
                    <View style={[styles.barGrip, { backgroundColor: colors.mutedForeground }]} />
                    <View style={[styles.barStopper, { backgroundColor: colors.foreground }]} />
                    <View style={styles.platesStackRow}>
                      {[
                        { count: activeCalcCfg.c5, h: 92, w: 20 },
                        { count: activeCalcCfg.c25, h: 74, w: 16 },
                        { count: activeCalcCfg.c125, h: 58, w: 13 },
                        { count: activeCalcCfg.c05, h: 44, w: 10 },
                      ].map((pl, gIdx) =>
                        Array.from({ length: pl.count }, (_, k) => (
                          <View
                            key={`${gIdx}-${k}`}
                            style={{
                              height: pl.h,
                              width: pl.w,
                              borderRadius: 4,
                              backgroundColor: colors.primary,
                              marginHorizontal: 1.5,
                            }}
                          />
                        ))
                      )}
                    </View>
                    <View
                      style={[
                        styles.spinlockCollar,
                        { backgroundColor: colors.secondary, borderColor: colors.border },
                      ]}
                    />
                    <View
                      style={[styles.barOuterEnd, { backgroundColor: colors.mutedForeground }]}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  maxWidthWrap: {
    width: '100%',
    maxWidth: 1024,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  subCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'column',
    gap: 14,
  },
  headerRowWide: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextCol: {
    flex: 1,
    gap: 8,
    alignItems: 'flex-end',
  },
  badgesWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  pillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillBadgeText: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  appTitle: {
    fontSize: 26,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  appSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  googleSyncBtn: {
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  googleSyncBtnText: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inventoryStrip: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  inventoryTitle: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inventoryChip: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timerBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  timerReadoutCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  timerLabel: {
    fontSize: 12,
  },
  timerValue: {
    fontSize: 22,
  },
  timerButtonsCol: {
    gap: 6,
  },
  timerPresetRow: {
    flexDirection: 'row-reverse',
    gap: 6,
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primarySmallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: {
    fontSize: 12,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  accordionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  accordionTitle: {
    flex: 1,
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  accordionBody: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 12,
  },
  glossaryGrid: {
    gap: 10,
  },
  glossaryGridWide: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
  },
  glossaryItemWide: {
    width: '48.8%',
  },
  twoColGrid: {
    gap: 10,
  },
  twoColGridWide: {
    flexDirection: 'row-reverse',
  },
  subCardTitle: {
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subCardText: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowBetween: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  weekRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  dayBox: {
    flexGrow: 1,
    minWidth: 62,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  dayBoxTitle: {
    fontSize: 12,
  },
  dayBoxSub: {
    fontSize: 12,
  },
  tabsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  tabBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabBtnText: {
    fontSize: 13,
    writingDirection: 'rtl',
  },
  tabCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tabCountText: {
    fontSize: 12,
  },
  setupBanner: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setupActionsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  exercisesList: {
    gap: 16,
  },
  exHeader: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  exTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexBadgeText: {
    fontSize: 14,
  },
  exTitle: {
    flex: 1,
    fontSize: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  lastLogBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  lastLogText: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  exPillsCol: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  exBodyGrid: {
    gap: 16,
  },
  exBodyGridWide: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
  },
  exAnimCol: {
    gap: 10,
  },
  exAnimColWide: {
    width: '41%',
  },
  exDetailsCol: {
    gap: 12,
  },
  exDetailsColWide: {
    flex: 1,
  },
  videosRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  videoBtn: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
  },
  stepRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepNumCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumText: {
    fontSize: 12,
  },
  stepBodyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  loggerSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 10,
  },
  loggerHeader: {
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  modeToggleWrap: {
    flexDirection: 'row-reverse',
    gap: 6,
  },
  modeToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  setCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  setCardHeaderRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  setWeightSection: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 8,
  },
  setCopyRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  copyAllSetsBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  copyAllSetsText: {
    fontSize: 11,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  supportedWeightsCaption: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chipsScrollRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    paddingVertical: 2,
  },
  weightOptionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateRecipeBar: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  plateRecipeText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  setLabel: {
    fontSize: 12,
    minWidth: 42,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stepperGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 15,
  },
  weightDisplayPill: {
    minWidth: 96,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInputSmall: {
    width: 48,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 12,
    paddingVertical: 2,
  },
  unitLabel: {
    fontSize: 12,
    marginRight: 2,
  },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    minWidth: 88,
    alignItems: 'center',
  },
  saveCardTitle: {
    fontSize: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  saveInputRow: {
    gap: 10,
  },
  saveInputRowWide: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  noteInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  savePrimaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePrimaryBtnText: {
    fontSize: 14,
  },
  feedbackText: {
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statsGrid: {
    gap: 12,
  },
  statsGridWide: {
    flexDirection: 'row-reverse',
  },
  statCard: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  statBigNum: {
    fontSize: 28,
  },
  sectionTitle: {
    fontSize: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  calcBigWeight: {
    fontSize: 18,
    paddingHorizontal: 8,
  },
  plateRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sleeveVisualRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barGrip: {
    width: 58,
    height: 14,
    opacity: 0.45,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  barStopper: {
    width: 10,
    height: 32,
    borderRadius: 2,
  },
  platesStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  spinlockCollar: {
    width: 14,
    height: 28,
    borderWidth: 1,
    borderRadius: 3,
  },
  barOuterEnd: {
    width: 44,
    height: 12,
    opacity: 0.35,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
});
