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
  Modal,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { User } from 'firebase/auth';
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
import ExerciseTrendCard, { getExerciseTrendSummary } from './src/components/ExerciseTrendCard';
import ExerciseGifIcon from './src/components/ExerciseGifIcon';
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
import type {
  ActiveDraft,
  EquipmentMode,
  Exercise,
  LoggedExerciseItem,
  LoggedSet,
  ModeOverrideEntry,
  PlateConfig,
  SetEntry,
  SyncStatus,
  WorkoutSession,
  WorkoutTabKey,
} from './src/types';

function formatTime(sec: number): string {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function isSetEntry(val: SetEntry | ModeOverrideEntry | undefined): val is SetEntry {
  return Boolean(val && 'weight' in val && 'reps' in val);
}

function isModeOverride(val: SetEntry | ModeOverrideEntry | undefined): val is ModeOverrideEntry {
  return Boolean(val && 'mode' in val);
}

const CONFIG_CACHE: Record<EquipmentMode, PlateConfig[]> = {
  pair: buildConfigsForMode('pair'),
  single: buildConfigsForMode('single'),
  barbell: buildConfigsForMode('barbell'),
  platePair: buildConfigsForMode('platePair'),
  bodyweight: buildConfigsForMode('bodyweight'),
};

export default function App(): React.ReactElement {
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
  const [currentTab, setCurrentTab] = useState<WorkoutTabKey>('workoutA');
  const [lastNonProgressTab, setLastNonProgressTab] = useState<WorkoutTabKey>('workoutA');
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState<number>(0);
  const [currentSetIdx, setCurrentSetIdx] = useState<number>(0);
  const [exerciseStepsModalOpen, setExerciseStepsModalOpen] = useState<boolean>(false);
  const [guideModalOpen, setGuideModalOpen] = useState<boolean>(false);
  const [exerciseDropdownOpen, setExerciseDropdownOpen] = useState<boolean>(false);
  const [weightsModalOpen, setWeightsModalOpen] = useState<boolean>(false);
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [muscleFilter, setMuscleFilter] = useState<string>('all');
  const [animPaused, setAnimPaused] = useState<boolean>(false);
  const exerciseScrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  // Optional per-exercise mode override (e.g. ex1 Floor Press can toggle pair <-> barbell)
  const [exModeOverrides, setExModeOverrides] = useState<Partial<Record<string, EquipmentMode>>>({});

  // Rest timer state
  const [timerSeconds, setTimerSeconds] = useState<number>(90);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerFinished, setTimerFinished] = useState<boolean>(false);

  // Progress & Firebase Cloud state
  const [activeDraft, setActiveDraft] = useState<ActiveDraft>({});
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [workoutNote, setWorkoutNote] = useState<string>('');
  const [saveFeedback, setSaveFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [chartExerciseId, setChartExerciseId] = useState<string>('ex1');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    mode: isFirebaseConfigured() ? 'connecting' : 'local',
    message: isFirebaseConfigured()
      ? 'מתחבר למסד הנתונים בענן...'
      : 'שמירה מקומית על המכשיר',
  });
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');

  const draftSyncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = 'he';
      document.documentElement.dir = 'rtl';
      document.title = 'AI Trainer';
    }
  }, []);

  // Keep html, body, #root, and iOS Safari theme-color synced with dark/light theme background
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const bg = colors.background;
      const isDark = scheme === 'dark';
      document.documentElement.style.backgroundColor = bg;
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      if (document.body) {
        document.body.style.backgroundColor = bg;
      }
      const rootEl = document.getElementById('root');
      if (rootEl) {
        rootEl.style.backgroundColor = bg;
      }
      let metaTheme = document.querySelector('meta[name="theme-color"]:not([media])');
      if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.setAttribute('name', 'theme-color');
        document.head.appendChild(metaTheme);
      }
      metaTheme.setAttribute('content', colors.card);
    }
  }, [scheme, colors.background, colors.card]);

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

  const startTimer = (sec: number) => {
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

  const getLastExerciseLog = (exId: string) => {
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

  const getEffectiveMode = (ex: Exercise): EquipmentMode => {
    const override = exModeOverrides[ex.id];
    if (override) return override;
    const draftMode = activeDraft[`__mode_${ex.id}`];
    if (isModeOverride(draftMode)) return draftMode.mode;
    return ex.equipmentMode || 'pair';
  };

  const getConfigsForExercise = (ex: Exercise): PlateConfig[] => {
    const mode = getEffectiveMode(ex);
    return CONFIG_CACHE[mode] || CONFIG_CACHE.pair;
  };

  const getSetEntry = (ex: Exercise, setNum: number): SetEntry => {
    const configs = getConfigsForExercise(ex);
    const key = `${ex.id}-${setNum}`;
    const existing = activeDraft[key];
    if (isSetEntry(existing)) {
      const snapped = snapToSupportedWeight(existing.weight, configs);
      return {
        ...existing,
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

  const persistDraft = (nextDraft: ActiveDraft) => {
    setActiveDraft(nextDraft);
    saveLocalDraft(nextDraft);
    if (firebaseUser) {
      if (draftSyncTimeout.current) clearTimeout(draftSyncTimeout.current);
      draftSyncTimeout.current = setTimeout(() => {
        syncDraftToCloud(firebaseUser.uid, nextDraft).catch(() => {});
      }, 450);
    }
  };

  const setExerciseEquipmentMode = (ex: Exercise, nextMode: EquipmentMode) => {
    setExModeOverrides((prev) => ({ ...prev, [ex.id]: nextMode }));
    const nextConfigs = CONFIG_CACHE[nextMode] || CONFIG_CACHE.pair;
    const effectiveSets = ex.sets;
    const updated: ActiveDraft = {
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
  const stepSupportedWeight = (ex: Exercise, setNum: number, direction: number) => {
    const configs = getConfigsForExercise(ex);
    const cur = getSetEntry(ex, setNum);
    let idx = configs.findIndex((c) => c.totalWeight === cur.weight);
    if (idx === -1) {
      const snapped = snapToSupportedWeight(cur.weight, configs);
      idx = Math.max(
        0,
        configs.findIndex((c) => c.totalWeight === snapped)
      );
    }
    const nextIdx = Math.max(0, Math.min(configs.length - 1, idx + direction));
    const key = `${ex.id}-${setNum}`;
    persistDraft({
      ...activeDraft,
      [key]: { ...cur, weight: configs[nextIdx].totalWeight },
    });
  };

  const selectWeightForSet = (ex: Exercise, setNum: number, exactWeight: number) => {
    const cur = getSetEntry(ex, setNum);
    const key = `${ex.id}-${setNum}`;
    persistDraft({
      ...activeDraft,
      [key]: { ...cur, weight: exactWeight },
    });
  };

  // Apply chosen supported weight to all uncompleted sets of this exercise (or all sets if all done)
  const selectWeightForExercise = (ex: Exercise, exactWeight: number) => {
    const effectiveSets = ex.sets;
    const updated: ActiveDraft = { ...activeDraft };
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

  const stepReps = (ex: Exercise, setNum: number, delta: number) => {
    const key = `${ex.id}-${setNum}`;
    const cur = getSetEntry(ex, setNum);
    const nextVal = Math.max(1, Math.round((Number(cur.reps) || 1) + delta));
    persistDraft({
      ...activeDraft,
      [key]: { ...cur, reps: nextVal },
    });
  };

  const updateRepsText = (ex: Exercise, setNum: number, raw: string) => {
    const key = `${ex.id}-${setNum}`;
    const cur = getSetEntry(ex, setNum);
    const parsed = parseInt(raw, 10);
    const nextVal = Number.isNaN(parsed) || parsed < 1 ? 1 : Math.min(200, parsed);
    persistDraft({
      ...activeDraft,
      [key]: { ...cur, reps: nextVal },
    });
  };

  const toggleSetDone = (ex: Exercise, setNum: number) => {
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
    const cleaned: ActiveDraft = {};
    Object.keys(activeDraft).forEach((k) => {
      const entry = activeDraft[k];
      if (k.startsWith('__mode_')) {
        cleaned[k] = entry;
      } else if (isSetEntry(entry)) {
        cleaned[k] = { ...entry, done: false };
      }
    });
    persistDraft(cleaned);
  };

  const visibleExercises = useMemo(() => {
    if (currentTab === 'workoutA') {
      return EXERCISES.filter((e) => e.workouts.includes('workoutA')).sort(
        (a, b) => (a.orderA ?? 999) - (b.orderA ?? 999)
      );
    }
    if (currentTab === 'workoutB') {
      return EXERCISES.filter((e) => e.workouts.includes('workoutB')).sort(
        (a, b) => (a.orderB ?? 999) - (b.orderB ?? 999)
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
      const effectiveSets = ex.sets;
      totalCount += effectiveSets;
      for (let s = 1; s <= effectiveSets; s++) {
        if (getSetEntry(ex, s).done) doneCount++;
      }
    });
    return { totalDoneInView: doneCount, totalSetsInView: totalCount };
  }, [visibleExercises, activeDraft, exModeOverrides, currentTab, sortedHistoryDesc]);

  const handleSaveWorkoutSession = async () => {
    const items: LoggedExerciseItem[] = [];
    let sessionTotalSets = 0;

    visibleExercises.forEach((ex) => {
      const effectiveSets = ex.sets;
      const doneSets: LoggedSet[] = [];
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

    const allowedTabs: WorkoutTabKey[] = ['workoutA', 'workoutB', 'all'];
    const workoutTab = allowedTabs.includes(currentTab) ? currentTab : 'workoutA';

    const sessionDoc: WorkoutSession = {
      id: `sess_${nowMs}`,
      isoDate: now.toISOString(),
      createdAtMs: nowMs,
      displayDate,
      workoutTab,
      workoutTitle: WORKOUT_NAMES_MAP[workoutTab] || 'אימון כוח',
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
      } catch {
        // Local copy already saved
      }
    }

    clearSetCheckmarks();
    setWorkoutNote('');
    setSaveFeedback(null);
    setSaveModalOpen(false);
    setCurrentTab('progress');
  };

  const handleDeleteSession = async (sessionId: string) => {
    const nextHistory = sortedHistoryDesc.filter((s) => s.id !== sessionId);
    setWorkoutHistory(nextHistory);
    await saveLocalHistory(nextHistory);
    if (firebaseUser) {
      try {
        await deleteWorkoutFromCloud(firebaseUser.uid, sessionId);
      } catch {
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
      a.download = 'ai-trainer-progress-backup.json';
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
      const parsed = JSON.parse(importJsonText) as {
        workoutHistory?: Partial<WorkoutSession>[];
        activeDraft?: ActiveDraft;
      };
      if (Array.isArray(parsed.workoutHistory)) {
        const normalized: WorkoutSession[] = parsed.workoutHistory
          .map((s, idx) => {
            const ts =
              s.createdAtMs ||
              new Date(s.isoDate || Date.now()).getTime() ||
              Date.now() - idx * 1000;
            const setsSum = (s.items || []).reduce(
              (acc, it) => acc + ((it.sets || []).length || 0),
              0
            );
            const rawTab = s.workoutTab || 'imported';
            return {
              id: String(s.id || `sess_${ts}`).slice(0, 80),
              isoDate: String(s.isoDate || new Date(ts).toISOString()),
              createdAtMs: ts,
              displayDate: String(
                s.displayDate || new Date(ts).toLocaleDateString('he-IL')
              ).slice(0, 120),
              workoutTab: ['workoutA', 'workoutB', 'express', 'all', 'imported'].includes(rawTab)
                ? rawTab
                : 'imported',
              workoutTitle: String(s.workoutTitle || 'אימון מיובא').slice(0, 150),
              note: String(s.note || '').slice(0, 500),
              totalSets: Math.max(1, Math.min(150, setsSum || 1)),
              items: Array.isArray(s.items) ? s.items.slice(0, 30) : [],
            };
          })
          .filter((s) => (s.items || []).length > 0);

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
    } catch {
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
    } catch {
      // User closed popup
    }
  };

  const progressStats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let weekCount = 0;
    let setsSum = 0;
    sortedHistoryDesc.forEach((s) => {
      const t = s.createdAtMs || (s.isoDate ? new Date(s.isoDate).getTime() : 0);
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

  const fReg = fontForWeight('regular', fontsLoaded);
  const fMed = fontForWeight('medium', fontsLoaded);
  const fSemi = fontForWeight('semibold', fontsLoaded);
  const fBold = fontForWeight('bold', fontsLoaded);

  const navTabs: { key: WorkoutTabKey; label: string; mobileLabel: string }[] = [
    { key: 'workoutA', label: 'אימון A: חזה, גב וזרועות', mobileLabel: 'אימון A' },
    { key: 'workoutB', label: 'אימון B: כתפיים, גב וזרועות', mobileLabel: 'אימון B' },
    { key: 'all', label: 'כל התרגילים', mobileLabel: 'כל התרגילים' },
  ];

  const selectMainTab = (nextTab: WorkoutTabKey) => {
    setSaveFeedback(null);
    setExerciseDropdownOpen(false);
    setWeightsModalOpen(false);
    setExerciseStepsModalOpen(false);
    if (nextTab !== 'progress') {
      setLastNonProgressTab(nextTab);
    }
    setCurrentTab(nextTab);
    setCurrentExerciseIdx(0);
    setCurrentSetIdx(0);
    if (
      exerciseScrollRef.current &&
      typeof exerciseScrollRef.current.scrollTo === 'function'
    ) {
      exerciseScrollRef.current.scrollTo({ y: 0, animated: false });
    }
  };

  const isWorkoutTab = currentTab !== 'progress';
  const safeExIdx =
    visibleExercises.length > 0 ? Math.min(currentExerciseIdx, visibleExercises.length - 1) : 0;
  const activeEx = isWorkoutTab ? visibleExercises[safeExIdx] || null : null;
  const activeEffectiveSets = activeEx ? activeEx.sets : 0;
  const safeSetIdx =
    activeEffectiveSets > 0 ? Math.max(0, Math.min(activeEffectiveSets - 1, currentSetIdx)) : 0;
  const activeSetNum = safeSetIdx + 1;

  const goToExercise = (nextIdx: number, setIdxOverride = 0) => {
    if (visibleExercises.length === 0) return;
    const clamped = Math.max(0, Math.min(visibleExercises.length - 1, nextIdx));
    const targetEx = visibleExercises[clamped];
    const targetSets = targetEx.sets;
    const clampedSet = Math.max(0, Math.min(targetSets - 1, setIdxOverride));
    setWeightsModalOpen(false);
    setExerciseStepsModalOpen(false);
    setCurrentExerciseIdx(clamped);
    setCurrentSetIdx(clampedSet);
  };

  const goPrevStep = () => {
    if (safeSetIdx > 0) {
      setCurrentSetIdx(safeSetIdx - 1);
    } else if (safeExIdx > 0) {
      const prevEx = visibleExercises[safeExIdx - 1];
      const prevSets = prevEx.sets;
      goToExercise(safeExIdx - 1, prevSets - 1);
    }
  };

  const goNextStep = () => {
    if (safeSetIdx < activeEffectiveSets - 1) {
      setCurrentSetIdx(safeSetIdx + 1);
    } else if (safeExIdx < visibleExercises.length - 1) {
      goToExercise(safeExIdx + 1, 0);
    } else {
      setSaveFeedback(null);
      setSaveModalOpen(true);
    }
  };

  const isAtVeryStart = safeExIdx === 0 && safeSetIdx === 0;
  const isAtVeryEnd =
    visibleExercises.length > 0 &&
    safeExIdx === visibleExercises.length - 1 &&
    safeSetIdx === activeEffectiveSets - 1;
  const prevBtnLabel = safeSetIdx > 0 ? '→ סט קודם' : '→ תרגיל קודם';
  const nextBtnLabel = isAtVeryEnd
    ? '🏁 סיום ושמירה'
    : safeSetIdx < activeEffectiveSets - 1
    ? 'סט הבא ←'
    : 'תרגיל הבא ←';

  const currentSetupMessage =
    currentTab === 'workoutA' || currentTab === 'workoutB'
      ? SETUP_MESSAGES[currentTab]
      : undefined;

  // Helper returning completion ratio for an exercise dot/pill
  const getExerciseDoneStats = (ex: Exercise) => {
    const effectiveSets = ex.sets;
    let doneCount = 0;
    let bestWeightToday = 0;
    for (let s = 1; s <= effectiveSets; s++) {
      const entry = getSetEntry(ex, s);
      if (entry.done) doneCount++;
      if (s === 1 || entry.weight > bestWeightToday) bestWeightToday = entry.weight;
    }
    return {
      doneCount,
      effectiveSets,
      allDone: effectiveSets > 0 && doneCount === effectiveSets,
      bestWeightToday,
    };
  };

  return (
    <SafeAreaView
      style={[
        styles.safeRoot,
        Platform.OS === 'web' ? styles.webFullscreenRoot : null,
        { backgroundColor: colors.background },
      ]}
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      {/* PINNED COMPACT TOP BAR (Header, Tabs, Exercise Stepper) */}
      <View
        style={[
          styles.topShell,
          !isWide && styles.topShellMobile,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        {/* Row 1: Compact Title + Sync + Utility Buttons */}
        <View style={[styles.topRow1, !isWide && styles.topRow1Mobile]}>
          <View style={[styles.topBrandTitleRow, !isWide && styles.topBrandTitleRowMobile]}>
            <View style={styles.topBrandLeftGroup}>
              <Text
                numberOfLines={1}
                style={[styles.compactTitle, { color: colors.foreground, fontFamily: fBold }]}
              >
                🤖 AI Trainer
              </Text>
              {isWide && (
                <View style={[styles.compactSyncBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.compactSyncText, { color: colors.primary, fontFamily: fSemi }]}>
                    מאמן כוח חכם
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.compactSyncBadge,
                  {
                    backgroundColor:
                      syncStatus.mode === 'cloud' ? colors.successSoft : colors.secondary,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.compactSyncText,
                    {
                      color:
                        syncStatus.mode === 'cloud' ? colors.success : colors.mutedForeground,
                      fontFamily: fSemi,
                    },
                  ]}
                >
                  {isWide
                    ? `☁️ ${syncStatus.message}`
                    : syncStatus.mode === 'cloud'
                    ? '☁️ מסונכרן'
                    : syncStatus.mode === 'connecting'
                    ? '☁️ מתחבר...'
                    : '📱 מקומי'}
                </Text>
              </View>
            </View>

            {!isWide &&
              Platform.OS === 'web' &&
              isFirebaseConfigured() &&
              (!firebaseUser || firebaseUser.isAnonymous) && (
                <Pressable
                  onPress={handleGoogleSignIn}
                  style={[
                    styles.utilityBtnCompact,
                    { backgroundColor: colors.background, borderColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.utilityBtnText,
                      { color: colors.primary, fontFamily: fSemi },
                    ]}
                  >
                    🔗 Google
                  </Text>
                </Pressable>
              )}
          </View>

          <View style={[styles.topUtilityRow, !isWide && styles.topUtilityRowMobile]}>
            {/* Dedicated Show My Progress button */}
            <Pressable
              onPress={() =>
                selectMainTab(currentTab === 'progress' ? lastNonProgressTab : 'progress')
              }
              style={[
                isWide ? styles.dedicatedActionBtn : styles.dedicatedActionBtnMobile,
                {
                  backgroundColor:
                    currentTab === 'progress' ? colors.primary : colors.primarySoft,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.dedicatedActionText,
                  {
                    color:
                      currentTab === 'progress' ? colors.primaryForeground : colors.primary,
                    fontFamily: fBold,
                  },
                ]}
              >
                {isWide
                  ? `📈 ההתקדמות שלי (${sortedHistoryDesc.length})`
                  : `📈 ההתקדמות שלי (${sortedHistoryDesc.length})`}
              </Text>
            </Pressable>

            {/* Dedicated Guide & Equipment button */}
            <Pressable
              onPress={() => setGuideModalOpen(true)}
              style={[
                isWide ? styles.dedicatedActionBtn : styles.dedicatedActionBtnMobile,
                {
                  backgroundColor: guideModalOpen ? colors.primary : colors.secondary,
                  borderColor: guideModalOpen ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.dedicatedActionText,
                  {
                    color: guideModalOpen
                      ? colors.primaryForeground
                      : colors.secondaryForeground,
                    fontFamily: fBold,
                  },
                ]}
              >
                📖 מדריך וציוד
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setAnimPaused((p) => !p)}
              style={[
                isWide ? styles.utilityBtn : styles.utilityBtnCompact,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.utilityBtnText, { color: colors.foreground, fontFamily: fMed }]}
              >
                {isWide ? (animPaused ? '▶ אנימציה' : '⏸ אנימציה') : animPaused ? '▶' : '⏸'}
              </Text>
            </Pressable>

            {isWide &&
              Platform.OS === 'web' &&
              isFirebaseConfigured() &&
              (!firebaseUser || firebaseUser.isAnonymous) && (
                <Pressable
                  onPress={handleGoogleSignIn}
                  style={[
                    styles.utilityBtn,
                    { backgroundColor: colors.background, borderColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.utilityBtnText,
                      { color: colors.primary, fontFamily: fSemi },
                    ]}
                  >
                    🔗 Google
                  </Text>
                </Pressable>
              )}
          </View>
        </View>

        {/* Row 2: Main Navigation Tabs */}
        {isWide ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topTabsScroll}
          >
            {navTabs.map((t) => {
              const active = currentTab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => selectMainTab(t.key)}
                  style={[
                    styles.tabBtnCompact,
                    {
                      backgroundColor: active ? colors.primary : colors.background,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBtnCompactText,
                      {
                        color: active ? colors.primaryForeground : colors.foreground,
                        fontFamily: fSemi,
                      },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.mobileNavTabsRow}>
            {navTabs.map((t) => {
              const active = currentTab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => selectMainTab(t.key)}
                  style={[
                    styles.mobileTabBtnCompact,
                    {
                      backgroundColor: active ? colors.primary : colors.background,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.mobileTabBtnCompactText,
                      {
                        color: active ? colors.primaryForeground : colors.foreground,
                        fontFamily: fSemi,
                      },
                    ]}
                  >
                    {t.mobileLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Row 3 (Muscle filter if 'all' + Exercise Dropdown Switcher on wide screens) */}
        {currentTab === 'all' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topTabsScroll}
          >
            {MUSCLE_FILTERS.map((mf) => {
              const active = muscleFilter === mf;
              const lbl = mf === 'all' ? 'כל התרגילים (10)' : mf;
              return (
                <Pressable
                  key={mf}
                  onPress={() => {
                    setMuscleFilter(mf);
                    setCurrentExerciseIdx(0);
                  }}
                  style={[
                    styles.filterChipCompact,
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
                        fontFamily: fSemi,
                      },
                    ]}
                  >
                    {lbl}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {isWide && isWorkoutTab && visibleExercises.length > 0 && activeEx && (() => {
          const { doneCount, effectiveSets, allDone } = getExerciseDoneStats(activeEx);
          return (
            <View style={styles.dropdownRowWrap}>
              <Pressable
                disabled={safeExIdx <= 0}
                onPress={() => goToExercise(safeExIdx - 1, 0)}
                style={[
                  styles.dropdownStepArrowBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity: safeExIdx <= 0 ? 0.35 : 1,
                  },
                ]}
              >
                <Text style={[styles.smallBtnText, { color: colors.foreground, fontFamily: fBold }]}>
                  →
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setExerciseDropdownOpen(true)}
                style={[
                  styles.exerciseDropdownBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: exerciseDropdownOpen ? colors.primary : colors.border,
                  },
                ]}
              >
                <View style={styles.exerciseDropdownRight}>
                  <ExerciseGifIcon
                    exerciseId={activeEx.id}
                    size={34}
                    active
                    borderColor={colors.border}
                    activeBorderColor="#a3e635"
                  />
                  <View
                    style={[
                      styles.dropdownCountBadge,
                      { backgroundColor: allDone ? colors.success : colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownCountText,
                        { color: colors.primaryForeground, fontFamily: fBold },
                      ]}
                    >
                      {safeExIdx + 1}/{visibleExercises.length}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.exerciseDropdownTitle,
                      { color: colors.foreground, fontFamily: fBold },
                    ]}
                  >
                    {activeEx.name}
                  </Text>
                </View>

                <View style={styles.exerciseDropdownLeft}>
                  <View
                    style={[
                      styles.dropdownSetsPill,
                      {
                        backgroundColor: allDone ? colors.successSoft : colors.secondary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownSetsText,
                        {
                          color: allDone ? colors.success : colors.secondaryForeground,
                          fontFamily: fSemi,
                        },
                      ]}
                    >
                      {doneCount}/{effectiveSets} {allDone ? '✓' : 'סטים'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.dropdownChevron,
                      { color: colors.primary, fontFamily: fBold },
                    ]}
                  >
                    החלף תרגיל ▾
                  </Text>
                </View>
              </Pressable>

              <Pressable
                disabled={safeExIdx >= visibleExercises.length - 1}
                onPress={() => goToExercise(safeExIdx + 1, 0)}
                style={[
                  styles.dropdownStepArrowBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    opacity: safeExIdx >= visibleExercises.length - 1 ? 0.35 : 1,
                  },
                ]}
              >
                <Text style={[styles.smallBtnText, { color: colors.foreground, fontFamily: fBold }]}>
                  ←
                </Text>
              </Pressable>
            </View>
          );
        })()}
      </View>

      {/* NON-SCROLLING FULLSCREEN WORKOUT STAGE (1 exercise & 1 set at a time, capped at page height) */}
      {isWorkoutTab && (
        <View
          style={[
            styles.fullscreenWorkoutStage,
            !isWide && styles.fullscreenWorkoutStageMobile,
          ]}
        >
          {activeEx ? (
            (() => {
              const ex = activeEx;
              const idx = safeExIdx;
              const effectiveSets = activeEffectiveSets;
              const setNum = activeSetNum;
              const effectiveMode = getEffectiveMode(ex);
              const exConfigs = getConfigsForExercise(ex);
              const { bestWeightToday } = getExerciseDoneStats(ex);
              const entry = getSetEntry(ex, setNum);
              const setCfg =
                exConfigs.find((c) => c.totalWeight === entry.weight) || exConfigs[0];
              const curCfgIdx = exConfigs.findIndex((c) => c.totalWeight === entry.weight);
              const atMin = curCfgIdx <= 0;
              const atMax = curCfgIdx >= exConfigs.length - 1;

              const renderSingleSetWorkspace = () => (
                <View
                  style={[
                    styles.singleSetWorkspace,
                    !isWide && styles.singleSetWorkspaceMobile,
                  ]}
                >
                  {/* Set Switcher Pills + Optional Barbell Toggle */}
                  <View style={styles.setSwitcherBar}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.setPillsRow}
                    >
                      {Array.from({ length: effectiveSets }, (_, i) => i + 1).map((sIdxNum) => {
                        const sEntry = getSetEntry(ex, sIdxNum);
                        const isActiveSet = sIdxNum === setNum;
                        return (
                          <Pressable
                            key={sIdxNum}
                            onPress={() => setCurrentSetIdx(sIdxNum - 1)}
                            style={[
                              styles.setSelectorPill,
                              {
                                backgroundColor: isActiveSet
                                  ? colors.primary
                                  : sEntry.done
                                  ? colors.successSoft
                                  : colors.background,
                                borderColor: isActiveSet
                                  ? colors.primary
                                  : sEntry.done
                                  ? colors.success
                                  : colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.setSelectorPillText,
                                {
                                  color: isActiveSet
                                    ? colors.primaryForeground
                                    : sEntry.done
                                    ? colors.success
                                    : colors.foreground,
                                  fontFamily: fBold,
                                },
                              ]}
                            >
                              {sEntry.done ? `סט ${sIdxNum} ✓` : `סט ${sIdxNum}`}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    {ex.allowBarbellToggle && (
                      <View style={styles.modeToggleWrap}>
                        {(
                          [
                            { id: 'pair', label: '2 משקולות יד' },
                            { id: 'barbell', label: 'מוט ארוך' },
                          ] as { id: EquipmentMode; label: string }[]
                        ).map((opt) => {
                          const active = effectiveMode === opt.id;
                          return (
                            <Pressable
                              key={opt.id}
                              onPress={() => setExerciseEquipmentMode(ex, opt.id)}
                              style={[
                                styles.modeToggleBtnCompact,
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

                  {/* Active Set Controls Card (Separated Weight & Reps Sub-Cards + Quick Strip + Mark Done CTA) */}
                  <View
                    style={[
                      styles.activeSetControlBox,
                      !isWide && styles.activeSetControlBoxMobile,
                      {
                        backgroundColor: colors.background,
                        borderColor: entry.done ? colors.success : colors.border,
                      },
                    ]}
                  >
                    {/* Row 1: Two Distinct Sub-Cards for Weight and Reps */}
                    <View style={styles.controlsSplitRow}>
                      {/* Weight Sub-Card */}
                      <View
                        style={[
                          styles.metricSubCard,
                          styles.weightMetricSubCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: exConfigs.length > 1 ? colors.primarySoft : colors.border,
                          },
                        ]}
                      >
                        <View style={styles.metricSubHeader}>
                          <Text
                            style={[
                              styles.metricSubLabel,
                              { color: colors.mutedForeground, fontFamily: fSemi },
                            ]}
                          >
                            🏋️ משקל
                          </Text>
                          {effectiveSets > 1 && exConfigs.length > 1 && (
                            <Pressable
                              onPress={() => selectWeightForExercise(ex, entry.weight)}
                              style={[
                                styles.applyAllInlinePill,
                                {
                                  backgroundColor: colors.primarySoft,
                                  borderColor: colors.primary,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.applyAllInlineText,
                                  { color: colors.primary, fontFamily: fBold },
                                ]}
                              >
                                לכל הסטים ↻
                              </Text>
                            </Pressable>
                          )}
                        </View>

                        <View style={styles.metricStepperRow}>
                          <Pressable
                            disabled={atMin}
                            onPress={() => stepSupportedWeight(ex, setNum, -1)}
                            style={[
                              styles.metricStepperBtn,
                              {
                                backgroundColor: colors.background,
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

                          <View style={styles.metricValueCenter}>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.metricValueBig,
                                { color: colors.foreground, fontFamily: fBold },
                              ]}
                            >
                              {entry.weight === 0 ? 'גוף' : `${entry.weight}`}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.metricValueUnit,
                                { color: colors.mutedForeground, fontFamily: fMed },
                              ]}
                            >
                              {entry.weight === 0 ? 'ללא משקולת' : 'קילוגרם'}
                            </Text>
                          </View>

                          <Pressable
                            disabled={atMax}
                            onPress={() => stepSupportedWeight(ex, setNum, 1)}
                            style={[
                              styles.metricStepperBtn,
                              {
                                backgroundColor: colors.background,
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
                      </View>

                      {/* Reps Sub-Card */}
                      <View
                        style={[
                          styles.metricSubCard,
                          styles.repsMetricSubCard,
                          { backgroundColor: colors.card, borderColor: colors.border },
                        ]}
                      >
                        <View style={[styles.metricSubHeader, { justifyContent: 'center' }]}>
                          <Text
                            style={[
                              styles.metricSubLabel,
                              { color: colors.mutedForeground, fontFamily: fSemi },
                            ]}
                          >
                            🔁 חזרות
                          </Text>
                        </View>

                        <View style={styles.metricStepperRow}>
                          <Pressable
                            onPress={() => stepReps(ex, setNum, -1)}
                            style={[
                              styles.metricStepperBtn,
                              { backgroundColor: colors.background, borderColor: colors.border },
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
                              styles.metricRepsInput,
                              {
                                backgroundColor: colors.background,
                                borderColor: colors.border,
                                color: colors.foreground,
                                fontFamily: fBold,
                              },
                            ]}
                          />

                          <Pressable
                            onPress={() => stepReps(ex, setNum, 1)}
                            style={[
                              styles.metricStepperBtn,
                              { backgroundColor: colors.background, borderColor: colors.border },
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
                    </View>

                    {/* Row 2: Closest Supported Kilograms Quick Strip + More Weights Modal */}
                    {exConfigs.length > 1 &&
                      (() => {
                        const anchorIdx =
                          curCfgIdx >= 0
                            ? curCfgIdx
                            : Math.max(
                                0,
                                exConfigs.findIndex((c) => c.totalWeight >= entry.weight)
                              );
                        const maxQuickWeights = 4;
                        const hasMoreWeights = exConfigs.length > maxQuickWeights;
                        const windowStart = Math.max(
                          0,
                          Math.min(exConfigs.length - maxQuickWeights, anchorIdx - 1)
                        );
                        const visibleConfigs = hasMoreWeights
                          ? exConfigs.slice(windowStart, windowStart + maxQuickWeights)
                          : exConfigs;

                        return (
                          <View style={styles.quickWeightsStrip}>
                            {visibleConfigs.map((cfg) => {
                              const selected = cfg.totalWeight === entry.weight;
                              return (
                                <Pressable
                                  key={cfg.totalWeight}
                                  onPress={() => selectWeightForSet(ex, setNum, cfg.totalWeight)}
                                  style={[
                                    styles.weightOptionChipSegmented,
                                    {
                                      backgroundColor: selected ? colors.primary : colors.card,
                                      borderColor: selected ? colors.primary : colors.border,
                                    },
                                  ]}
                                >
                                  <Text
                                    numberOfLines={1}
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
                                    {cfg.totalWeight === 0 ? '0' : `${cfg.totalWeight}`}
                                  </Text>
                                </Pressable>
                              );
                            })}
                            {hasMoreWeights && (
                              <Pressable
                                onPress={() => setWeightsModalOpen(true)}
                                style={[
                                  styles.moreWeightsChipSegmented,
                                  {
                                    backgroundColor: colors.primarySoft,
                                    borderColor: colors.primary,
                                  },
                                ]}
                              >
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.smallBtnText,
                                    { color: colors.primary, fontFamily: fBold },
                                  ]}
                                >
                                  עוד ({exConfigs.length}) ▾
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })()}

                    {/* Row 3: Full-Width Set Completion CTA */}
                    <Pressable
                      onPress={() => toggleSetDone(ex, setNum)}
                      style={[
                        styles.doneBtnFull,
                        {
                          backgroundColor: entry.done ? colors.successSoft : colors.primary,
                          borderColor: entry.done ? colors.success : colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.doneBtnFullText,
                          {
                            color: entry.done ? colors.success : colors.primaryForeground,
                            fontFamily: fBold,
                          },
                        ]}
                      >
                        {entry.done ? `✓ סט ${setNum} בוצע (לחץ לביטול)` : `סמן סט ${setNum} כבוצע ✓`}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Live Movement Animation + Weight Assembly Together */}
                  {isWide ? (
                    <EquipmentBuildDiagram
                      compact
                      cfg={setCfg}
                      mode={effectiveMode}
                      paused={animPaused}
                      colors={colors}
                      fontsLoaded={fontsLoaded}
                    />
                  ) : (
                    <View style={[styles.dualVisualRow, styles.dualVisualRowMobile]}>
                      <ExerciseAnimation
                        compact
                        micro
                        exercise={ex}
                        paused={animPaused}
                        colors={colors}
                        fontsLoaded={fontsLoaded}
                      />
                      <EquipmentBuildDiagram
                        compact
                        micro
                        cfg={setCfg}
                        mode={effectiveMode}
                        paused={animPaused}
                        colors={colors}
                        fontsLoaded={fontsLoaded}
                      />
                    </View>
                  )}

                  {!isWide && (
                    <View style={styles.infoQuickStrip}>
                      <Pressable
                        onPress={() => setExerciseStepsModalOpen(true)}
                        style={[
                          styles.stepsModalTriggerBtn,
                          { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.smallBtnText,
                            { color: colors.primary, fontFamily: fBold },
                          ]}
                        >
                          📋 שלבים וטיפים ({ex.steps.length})
                        </Text>
                      </Pressable>

                      {ex.videos.map((v, vIdx) => (
                        <Pressable
                          key={v.url}
                          onPress={() => Linking.openURL(v.url)}
                          style={[
                            styles.videoQuickChip,
                            { backgroundColor: colors.secondary, borderColor: colors.border },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.smallBtnText,
                              { color: colors.secondaryForeground, fontFamily: fSemi },
                            ]}
                          >
                            🎬 {ex.videos.length > 1 ? `סרטון ${vIdx + 1}` : 'סרטון הדגמה'} ↗
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              );

              const renderExerciseGuidancePane = () => (
                <View style={styles.guidancePane}>
                  <View style={styles.guidanceContentCol}>
                    <ExerciseAnimation
                      compact
                      exercise={ex}
                      paused={animPaused}
                      colors={colors}
                      fontsLoaded={fontsLoaded}
                    />
                    <View style={styles.videosRow}>
                      <Pressable
                        onPress={() => setExerciseStepsModalOpen(true)}
                        style={[
                          styles.videoBtnCompact,
                          { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[styles.smallBtnText, { color: colors.primary, fontFamily: fBold }]}
                        >
                          📋 שלבי ביצוע וטיפים ({ex.steps.length})
                        </Text>
                      </Pressable>
                      {ex.videos.map((v) => (
                        <Pressable
                          key={v.url}
                          onPress={() => Linking.openURL(v.url)}
                          style={[
                            styles.videoBtnCompact,
                            { backgroundColor: colors.secondary, borderColor: colors.border },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
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
                </View>
              );

              const { doneCount: exDoneCount, allDone: exAllDone } = getExerciseDoneStats(ex);
              const shortEquipLabel =
                effectiveMode === 'pair'
                  ? '2 משקולות'
                  : effectiveMode === 'single'
                  ? 'משקולת 1'
                  : effectiveMode === 'barbell'
                  ? 'מוט ארוך'
                  : effectiveMode === 'platePair'
                  ? '2 פלטות'
                  : 'משקל גוף';
              const repMatch = ex.reps.match(/\d+\s*(?:עד|-)\s*\d+/);
              const shortRepsLabel = repMatch
                ? `${repMatch[0].replace(/\s*עד\s*/, '–')} חזרות`
                : `${ex.defaultReps} חזרות`;
              const conciseMetaText = `${ex.muscle} • ${effectiveSets} סטים • ${shortRepsLabel} • ${shortEquipLabel}`;

              return (
                <View
                  key={ex.id}
                  style={[
                    styles.fullscreenExCard,
                    !isWide && styles.fullscreenExCardMobile,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  {/* Exercise Header: Wide standard OR unified mobile switcher + rest tag */}
                  {isWide ? (
                    <View style={[styles.exHeaderCompact, { borderBottomColor: colors.border }]}>
                      <View style={styles.exHeaderTitleGroup}>
                        <ExerciseGifIcon
                          exerciseId={ex.id}
                          size={46}
                          active
                          borderColor={colors.border}
                          activeBorderColor="#a3e635"
                        />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text
                            numberOfLines={1}
                            style={[styles.exTitleCompact, { color: colors.foreground, fontFamily: fBold }]}
                          >
                            {idx + 1}. {ex.name}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.exMetaCompact,
                              { color: colors.mutedForeground, fontFamily: fReg },
                            ]}
                          >
                            {conciseMetaText}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.headerBadgesCol}>
                        <View style={[styles.pillBadge, { backgroundColor: colors.primarySoft }]}>
                          <Text style={[styles.pillBadgeText, { color: colors.primary, fontFamily: fBold }]}>
                            סט {setNum} מתוך {effectiveSets}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => startTimer(ex.restSec)}
                          style={[
                            styles.restTagBadge,
                            {
                              backgroundColor: scheme === 'dark' ? '#422006' : '#fef3c7',
                              borderColor: scheme === 'dark' ? '#f59e0b' : '#d97706',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.restTagText,
                              { color: scheme === 'dark' ? '#fbbf24' : '#b45309', fontFamily: fBold },
                            ]}
                          >
                            ⏳ מנוחה: {ex.restSec} שניות
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.exHeaderMobileWrap, { borderBottomColor: colors.border }]}>
                      <View style={styles.mobileCardSwitcherRow}>
                        <Pressable
                          disabled={safeExIdx <= 0}
                          onPress={() => goToExercise(safeExIdx - 1, 0)}
                          style={[
                            styles.mobileCardArrowBtn,
                            {
                              backgroundColor: colors.background,
                              borderColor: colors.border,
                              opacity: safeExIdx <= 0 ? 0.35 : 1,
                            },
                          ]}
                        >
                          <Text style={[styles.smallBtnText, { color: colors.foreground, fontFamily: fBold }]}>
                            →
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setExerciseDropdownOpen(true)}
                          style={[
                            styles.mobileCardDropdownPill,
                            {
                              backgroundColor: colors.background,
                              borderColor: exerciseDropdownOpen ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <ExerciseGifIcon
                            exerciseId={ex.id}
                            size={34}
                            active
                            borderColor={colors.border}
                            activeBorderColor="#a3e635"
                          />
                          <View
                            style={[
                              styles.dropdownCountBadge,
                              { backgroundColor: exAllDone ? colors.success : colors.primary },
                            ]}
                          >
                            <Text
                              style={[
                                styles.dropdownCountText,
                                { color: colors.primaryForeground, fontFamily: fBold },
                              ]}
                            >
                              {safeExIdx + 1}/{visibleExercises.length}
                            </Text>
                          </View>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.mobileCardDropdownTitle,
                              { color: colors.foreground, fontFamily: fBold },
                            ]}
                          >
                            {ex.shortName}
                          </Text>
                          <Text
                            style={[
                              styles.mobileCardDropdownArrow,
                              { color: colors.primary, fontFamily: fBold },
                            ]}
                          >
                            {exDoneCount}/{effectiveSets} ▾
                          </Text>
                        </Pressable>

                        <Pressable
                          disabled={safeExIdx >= visibleExercises.length - 1}
                          onPress={() => goToExercise(safeExIdx + 1, 0)}
                          style={[
                            styles.mobileCardArrowBtn,
                            {
                              backgroundColor: colors.background,
                              borderColor: colors.border,
                              opacity: safeExIdx >= visibleExercises.length - 1 ? 0.35 : 1,
                            },
                          ]}
                        >
                          <Text style={[styles.smallBtnText, { color: colors.foreground, fontFamily: fBold }]}>
                            ←
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.mobileCardMetaRow}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.exMetaMobileCompact,
                            { color: colors.mutedForeground, fontFamily: fReg },
                          ]}
                        >
                          {conciseMetaText}
                        </Text>

                        <View style={styles.mobileMetaTagsGroup}>
                          <View style={[styles.compactPillTag, { backgroundColor: colors.primarySoft }]}>
                            <Text
                              style={[styles.compactPillTagText, { color: colors.primary, fontFamily: fBold }]}
                            >
                              סט {setNum}/{effectiveSets}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => startTimer(ex.restSec)}
                            style={[
                              styles.restTagBadgeCompact,
                              {
                                backgroundColor: scheme === 'dark' ? '#422006' : '#fef3c7',
                                borderColor: scheme === 'dark' ? '#f59e0b' : '#d97706',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.restTagTextCompact,
                                { color: scheme === 'dark' ? '#fbbf24' : '#b45309', fontFamily: fBold },
                              ]}
                            >
                              ⏳ מנוחה: {ex.restSec} שניות
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  )}

                  {isWide ? (
                    <>
                      {/* Desktop Wide: Compact Last Time & Trend Card + Side-by-Side Workspace */}
                      <ExerciseTrendCard
                        compact
                        exerciseId={ex.id}
                        workoutHistory={sortedHistoryDesc}
                        liveBestWeight={bestWeightToday}
                        colors={colors}
                        fontsLoaded={fontsLoaded}
                      />
                      <View style={styles.exBodyGridWideFull}>
                        <View style={styles.exGuidanceColWide}>{renderExerciseGuidancePane()}</View>
                        <View style={styles.exSetColWide}>{renderSingleSetWorkspace()}</View>
                      </View>
                    </>
                  ) : (
                    <View style={styles.flexOne}>{renderSingleSetWorkspace()}</View>
                  )}
                </View>
              );
            })()
          ) : (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.subCardText, { color: colors.mutedForeground, fontFamily: fReg }]}>
                לא נמצאו תרגילים בסינון הנוכחי. בחר קבוצת שריר אחרת למעלה.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* PROGRESS & CALCULATOR SCROLLABLE CONTAINER */}
      {!isWorkoutTab && (
        <ScrollView
          ref={exerciseScrollRef}
          style={styles.flexOne}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.maxWidthWrap}>
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
                    בחרו תרגיל כדי לצפות בעליית המשקל מאימון לאימון:
                  </Text>

                  <View style={styles.gifPickerGrid}>
                    {EXERCISES.map((ex, i) => {
                      const active = chartExerciseId === ex.id;
                      return (
                        <Pressable
                          key={ex.id}
                          onPress={() => setChartExerciseId(ex.id)}
                          style={[
                            styles.gifExerciseTile,
                            {
                              backgroundColor: active ? colors.primarySoft : colors.background,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <ExerciseGifIcon
                            exerciseId={ex.id}
                            size={60}
                            active={active}
                            borderColor={colors.border}
                            activeBorderColor="#a3e635"
                          />
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.gifTileLabel,
                              {
                                color: active ? colors.primary : colors.foreground,
                                fontFamily: active ? fBold : fSemi,
                              },
                            ]}
                          >
                            {i + 1}. {ex.shortName}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {(() => {
                    const selectedEx = EXERCISES.find((e) => e.id === chartExerciseId);
                    if (!selectedEx) return null;
                    return (
                      <View
                        style={[
                          styles.chartSelectedBanner,
                          { backgroundColor: colors.background, borderColor: colors.border },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[styles.subCardText, { color: colors.foreground, fontFamily: fBold }]}
                        >
                          {selectedEx.name}{' '}
                          <Text style={{ color: colors.mutedForeground, fontFamily: fReg }}>
                            ({selectedEx.muscle})
                          </Text>
                        </Text>
                      </View>
                    );
                  })()}

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
                            {(sess.items || []).map((item, idx2) => {
                              const exMeta = EXERCISES.find((e) => e.id === item.exId);
                              return (
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
                                  <View style={styles.historyItemHeader}>
                                    <ExerciseGifIcon
                                      exerciseId={item.exId}
                                      size={42}
                                      borderColor={colors.border}
                                    />
                                    <View style={{ flex: 1, gap: 4 }}>
                                      <Text
                                        numberOfLines={1}
                                        style={[
                                          styles.subCardText,
                                          { color: colors.foreground, fontFamily: fBold },
                                        ]}
                                      >
                                        {exMeta ? exMeta.shortName : item.exName}
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
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ALWAYS-VISIBLE PERSISTENT BOTTOM DOCK: SET/EX NAV + REST WATCH + LIVE STATS */}
      <View
        style={[
          styles.bottomDock,
          !isWide && styles.bottomDockMobile,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        {isWorkoutTab && activeEx && (
          <View
            style={[
              styles.bottomNavRow,
              !isWide && styles.bottomNavRowMobile,
              { borderBottomColor: colors.border },
            ]}
          >
            {/* In RTL row-reverse: first child renders on Right (Previous), middle Save, last on Left (Next / Finish) */}
            <Pressable
              disabled={isAtVeryStart}
              onPress={goPrevStep}
              style={[
                styles.bottomNavBtn,
                !isWide && styles.bottomNavBtnMobile,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  opacity: isAtVeryStart ? 0.35 : 1,
                },
              ]}
            >
              <Text style={[styles.bottomNavBtnText, { color: colors.foreground, fontFamily: fSemi }]}>
                {prevBtnLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setSaveFeedback(null);
                setSaveModalOpen(true);
              }}
              style={[
                styles.bottomSaveBtn,
                !isWide && styles.bottomNavBtnMobile,
                {
                  backgroundColor:
                    totalDoneInView > 0 ? colors.primarySoft : colors.background,
                  borderColor: totalDoneInView > 0 ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.bottomNavBtnText,
                  {
                    color: totalDoneInView > 0 ? colors.primary : colors.foreground,
                    fontFamily: fBold,
                  },
                ]}
              >
                💾 שמור ({totalDoneInView}/{totalSetsInView})
              </Text>
            </Pressable>

            <Pressable
              onPress={goNextStep}
              style={[
                styles.bottomNavBtn,
                !isWide && styles.bottomNavBtnMobile,
                {
                  backgroundColor: isAtVeryEnd ? colors.success : colors.primary,
                  borderColor: isAtVeryEnd ? colors.success : colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.bottomNavBtnText,
                  { color: '#ffffff', fontFamily: fBold },
                ]}
              >
                {nextBtnLabel}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Persistent Rest Watch + Live Workout Stats (Visible across the entire app) */}
        <View style={[styles.watchStatsBar, !isWide && styles.watchStatsBarMobile]}>
          <View
            style={[
              styles.watchCluster,
              !isWide && styles.watchClusterMobile,
              {
                backgroundColor: timerFinished ? colors.successSoft : colors.background,
                borderColor: timerFinished ? colors.success : colors.border,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.compactTimerVal,
                !isWide && styles.compactTimerValMobile,
                {
                  color: timerFinished ? colors.success : colors.foreground,
                  fontFamily: fBold,
                },
              ]}
            >
              {timerFinished ? '✓ המשך! 💪' : `⏱ ${formatTime(timerSeconds)}`}
            </Text>
            <Pressable
              onPress={toggleTimer}
              style={[
                styles.miniTimerBtn,
                !isWide && styles.miniTimerBtnMobile,
                { backgroundColor: timerRunning ? colors.danger : colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.miniTimerBtnText,
                  { color: colors.primaryForeground, fontFamily: fBold },
                ]}
              >
                {timerRunning ? 'עצור' : 'הפעל'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => startTimer(60)}
              style={[
                styles.miniTimerBtn,
                !isWide && styles.miniTimerBtnMobile,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Text
                style={[
                  styles.miniTimerBtnText,
                  { color: colors.secondaryForeground, fontFamily: fMed },
                ]}
              >
                60 שניות
              </Text>
            </Pressable>
            <Pressable
              onPress={() => startTimer(90)}
              style={[
                styles.miniTimerBtn,
                !isWide && styles.miniTimerBtnMobile,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Text
                style={[
                  styles.miniTimerBtnText,
                  { color: colors.secondaryForeground, fontFamily: fMed },
                ]}
              >
                90 שניות
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              if (currentTab !== 'progress') selectMainTab('progress');
            }}
            style={[styles.statsCluster, !isWide && styles.statsClusterMobile]}
          >
            {isWide ? (
              <>
                {totalSetsInView > 0 && (
                  <View
                    style={[
                      styles.bottomStatPill,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bottomStatText,
                        { color: colors.foreground, fontFamily: fSemi },
                      ]}
                    >
                      סטים: {totalDoneInView}/{totalSetsInView}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.bottomStatPill,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.bottomStatText,
                      { color: colors.secondaryForeground, fontFamily: fSemi },
                    ]}
                  >
                    🔥 {progressStats.weekWorkouts} השבוע • {progressStats.totalWorkouts} אימונים
                  </Text>
                </View>
              </>
            ) : (
              <View
                style={[
                  styles.bottomStatPill,
                  styles.bottomStatPillMobile,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.bottomStatText,
                    { color: colors.secondaryForeground, fontFamily: fSemi },
                  ]}
                >
                  {totalSetsInView > 0
                    ? `✓ ${totalDoneInView}/${totalSetsInView} • 🔥 ${progressStats.totalWorkouts}`
                    : `🔥 ${progressStats.totalWorkouts} אימונים`}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* EXERCISE SWITCHER DROPDOWN MODAL */}
      <Modal
        visible={exerciseDropdownOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setExerciseDropdownOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setExerciseDropdownOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalCard,
              styles.dropdownListModal,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.rowBetween,
                { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 },
              ]}
            >
              <Text style={[styles.saveCardTitle, { color: colors.foreground, fontFamily: fBold }]}>
                🏋️ בחר תרגיל ({visibleExercises.length} תרגילים)
              </Text>
              <Pressable
                onPress={() => setExerciseDropdownOpen(false)}
                style={[styles.smallBtn, { backgroundColor: colors.secondary }]}
              >
                <Text
                  style={[
                    styles.smallBtnText,
                    { color: colors.secondaryForeground, fontFamily: fBold },
                  ]}
                >
                  סגור ✕
                </Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {visibleExercises.map((itemEx, idx) => {
                const isCur = idx === safeExIdx;
                const { doneCount, effectiveSets, allDone, bestWeightToday } =
                  getExerciseDoneStats(itemEx);
                const lastLog = getLastExerciseLog(itemEx.id);
                const lastSummary =
                  lastLog && lastLog.sets.length > 0
                    ? `פעם קודמת: ${lastLog.sets[0].weight} קילוגרם`
                    : `היום: ${bestWeightToday} קילוגרם`;
                return (
                  <Pressable
                    key={itemEx.id}
                    onPress={() => {
                      goToExercise(idx, 0);
                      setExerciseDropdownOpen(false);
                    }}
                    style={[
                      styles.dropdownListRow,
                      {
                        backgroundColor: isCur
                          ? colors.primarySoft
                          : allDone
                          ? colors.successSoft
                          : colors.background,
                        borderColor: isCur
                          ? colors.primary
                          : allDone
                          ? colors.success
                          : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.exerciseDropdownRight}>
                      <ExerciseGifIcon
                        exerciseId={itemEx.id}
                        size={52}
                        active={isCur}
                        borderColor={colors.border}
                        activeBorderColor="#a3e635"
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.subCardTitle,
                            { color: colors.foreground, fontFamily: fBold },
                          ]}
                        >
                          {idx + 1}. {itemEx.shortName}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.subCardText,
                            { color: colors.mutedForeground, fontFamily: fReg },
                          ]}
                        >
                          {itemEx.muscle} • {effectiveSets} סטים • {lastSummary}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.dropdownSetsPill,
                        {
                          backgroundColor: isCur
                            ? colors.primary
                            : allDone
                            ? colors.success
                            : colors.card,
                          borderWidth: 1,
                          borderColor: isCur
                            ? colors.primary
                            : allDone
                            ? colors.success
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownSetsText,
                          {
                            color:
                              isCur || allDone ? colors.primaryForeground : colors.foreground,
                            fontFamily: fBold,
                          },
                        ]}
                      >
                        {allDone ? 'הושלם ✓' : `${doneCount}/${effectiveSets}`}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ALL SUPPORTED WEIGHTS MODAL (Opened from "עוד" button inside active set) */}
      <Modal
        visible={weightsModalOpen && !!activeEx}
        animationType="fade"
        transparent
        onRequestClose={() => setWeightsModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setWeightsModalOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalCard,
              styles.dropdownListModal,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {activeEx &&
              (() => {
                const modalConfigs = getConfigsForExercise(activeEx);
                const modalMode = getEffectiveMode(activeEx);
                const modalEntry = getSetEntry(activeEx, activeSetNum);
                const modalTrend = getExerciseTrendSummary(
                  activeEx.id,
                  sortedHistoryDesc,
                  colors
                );
                const prevBest = modalTrend.last ? modalTrend.last.bestWeight : null;

                return (
                  <>
                    <View
                      style={[
                        styles.rowBetween,
                        { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 },
                      ]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          numberOfLines={1}
                          style={[styles.saveCardTitle, { color: colors.foreground, fontFamily: fBold }]}
                        >
                          ⚖️ כל המשקלים הנתמכים ({modalConfigs.length})
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.exMetaCompact,
                            { color: colors.mutedForeground, fontFamily: fReg },
                          ]}
                        >
                          {activeEx.name} • סט {activeSetNum}
                          {prevBest !== null ? ` • אימון קודם: ${prevBest} קילוגרם` : ''}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setWeightsModalOpen(false)}
                        style={[styles.smallBtn, { backgroundColor: colors.secondary }]}
                      >
                        <Text
                          style={[
                            styles.smallBtnText,
                            { color: colors.secondaryForeground, fontFamily: fBold },
                          ]}
                        >
                          סגור ✕
                        </Text>
                      </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                      {modalConfigs.map((cfg) => {
                        const isCur = cfg.totalWeight === modalEntry.weight;
                        const isPrev = prevBest !== null && cfg.totalWeight === prevBest;
                        return (
                          <View
                            key={cfg.totalWeight}
                            style={[
                              styles.weightModalRow,
                              {
                                backgroundColor: isCur ? colors.primarySoft : colors.background,
                                borderColor: isCur ? colors.primary : colors.border,
                              },
                            ]}
                          >
                            <Pressable
                              onPress={() => {
                                selectWeightForSet(activeEx, activeSetNum, cfg.totalWeight);
                                setWeightsModalOpen(false);
                              }}
                              style={styles.weightModalMainBtn}
                            >
                              <View style={styles.weightModalTopLine}>
                                <Text
                                  style={[
                                    styles.subCardTitle,
                                    {
                                      color: isCur ? colors.primary : colors.foreground,
                                      fontFamily: fBold,
                                    },
                                  ]}
                                >
                                  {cfg.totalWeight === 0
                                    ? '0 קילוגרם (משקל גוף)'
                                    : `${cfg.totalWeight} קילוגרם`}
                                </Text>
                                {isCur && (
                                  <View
                                    style={[
                                      styles.weightModalTag,
                                      { backgroundColor: colors.primary },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.dropdownSetsText,
                                        { color: colors.primaryForeground, fontFamily: fBold },
                                      ]}
                                    >
                                      נבחר ✓
                                    </Text>
                                  </View>
                                )}
                                {isPrev && (
                                  <View
                                    style={[
                                      styles.weightModalTag,
                                      {
                                        backgroundColor: colors.card,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.dropdownSetsText,
                                        { color: colors.mutedForeground, fontFamily: fSemi },
                                      ]}
                                    >
                                      פעם קודמת
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text
                                numberOfLines={2}
                                style={[
                                  styles.subCardText,
                                  { color: colors.mutedForeground, fontFamily: fReg },
                                ]}
                              >
                                {describeConfigSetup(cfg, modalMode)}
                              </Text>
                            </Pressable>

                            {activeEffectiveSets > 1 && (
                              <Pressable
                                onPress={() => {
                                  selectWeightForExercise(activeEx, cfg.totalWeight);
                                  setWeightsModalOpen(false);
                                }}
                                style={[
                                  styles.copyAllSetsBtn,
                                  { backgroundColor: colors.card, borderColor: colors.border },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.copyAllSetsText,
                                    { color: colors.primary, fontFamily: fSemi },
                                  ]}
                                >
                                  לכל הסטים
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </>
                );
              })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* EXERCISE STEPS, TEMPO, VIDEOS & SAFETY MODAL */}
      <Modal
        visible={exerciseStepsModalOpen && !!activeEx}
        animationType="slide"
        transparent
        onRequestClose={() => setExerciseStepsModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setExerciseStepsModalOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalCard,
              styles.dropdownListModal,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {activeEx && (
              <>
                <View
                  style={[
                    styles.rowBetween,
                    { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 },
                  ]}
                >
                  <View style={styles.exerciseDropdownRight}>
                    <ExerciseGifIcon
                      exerciseId={activeEx.id}
                      size={44}
                      active
                      borderColor={colors.border}
                      activeBorderColor="#a3e635"
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        numberOfLines={2}
                        style={[styles.saveCardTitle, { color: colors.foreground, fontFamily: fBold }]}
                      >
                        {activeEx.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.exMetaCompact,
                          { color: colors.mutedForeground, fontFamily: fReg },
                        ]}
                      >
                        {activeEx.muscle} • {activeEx.equipment}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setExerciseStepsModalOpen(false)}
                    style={[styles.smallBtn, { backgroundColor: colors.secondary }]}
                  >
                    <Text
                      style={[
                        styles.smallBtnText,
                        { color: colors.secondaryForeground, fontFamily: fBold },
                      ]}
                    >
                      סגור ✕
                    </Text>
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 6 }}>
                  <View style={styles.tipsFooterRow}>
                    <View
                      style={[
                        styles.tipCompactBox,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subCardText,
                          { color: colors.mutedForeground, fontFamily: fReg },
                        ]}
                      >
                        <Text style={{ color: colors.foreground, fontFamily: fBold }}>
                          ⏱ קצב תנועה:{' '}
                        </Text>
                        {activeEx.tempo}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.tipCompactBox,
                        {
                          backgroundColor: scheme === 'dark' ? '#422006' : '#fef3c7',
                          borderColor: scheme === 'dark' ? '#f59e0b' : '#d97706',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subCardText,
                          { color: scheme === 'dark' ? '#fbbf24' : '#b45309', fontFamily: fBold },
                        ]}
                      >
                        ⏳ מנוחה בין סט לסט: {activeEx.restSec} שניות
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.subCard,
                      { backgroundColor: colors.background, borderColor: colors.border, gap: 8 },
                    ]}
                  >
                    <Text style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}>
                      📋 שלבי ביצוע:
                    </Text>
                    {activeEx.steps.map((st, sIdx) => (
                      <View key={sIdx} style={styles.stepRow}>
                        <View style={[styles.stepNumCircle, { backgroundColor: colors.secondary }]}>
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
                            styles.stepBodyTextCompact,
                            { color: colors.foreground, fontFamily: fReg },
                          ]}
                        >
                          {st}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.tipsFooterRow}>
                    <View
                      style={[
                        styles.tipCompactBox,
                        { backgroundColor: colors.background, borderColor: colors.border },
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
                        {activeEx.homeTip}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.tipCompactBox,
                        { backgroundColor: colors.background, borderColor: colors.border },
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
                        {activeEx.avoid}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.videosRow}>
                    {activeEx.videos.map((v) => (
                      <Pressable
                        key={v.url}
                        onPress={() => Linking.openURL(v.url)}
                        style={[
                          styles.videoBtnCompact,
                          { backgroundColor: colors.secondary, borderColor: colors.border },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
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
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* GUIDE, EQUIPMENT INVENTORY & SAFETY MODAL */}
      <Modal
        visible={guideModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setGuideModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.rowBetween,
                { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 },
              ]}
            >
              <Text style={[styles.saveCardTitle, { color: colors.foreground, fontFamily: fBold }]}>
                📖 מדריך, ציוד ולוח שבועי
              </Text>
              {(timerRunning || timerFinished) && (
                <View style={[styles.compactSyncBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.compactSyncText, { color: colors.primary, fontFamily: fBold }]}>
                    {timerFinished ? '✓ המשך! 💪' : `⏱ ${formatTime(timerSeconds)}`}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => setGuideModalOpen(false)}
                style={[styles.smallBtn, { backgroundColor: colors.secondary }]}
              >
                <Text
                  style={[
                    styles.smallBtnText,
                    { color: colors.secondaryForeground, fontFamily: fBold },
                  ]}
                >
                  סגור ✕
                </Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12, paddingVertical: 6 }}>
              {currentSetupMessage && (
                <View
                  style={[
                    styles.subCard,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}>
                    {currentSetupMessage.title}
                  </Text>
                  <Text style={[styles.subCardText, { color: colors.mutedForeground, fontFamily: fReg }]}>
                    {currentSetupMessage.desc}
                  </Text>
                </View>
              )}

              <View
                style={[
                  styles.inventoryStrip,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.inventoryTitle, { color: colors.foreground, fontFamily: fBold }]}>
                  📦 פרופיל הציוד והמשקלים הנתמכים ב-AI Trainer:
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
                        style={[styles.pillBadgeText, { color: colors.foreground, fontFamily: fMed }]}
                      >
                        • {item}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

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
                    <Text style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}>
                      {item.title}
                    </Text>
                    <Text
                      style={[styles.subCardText, { color: colors.mutedForeground, fontFamily: fReg }]}
                    >
                      {item.body}
                    </Text>
                  </View>
                ))}
              </View>

              <View
                style={[
                  styles.subCard,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}>
                  ⚠️ בטיחות עבודה עם ספסל אימון (עד 100 קילוגרם)
                </Text>
                <Text style={[styles.subCardText, { color: colors.mutedForeground, fontFamily: fReg }]}>
                  כשמתאמנים עם ספסל בעל מגבלת עומס של עד 100 קילוגרם (משקל גוף + משקולות יחד), מומלץ שלא לשכב או לשבת עליו עם משקלים כבדים, אלא להישען עם יד אחת או להניח ידיים/רגליים כשהספסל צמוד לקיר.
                </Text>
              </View>

              <View
                style={[
                  styles.subCard,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.subCardTitle, { color: colors.foreground, fontFamily: fBold }]}>
                  🏋️ דוגמה לשילוב שבועי מומלץ (כוח + אימונים פונקציונליים)
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
                        style={[styles.dayBox, { backgroundColor: bg, borderColor: colors.border }]}
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

              <Pressable
                onPress={() => {
                  clearSetCheckmarks();
                  setGuideModalOpen(false);
                }}
                style={[
                  styles.outlineBtn,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.smallBtnText, { color: colors.danger, fontFamily: fSemi }]}>
                  🧹 נקה את כל סימוני הסטים באימון הנוכחי
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SAVE WORKOUT MODAL */}
      <Modal
        visible={saveModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setSaveModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              styles.saveModalCard,
              { backgroundColor: colors.card, borderColor: colors.primary },
            ]}
          >
            <View style={styles.rowBetween}>
              <Text style={[styles.saveCardTitle, { color: colors.foreground, fontFamily: fBold }]}>
                🎉 שמירת האימון ביומן ההתקדמות
              </Text>
              {(timerRunning || timerFinished) && (
                <View style={[styles.compactSyncBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.compactSyncText, { color: colors.primary, fontFamily: fBold }]}>
                    {timerFinished ? '✓ המשך! 💪' : `⏱ ${formatTime(timerSeconds)}`}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => setSaveModalOpen(false)}
                style={[styles.smallBtn, { backgroundColor: colors.secondary }]}
              >
                <Text
                  style={[
                    styles.smallBtnText,
                    { color: colors.secondaryForeground, fontFamily: fBold },
                  ]}
                >
                  סגור ✕
                </Text>
              </Pressable>
            </View>

            <View style={[styles.pillBadge, { backgroundColor: colors.secondary, alignSelf: 'flex-end' }]}>
              <Text
                style={[
                  styles.pillBadgeText,
                  { color: colors.secondaryForeground, fontFamily: fBold },
                ]}
              >
                {totalDoneInView} מתוך {totalSetsInView} סטים סומנו כבוצעו
              </Text>
            </View>

            <Text style={[styles.subCardText, { color: colors.mutedForeground, fontFamily: fReg }]}>
              כל הסטים שסימנת (כולל המשקלים ומספר החזרות) יישמרו עם התאריך של היום בענן ועל המכשיר, ויעדכנו אוטומטית את נתוני הפעם הקודמת והמגמה בכל תרגיל!
            </Text>

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

            <View style={styles.rowBetween}>
              <Pressable
                onPress={clearSetCheckmarks}
                style={[
                  styles.outlineBtn,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[styles.smallBtnText, { color: colors.mutedForeground, fontFamily: fMed }]}
                >
                  🧹 נקה סימוני סטים
                </Text>
              </Pressable>

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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
  },
  webFullscreenRoot: {
    width: '100%',
    height: '100%',
    flex: 1,
    overflow: 'hidden',
  },
  flexOne: {
    flex: 1,
  },
  topShell: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  topRow1: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topBrandTitleRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  compactTitle: {
    fontSize: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  compactSyncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  compactSyncText: {
    fontSize: 11,
    writingDirection: 'rtl',
  },
  topUtilityRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  utilityBtn: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  utilityBtnText: {
    fontSize: 11,
    writingDirection: 'rtl',
  },
  dedicatedActionBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dedicatedActionText: {
    fontSize: 12,
    writingDirection: 'rtl',
  },
  compactTimerVal: {
    fontSize: 14,
    marginLeft: 2,
  },
  miniTimerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  miniTimerBtnText: {
    fontSize: 11,
    writingDirection: 'rtl',
  },
  topTabsScroll: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  tabBtnCompact: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  tabBtnCompactText: {
    fontSize: 12,
    writingDirection: 'rtl',
  },
  filterChipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
  },
  dropdownRowWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  dropdownStepArrowBtn: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseDropdownBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 34,
  },
  exerciseDropdownRight: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  dropdownCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  dropdownCountText: {
    fontSize: 11,
  },
  exerciseDropdownTitle: {
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  exerciseDropdownLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  dropdownSetsPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  dropdownSetsText: {
    fontSize: 11,
    writingDirection: 'rtl',
  },
  dropdownChevron: {
    fontSize: 12,
    writingDirection: 'rtl',
  },
  dropdownListModal: {
    maxWidth: 560,
    maxHeight: '80%',
  },
  dropdownListRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fullscreenWorkoutStage: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  fullscreenExCard: {
    flex: 1,
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 8,
    overflow: 'hidden',
  },
  exHeaderCompact: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 1,
    paddingBottom: 6,
  },
  exHeaderTitleGroup: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  exTitleCompact: {
    fontSize: 15,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  exMetaCompact: {
    fontSize: 11,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  exBodyGridWideFull: {
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 12,
    overflow: 'hidden',
  },
  exGuidanceColWide: {
    width: '43%',
    flexShrink: 0,
    overflow: 'hidden',
  },
  exSetColWide: {
    flex: 1,
    overflow: 'hidden',
  },
  singleSetWorkspace: {
    flex: 1,
    gap: 6,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  setSwitcherBar: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  setPillsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  setSelectorPill: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  setSelectorPillText: {
    fontSize: 12,
    writingDirection: 'rtl',
  },
  modeToggleBtnCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeSetControlBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    gap: 6,
  },
  setControlsMainRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  doneBtnCompact: {
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsInlineBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  quickWeightsRow: {
    flex: 1,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  weightOptionChipCompact: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreWeightsChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualVisualRow: {
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 6,
    overflow: 'hidden',
  },
  weightModalRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  weightModalMainBtn: {
    flex: 1,
    gap: 2,
  },
  weightModalTopLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  weightModalTag: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  guidancePane: {
    flex: 1,
    gap: 8,
    overflow: 'hidden',
  },
  guidanceToggleRow: {
    flexDirection: 'row-reverse',
    gap: 6,
  },
  guidanceToggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceContentCol: {
    flex: 1,
    gap: 8,
    overflow: 'hidden',
  },
  videoBtnCompact: {
    flexGrow: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
  },
  stepsFitCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    justifyContent: 'space-between',
    gap: 6,
    overflow: 'hidden',
  },
  stepBodyTextCompact: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tipsFooterRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  tipCompactBox: {
    flex: 1,
    minWidth: 160,
    borderWidth: 1,
    borderRadius: 9,
    padding: 7,
  },
  bottomDock: {
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  bottomNavRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  bottomNavBtn: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSaveBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavBtnText: {
    fontSize: 13,
    writingDirection: 'rtl',
  },
  watchStatsBar: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  watchCluster: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statsCluster: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  bottomStatPill: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bottomStatText: {
    fontSize: 11,
    writingDirection: 'rtl',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '88%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  saveModalCard: {
    maxWidth: 520,
    borderWidth: 2,
    gap: 12,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  maxWidthWrap: {
    width: '100%',
    maxWidth: 1120,
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
  tabCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tabCountText: {
    fontSize: 12,
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
  videosRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
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
  modeToggleWrap: {
    flexDirection: 'row-reverse',
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
  chipsScrollRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    paddingVertical: 2,
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
    minWidth: 84,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInputSmall: {
    width: 42,
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
  saveCardTitle: {
    fontSize: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
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
  gifPickerGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  gifExerciseTile: {
    width: 82,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 5,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 5,
  },
  gifTileLabel: {
    fontSize: 11,
    textAlign: 'center',
    writingDirection: 'rtl',
    width: '100%',
  },
  chartSelectedBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  historyItemHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  headerBadgesCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  restTagBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  restTagText: {
    fontSize: 11,
    writingDirection: 'rtl',
  },
  infoQuickStrip: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  stepsModalTriggerBtn: {
    flexGrow: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoQuickChip: {
    flexGrow: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topShellMobile: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 5,
  },
  topRow1Mobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 5,
  },
  topBrandTitleRowMobile: {
    width: '100%',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  topBrandLeftGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  utilityBtnCompact: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topUtilityRowMobile: {
    width: '100%',
    flexWrap: 'nowrap',
    gap: 5,
  },
  dedicatedActionBtnMobile: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileNavTabsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    width: '100%',
  },
  mobileTabBtnCompact: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTabBtnCompactText: {
    fontSize: 11,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  fullscreenWorkoutStageMobile: {
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  fullscreenExCardMobile: {
    padding: 7,
    gap: 5,
  },
  exHeaderMobileWrap: {
    borderBottomWidth: 1,
    paddingBottom: 5,
    gap: 4,
  },
  mobileCardSwitcherRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  mobileCardArrowBtn: {
    width: 30,
    height: 36,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileCardDropdownPill: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minHeight: 38,
  },
  mobileCardDropdownTitle: {
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  mobileCardDropdownArrow: {
    fontSize: 11,
    writingDirection: 'rtl',
  },
  mobileCardMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  exMetaMobileCompact: {
    flex: 1,
    fontSize: 10.5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  mobileMetaTagsGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  compactPillTag: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  compactPillTagText: {
    fontSize: 10.5,
    writingDirection: 'rtl',
  },
  restTagBadgeCompact: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  restTagTextCompact: {
    fontSize: 10.5,
    writingDirection: 'rtl',
  },
  singleSetWorkspaceMobile: {
    gap: 5,
  },
  activeSetControlBoxMobile: {
    padding: 6,
    gap: 5,
  },
  dualVisualRowMobile: {
    minHeight: 145,
  },
  bottomDockMobile: {
    paddingHorizontal: 8,
    paddingTop: 5,
    paddingBottom: 6,
    gap: 5,
  },
  bottomNavRowMobile: {
    paddingBottom: 5,
    gap: 6,
  },
  bottomNavBtnMobile: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 78,
  },
  watchStatsBarMobile: {
    flexWrap: 'nowrap',
    gap: 5,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  watchClusterMobile: {
    flexShrink: 1,
    flexWrap: 'nowrap',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  compactTimerValMobile: {
    fontSize: 12.5,
  },
  miniTimerBtnMobile: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  statsClusterMobile: {
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  bottomStatPillMobile: {
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  controlsSplitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  metricSubCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 4,
  },
  weightMetricSubCard: {
    flex: 1.35,
  },
  repsMetricSubCard: {
    flex: 1,
  },
  metricSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  metricSubLabel: {
    fontSize: 10.5,
    writingDirection: 'rtl',
  },
  applyAllInlinePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  applyAllInlineText: {
    fontSize: 10,
    writingDirection: 'rtl',
  },
  metricStepperRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  metricStepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueBig: {
    fontSize: 14,
    lineHeight: 16,
  },
  metricValueUnit: {
    fontSize: 9.5,
    lineHeight: 11,
    writingDirection: 'rtl',
  },
  metricRepsInput: {
    flex: 1,
    minWidth: 34,
    maxWidth: 52,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 2,
  },
  quickWeightsStrip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    width: '100%',
  },
  weightOptionChipSegmented: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreWeightsChipSegmented: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnFull: {
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnFullText: {
    fontSize: 12.5,
    writingDirection: 'rtl',
  },
});
