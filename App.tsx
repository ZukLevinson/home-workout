import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Platform, Share, useColorScheme, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { User } from 'firebase/auth';
import {
  useFonts,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from '@expo-google-fonts/rubik';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award01,
  BarChartSquare02,
  BookOpen01,
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  Flag01,
  Link03,
  List,
  Minus,
  Moon01,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw01,
  Repeat02,
  Save01,
  Scales02,
  Sun,
  Trash01,
} from '@untitledui/icons';

import { Tab, TabList, Tabs } from '@/components/application/tabs/tabs';
import { Badge, BadgeWithDot, BadgeWithIcon } from '@/components/base/badges/badges';
import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';
import { Button } from '@/components/base/buttons/button';
import { ButtonUtility } from '@/components/base/buttons/button-utility';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';

import { lightColors, darkColors } from './src/theme';
import {
  EXERCISES,
  SETUP_MESSAGES,
  WORKOUT_NAMES_MAP,
  MUSCLE_FILTERS,
  buildConfigsForMode,
  snapToSupportedWeight,
} from './src/data/exercises';
import ExerciseAnimation from './src/components/ExerciseAnimation';
import EquipmentBuildDiagram from './src/components/EquipmentBuildDiagram';
import ExerciseTrendCard from './src/components/ExerciseTrendCard';
import ExerciseGifIcon from './src/components/ExerciseGifIcon';
import {
  DiscardWorkoutModal,
  ExerciseStepsModal,
  ExerciseSwitcherModal,
  GuideModal,
  SaveWorkoutModal,
  WeightsPickerModal,
  formatElapsedDuration,
} from './src/components/workout/Modals';
import { ProgressView } from './src/components/workout/ProgressView';
import { StartWorkoutView } from './src/components/workout/StartWorkoutView';
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
  ActiveWorkoutState,
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

const ACTIVE_WORKOUT_KEY = '__workout';

function formatTime(sec: number): string {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function isSetEntry(
  val: SetEntry | ModeOverrideEntry | ActiveWorkoutState | undefined
): val is SetEntry {
  return Boolean(val && typeof val === 'object' && 'weight' in val && 'reps' in val);
}

function isModeOverride(
  val: SetEntry | ModeOverrideEntry | ActiveWorkoutState | undefined
): val is ModeOverrideEntry {
  return Boolean(val && typeof val === 'object' && 'mode' in val);
}

function isActiveWorkoutState(
  val: SetEntry | ModeOverrideEntry | ActiveWorkoutState | undefined
): val is ActiveWorkoutState {
  return Boolean(
    val &&
      typeof val === 'object' &&
      'startedAtMs' in val &&
      typeof val.startedAtMs === 'number' &&
      'workoutTab' in val
  );
}

function getExercisesForTab(tab: WorkoutTabKey, muscleFilter: string): Exercise[] {
  if (tab === 'workoutA') {
    return EXERCISES.filter((e) => e.workouts.includes('workoutA')).sort(
      (a, b) => (a.orderA ?? 999) - (b.orderA ?? 999)
    );
  }
  if (tab === 'workoutB') {
    return EXERCISES.filter((e) => e.workouts.includes('workoutB')).sort(
      (a, b) => (a.orderB ?? 999) - (b.orderB ?? 999)
    );
  }
  if (tab === 'all') {
    return muscleFilter === 'all'
      ? EXERCISES
      : EXERCISES.filter((e) => e.muscle === muscleFilter);
  }
  return [];
}

const CONFIG_CACHE: Record<EquipmentMode, PlateConfig[]> = {
  pair: buildConfigsForMode('pair'),
  single: buildConfigsForMode('single'),
  barbell: buildConfigsForMode('barbell'),
  platePair: buildConfigsForMode('platePair'),
  bodyweight: buildConfigsForMode('bodyweight'),
};

export default function App(): React.ReactElement {
  const systemScheme = useColorScheme();
  const [themePref, setThemePref] = useState<'system' | 'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('ai-trainer-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'system';
  });
  const isDark =
    themePref === 'dark' || (themePref === 'system' && systemScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

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
  const [discardModalOpen, setDiscardModalOpen] = useState<boolean>(false);
  const [muscleFilter, setMuscleFilter] = useState<string>('all');
  const [animPaused, setAnimPaused] = useState<boolean>(false);

  const [exModeOverrides, setExModeOverrides] = useState<Partial<Record<string, EquipmentMode>>>({});

  // Rest timer state (per set)
  const [timerSeconds, setTimerSeconds] = useState<number>(90);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerFinished, setTimerFinished] = useState<boolean>(false);

  // Active workout clock tick
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

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

  // Sync Untitled UI `.dark-mode` class + browser chrome with dark/light mode
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const bg = colors.background;
      document.documentElement.classList.toggle('dark-mode', isDark);
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
  }, [isDark, colors.background, colors.card]);

  const toggleThemeMode = () => {
    const next: 'light' | 'dark' = isDark ? 'light' : 'dark';
    setThemePref(next);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('ai-trainer-theme', next);
    }
  };

  useEffect(() => {
    let mounted = true;
    loadLocalState().then(({ draft, history }) => {
      if (!mounted) return;
      if (draft && Object.keys(draft).length > 0) {
        setActiveDraft(draft);
        const restoredWorkout = draft[ACTIVE_WORKOUT_KEY];
        if (isActiveWorkoutState(restoredWorkout)) {
          setCurrentTab(restoredWorkout.workoutTab);
          setLastNonProgressTab(restoredWorkout.workoutTab);
        }
      }
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

  const rawWorkoutState = activeDraft[ACTIVE_WORKOUT_KEY];
  const activeWorkout = isActiveWorkoutState(rawWorkoutState) ? rawWorkoutState : null;
  const isWorkoutActive = activeWorkout !== null;
  const workoutStartedAtMs = activeWorkout?.startedAtMs ?? null;
  const workoutElapsedSec = activeWorkout
    ? Math.max(0, Math.floor((nowMs - activeWorkout.startedAtMs) / 1000))
    : 0;

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

  // Continuous running timer for the entire active workout (independent from per-set rest timer)
  useEffect(() => {
    if (workoutStartedAtMs === null) return undefined;
    setNowMs(Date.now());
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        setNowMs(Date.now());
      }
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    return () => {
      clearInterval(id);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [workoutStartedAtMs]);

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
      return { ...existing, weight: snapped };
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

  const persistDraft = (nextDraft: ActiveDraft, immediate = false) => {
    setActiveDraft(nextDraft);
    saveLocalDraft(nextDraft);
    if (firebaseUser) {
      if (draftSyncTimeout.current) clearTimeout(draftSyncTimeout.current);
      if (immediate) {
        syncDraftToCloud(firebaseUser.uid, nextDraft).catch(() => {});
      } else {
        draftSyncTimeout.current = setTimeout(() => {
          syncDraftToCloud(firebaseUser.uid, nextDraft).catch(() => {});
        }, 450);
      }
    }
  };

  const setExerciseEquipmentMode = (ex: Exercise, nextMode: EquipmentMode) => {
    setExModeOverrides((prev) => ({ ...prev, [ex.id]: nextMode }));
    const nextConfigs = CONFIG_CACHE[nextMode] || CONFIG_CACHE.pair;
    const updated: ActiveDraft = {
      ...activeDraft,
      [`__mode_${ex.id}`]: { mode: nextMode },
    };
    for (let s = 1; s <= ex.sets; s++) {
      const cur = getSetEntry(ex, s);
      updated[`${ex.id}-${s}`] = {
        ...cur,
        weight: snapToSupportedWeight(cur.weight, nextConfigs),
      };
    }
    persistDraft(updated);
  };

  const stepSupportedWeight = (ex: Exercise, setNum: number, direction: number) => {
    const configs = getConfigsForExercise(ex);
    const cur = getSetEntry(ex, setNum);
    let idx = configs.findIndex((c) => c.totalWeight === cur.weight);
    if (idx === -1) {
      const snapped = snapToSupportedWeight(cur.weight, configs);
      idx = Math.max(0, configs.findIndex((c) => c.totalWeight === snapped));
    }
    const nextIdx = Math.max(0, Math.min(configs.length - 1, idx + direction));
    persistDraft({
      ...activeDraft,
      [`${ex.id}-${setNum}`]: { ...cur, weight: configs[nextIdx].totalWeight },
    });
  };

  const selectWeightForSet = (ex: Exercise, setNum: number, exactWeight: number) => {
    const cur = getSetEntry(ex, setNum);
    persistDraft({
      ...activeDraft,
      [`${ex.id}-${setNum}`]: { ...cur, weight: exactWeight },
    });
  };

  const selectWeightForExercise = (ex: Exercise, exactWeight: number) => {
    const updated: ActiveDraft = { ...activeDraft };
    let changedAny = false;
    for (let s = 1; s <= ex.sets; s++) {
      const cur = getSetEntry(ex, s);
      if (!cur.done) {
        updated[`${ex.id}-${s}`] = { ...cur, weight: exactWeight };
        changedAny = true;
      }
    }
    if (!changedAny) {
      for (let s = 1; s <= ex.sets; s++) {
        const cur = getSetEntry(ex, s);
        updated[`${ex.id}-${s}`] = { ...cur, weight: exactWeight };
      }
    }
    persistDraft(updated);
  };

  const stepReps = (ex: Exercise, setNum: number, delta: number) => {
    const cur = getSetEntry(ex, setNum);
    const nextVal = Math.max(1, Math.round((Number(cur.reps) || 1) + delta));
    persistDraft({
      ...activeDraft,
      [`${ex.id}-${setNum}`]: { ...cur, reps: nextVal },
    });
  };

  const updateRepsText = (ex: Exercise, setNum: number, raw: string) => {
    const cur = getSetEntry(ex, setNum);
    const parsed = parseInt(raw, 10);
    const nextVal = Number.isNaN(parsed) || parsed < 1 ? 1 : Math.min(200, parsed);
    persistDraft({
      ...activeDraft,
      [`${ex.id}-${setNum}`]: { ...cur, reps: nextVal },
    });
  };

  const toggleSetDone = (ex: Exercise, setNum: number) => {
    const cur = getSetEntry(ex, setNum);
    const nextDone = !cur.done;
    persistDraft({
      ...activeDraft,
      [`${ex.id}-${setNum}`]: { ...cur, done: nextDone },
    });
    if (nextDone) {
      startTimer(ex.restSec);
    }
  };

  const buildCleanedDraft = (keepActiveWorkout: boolean): ActiveDraft => {
    const cleaned: ActiveDraft = {};
    Object.keys(activeDraft).forEach((k) => {
      const entry = activeDraft[k];
      if (k.startsWith('__mode_')) {
        cleaned[k] = entry;
      } else if (keepActiveWorkout && k === ACTIVE_WORKOUT_KEY && isActiveWorkoutState(entry)) {
        cleaned[k] = entry;
      } else if (isSetEntry(entry)) {
        cleaned[k] = { ...entry, done: false };
      }
    });
    return cleaned;
  };

  const clearSetCheckmarks = () => {
    persistDraft(buildCleanedDraft(true));
  };

  const startWorkout = (startExIdx = 0) => {
    const targetTab: 'workoutA' | 'workoutB' | 'all' =
      currentTab === 'workoutA' || currentTab === 'workoutB' || currentTab === 'all'
        ? currentTab
        : lastNonProgressTab === 'workoutB' || lastNonProgressTab === 'all'
        ? lastNonProgressTab
        : 'workoutA';
    const startedMs = Date.now();
    const freshDraft = buildCleanedDraft(false);
    freshDraft[ACTIVE_WORKOUT_KEY] = {
      startedAtMs: startedMs,
      workoutTab: targetTab,
    };
    setNowMs(startedMs);
    persistDraft(freshDraft, true);
    setTimerRunning(false);
    setTimerFinished(false);
    setTimerSeconds(90);
    setSaveFeedback(null);
    setWorkoutNote('');
    setLastNonProgressTab(targetTab);
    setCurrentTab(targetTab);
    setCurrentExerciseIdx(Math.max(0, startExIdx));
    setCurrentSetIdx(0);
  };

  const performDiscardWorkout = () => {
    const returnTab = activeWorkout?.workoutTab || lastNonProgressTab;
    persistDraft(buildCleanedDraft(false), true);
    setTimerRunning(false);
    setTimerFinished(false);
    setTimerSeconds(90);
    setWorkoutNote('');
    setSaveFeedback(null);
    setSaveModalOpen(false);
    setDiscardModalOpen(false);
    setExerciseDropdownOpen(false);
    setWeightsModalOpen(false);
    setExerciseStepsModalOpen(false);
    setCurrentExerciseIdx(0);
    setCurrentSetIdx(0);
    if (currentTab === 'progress') {
      setCurrentTab(returnTab === 'progress' ? 'workoutA' : returnTab);
    }
  };

  const visibleExercises = useMemo(
    () => getExercisesForTab(currentTab, muscleFilter),
    [currentTab, muscleFilter]
  );

  const sessionTabKey: WorkoutTabKey =
    activeWorkout?.workoutTab || (currentTab !== 'progress' ? currentTab : lastNonProgressTab);

  const sessionExercises = useMemo(
    () => getExercisesForTab(sessionTabKey, muscleFilter),
    [sessionTabKey, muscleFilter]
  );

  const { totalDoneInView, totalSetsInView } = useMemo(() => {
    let doneCount = 0;
    let totalCount = 0;
    sessionExercises.forEach((ex) => {
      totalCount += ex.sets;
      for (let s = 1; s <= ex.sets; s++) {
        if (getSetEntry(ex, s).done) doneCount++;
      }
    });
    return { totalDoneInView: doneCount, totalSetsInView: totalCount };
  }, [sessionExercises, activeDraft, exModeOverrides, sessionTabKey, sortedHistoryDesc]);

  const requestDiscardWorkout = () => {
    if (totalDoneInView > 0) {
      setSaveModalOpen(false);
      setDiscardModalOpen(true);
    } else {
      performDiscardWorkout();
    }
  };

  const handleSaveWorkoutSession = async () => {
    const items: LoggedExerciseItem[] = [];
    let sessionTotalSets = 0;

    sessionExercises.forEach((ex) => {
      const doneSets: LoggedSet[] = [];
      for (let s = 1; s <= ex.sets; s++) {
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
        items.push({ exId: ex.id, exName: ex.name, sets: doneSets });
      }
    });

    if (items.length === 0) {
      setSaveFeedback({
        error: true,
        text: 'סמן לפחות סט אחד שבוצע לפני שמירת האימון ביומן (או בטל וזרוק את האימון).',
      });
      return;
    }

    const now = new Date();
    const nowTimeMs = now.getTime();
    const displayDate = now.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const allowedTabs: WorkoutTabKey[] = ['workoutA', 'workoutB', 'all'];
    const workoutTab = allowedTabs.includes(sessionTabKey) ? sessionTabKey : 'workoutA';
    const recordedDurationSec = activeWorkout
      ? Math.max(1, Math.min(86400, Math.round((nowTimeMs - activeWorkout.startedAtMs) / 1000)))
      : 1;

    const sessionDoc: WorkoutSession = {
      id: `sess_${nowTimeMs}`,
      isoDate: now.toISOString(),
      createdAtMs: nowTimeMs,
      displayDate,
      workoutTab,
      workoutTitle:
        WORKOUT_NAMES_MAP[workoutTab] ||
        (workoutTab === 'all' ? 'אימון חופשי: כל התרגילים' : 'אימון כוח'),
      note: workoutNote.trim().slice(0, 500),
      totalSets: sessionTotalSets,
      durationSec: recordedDurationSec,
      items,
    };

    const nextHistory = [sessionDoc, ...sortedHistoryDesc];
    setWorkoutHistory(nextHistory);
    await saveLocalHistory(nextHistory);

    if (firebaseUser) {
      try {
        await saveWorkoutToCloud(firebaseUser.uid, sessionDoc);
      } catch {
        // Local copy saved
      }
    }

    persistDraft(buildCleanedDraft(false), true);
    setTimerRunning(false);
    setTimerFinished(false);
    setTimerSeconds(90);
    setWorkoutNote('');
    setSaveFeedback(null);
    setSaveModalOpen(false);
    setCurrentExerciseIdx(0);
    setCurrentSetIdx(0);
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
            const dur =
              typeof s.durationSec === 'number' &&
              Number.isFinite(s.durationSec) &&
              s.durationSec >= 0 &&
              s.durationSec <= 86400
                ? Math.round(s.durationSec)
                : undefined;
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
              ...(dur !== undefined ? { durationSec: dur } : {}),
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

  const selectMainTab = (nextTab: WorkoutTabKey) => {
    setSaveFeedback(null);
    setExerciseDropdownOpen(false);
    setWeightsModalOpen(false);
    setExerciseStepsModalOpen(false);
    if (nextTab !== 'progress') {
      setLastNonProgressTab(nextTab);
      if (isWorkoutActive && activeWorkout && activeWorkout.workoutTab !== nextTab) {
        persistDraft({
          ...activeDraft,
          [ACTIVE_WORKOUT_KEY]: {
            ...activeWorkout,
            workoutTab: nextTab,
          },
        });
      }
    }
    setCurrentTab(nextTab);
    setCurrentExerciseIdx(0);
    setCurrentSetIdx(0);
  };

  const isWorkoutTab = currentTab !== 'progress';
  const lastSessionForTab = useMemo(
    () => sortedHistoryDesc.find((s) => s.workoutTab === currentTab) || null,
    [sortedHistoryDesc, currentTab]
  );
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
    const clampedSet = Math.max(0, Math.min(targetEx.sets - 1, setIdxOverride));
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
      goToExercise(safeExIdx - 1, prevEx.sets - 1);
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
  const prevBtnLabel = safeSetIdx > 0 ? 'סט קודם' : 'תרגיל קודם';
  const nextBtnLabel = isAtVeryEnd
    ? 'סיום ושמירה'
    : safeSetIdx < activeEffectiveSets - 1
    ? 'סט הבא'
    : 'תרגיל הבא';

  const currentSetupMessage =
    currentTab === 'workoutA' || currentTab === 'workoutB'
      ? SETUP_MESSAGES[currentTab]
      : undefined;

  const getExerciseDoneStats = (ex: Exercise) => {
    let doneCount = 0;
    let bestWeightToday = 0;
    for (let s = 1; s <= ex.sets; s++) {
      const entry = getSetEntry(ex, s);
      if (entry.done) doneCount++;
      if (s === 1 || entry.weight > bestWeightToday) bestWeightToday = entry.weight;
    }
    return {
      doneCount,
      effectiveSets: ex.sets,
      allDone: ex.sets > 0 && doneCount === ex.sets,
      bestWeightToday,
    };
  };

  const showGoogleConnect =
    Platform.OS === 'web' &&
    isFirebaseConfigured() &&
    (!firebaseUser || firebaseUser.isAnonymous);

  return (
    <div
      dir="rtl"
      className="flex h-full w-full flex-col overflow-hidden bg-secondary_alt text-primary"
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* PINNED COMPACT TOP HEADER BAR */}
      <header className="shrink-0 border-b border-secondary bg-primary px-2.5 py-1.5 sm:px-4 sm:py-2.5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5 sm:gap-2">
          {/* Row 1: Brand + Sync + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              <FeaturedIcon icon={Activity} size="sm" color="brand" theme="modern" />
              <span className="truncate text-sm font-bold text-primary sm:text-md">AI Trainer</span>
              {isWide && (
                <Badge size="sm" color="brand">
                  מאמן כוח חכם
                </Badge>
              )}
              <BadgeWithDot
                size="sm"
                color={
                  syncStatus.mode === 'cloud'
                    ? 'success'
                    : syncStatus.mode === 'connecting'
                    ? 'brand'
                    : 'gray'
                }
              >
                {isWide
                  ? syncStatus.message
                  : syncStatus.mode === 'cloud'
                  ? 'מסונכרן'
                  : syncStatus.mode === 'connecting'
                  ? 'מתחבר'
                  : 'מקומי'}
              </BadgeWithDot>
            </div>

            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              <Button
                size="xs"
                color={currentTab === 'progress' ? 'primary' : 'secondary'}
                iconLeading={BarChartSquare02}
                onPress={() =>
                  selectMainTab(currentTab === 'progress' ? lastNonProgressTab : 'progress')
                }
              >
                ההתקדמות שלי ({sortedHistoryDesc.length})
              </Button>

              <Button
                size="xs"
                color={guideModalOpen ? 'primary' : 'secondary'}
                iconLeading={BookOpen01}
                onPress={() => setGuideModalOpen(true)}
              >
                מדריך וציוד
              </Button>

              <ButtonUtility
                size="xs"
                color="secondary"
                icon={animPaused ? PlayCircle : PauseCircle}
                tooltip={animPaused ? 'הפעל אנימציה' : 'השהה אנימציה'}
                onPress={() => setAnimPaused((p) => !p)}
              />

              <ButtonUtility
                size="xs"
                color="secondary"
                icon={isDark ? Sun : Moon01}
                tooltip={isDark ? 'מצב בהיר' : 'מצב כהה'}
                onPress={toggleThemeMode}
              />

              {showGoogleConnect && (
                <Button
                  size="xs"
                  color="secondary"
                  iconLeading={Link03}
                  onPress={handleGoogleSignIn}
                >
                  Google
                </Button>
              )}
            </div>
          </div>

          {/* Row 2: Main Workout Navigation Tabs (Untitled UI Tabs) */}
          <Tabs
            selectedKey={currentTab}
            onSelectionChange={(key) => selectMainTab(key as WorkoutTabKey)}
          >
            <TabList aria-label="בחירת תוכנית אימון" type="button-border" size="sm" fullWidth>
              <Tab id="workoutA">{isWide ? 'אימון A: חזה, גב וזרועות' : 'אימון A'}</Tab>
              <Tab id="workoutB">{isWide ? 'אימון B: כתפיים, גב וזרועות' : 'אימון B'}</Tab>
              <Tab id="all">כל התרגילים</Tab>
            </TabList>
          </Tabs>

          {/* Running Active Workout Status Bar: Always visible while workout is running */}
          {isWorkoutActive && activeWorkout && (
            <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl bg-brand-primary_alt px-2.5 py-1.5 ring-1 ring-utility-brand-300 sm:px-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 animate-pulse rounded-full bg-fg-success-primary" />
                <span className="truncate text-xs font-bold text-primary sm:text-sm">
                  {isWide
                    ? WORKOUT_NAMES_MAP[activeWorkout.workoutTab] || 'אימון פעיל: כל התרגילים'
                    : activeWorkout.workoutTab === 'workoutA'
                    ? 'אימון A פעיל'
                    : activeWorkout.workoutTab === 'workoutB'
                    ? 'אימון B פעיל'
                    : 'אימון פעיל'}
                </span>
                <BadgeWithIcon
                  size="sm"
                  color="brand"
                  iconLeading={Clock}
                  className="font-mono tabular-nums"
                >
                  {isWide ? 'זמן אימון: ' : ''}
                  {formatElapsedDuration(workoutElapsedSec)}
                </BadgeWithIcon>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {!isWorkoutTab && (
                  <Button
                    size="xs"
                    color="secondary"
                    iconLeading={Activity}
                    onPress={() => selectMainTab(activeWorkout.workoutTab)}
                  >
                    חזור לאימון
                  </Button>
                )}
                <Button
                  size="xs"
                  color="primary"
                  iconLeading={Flag01}
                  onPress={() => {
                    setSaveFeedback(null);
                    setSaveModalOpen(true);
                  }}
                >
                  סיים אימון
                </Button>
                <Button
                  size="xs"
                  color="secondary-destructive"
                  iconLeading={Trash01}
                  onPress={requestDiscardWorkout}
                >
                  {isWide ? 'בטל אימון' : 'בטל'}
                </Button>
              </div>
            </div>
          )}

          {/* Row 3a: Muscle Group Filter Chips when 'all' tab is active */}
          {currentTab === 'all' && (
            <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {MUSCLE_FILTERS.map((mf) => {
                const active = muscleFilter === mf;
                const lbl = mf === 'all' ? 'כל התרגילים (10)' : mf;
                return (
                  <Button
                    key={mf}
                    size="xs"
                    color={active ? 'primary' : 'secondary'}
                    onPress={() => {
                      setMuscleFilter(mf);
                      setCurrentExerciseIdx(0);
                    }}
                  >
                    {lbl}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Row 3b: Wide Desktop Exercise Switcher Bar */}
          {isWide &&
            isWorkoutActive &&
            isWorkoutTab &&
            visibleExercises.length > 0 &&
            activeEx &&
            (() => {
              const { doneCount, effectiveSets, allDone } = getExerciseDoneStats(activeEx);
              return (
                <div className="flex items-center gap-2">
                  <ButtonUtility
                    size="sm"
                    color="secondary"
                    icon={ArrowRight}
                    tooltip="תרגיל קודם"
                    isDisabled={safeExIdx <= 0}
                    onPress={() => goToExercise(safeExIdx - 1, 0)}
                  />

                  <button
                    type="button"
                    onClick={() => setExerciseDropdownOpen(true)}
                    className={`flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-lg bg-primary px-3 py-1.5 shadow-xs ring-1 transition duration-100 hover:bg-primary_hover ${
                      exerciseDropdownOpen ? 'ring-2 ring-brand' : 'ring-primary'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ExerciseGifIcon
                        exerciseId={activeEx.id}
                        size={32}
                        active
                        borderColor={colors.border}
                        activeBorderColor={colors.primary}
                      />
                      <Badge size="sm" color={allDone ? 'success' : 'brand'}>
                        {safeExIdx + 1}/{visibleExercises.length}
                      </Badge>
                      <span className="truncate text-sm font-bold text-primary">
                        {activeEx.name}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        size="sm"
                        color={allDone ? 'success' : 'gray'}
                        type={allDone ? 'pill-color' : 'modern'}
                      >
                        {doneCount}/{effectiveSets} {allDone ? 'הושלם' : 'סטים'}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs font-semibold text-brand-secondary">
                        <span>החלף תרגיל</span>
                        <ChevronDown className="size-4" />
                      </span>
                    </div>
                  </button>

                  <ButtonUtility
                    size="sm"
                    color="secondary"
                    icon={ArrowLeft}
                    tooltip="תרגיל הבא"
                    isDisabled={safeExIdx >= visibleExercises.length - 1}
                    onPress={() => goToExercise(safeExIdx + 1, 0)}
                  />
                </div>
              );
            })()}
        </div>
      </header>

      {/* START WORKOUT SCREEN (before workout starts) */}
      {!isWorkoutActive && isWorkoutTab && (
        <StartWorkoutView
          currentTab={currentTab === 'workoutB' || currentTab === 'all' ? currentTab : 'workoutA'}
          muscleFilter={muscleFilter}
          exercises={visibleExercises}
          totalSets={totalSetsInView}
          setupMessage={currentSetupMessage}
          lastSessionForTab={lastSessionForTab}
          getLastExerciseLog={getLastExerciseLog}
          onStartWorkout={startWorkout}
          onOpenGuide={() => setGuideModalOpen(true)}
          colors={colors}
        />
      )}

      {/* MAIN WORKOUT STAGE (only when workout is active) */}
      {isWorkoutActive && isWorkoutTab && (
        <main
          className={`flex min-h-0 flex-1 flex-col ${
            isWide ? 'overflow-hidden px-4 py-3' : 'overflow-y-auto px-2.5 pt-2 pb-4'
          }`}
        >
          <div
            className={`mx-auto flex w-full max-w-5xl flex-col ${
              isWide ? 'min-h-0 flex-1' : ''
            }`}
          >
            {activeEx ? (
              (() => {
                const ex = activeEx;
                const idx = safeExIdx;
                const effectiveSets = activeEffectiveSets;
                const setNum = activeSetNum;
                const effectiveMode = getEffectiveMode(ex);
                const exConfigs = getConfigsForExercise(ex);
                const { doneCount: exDoneCount, allDone: exAllDone, bestWeightToday } =
                  getExerciseDoneStats(ex);
                const entry = getSetEntry(ex, setNum);
                const setCfg =
                  exConfigs.find((c) => c.totalWeight === entry.weight) || exConfigs[0];
                const curCfgIdx = exConfigs.findIndex((c) => c.totalWeight === entry.weight);
                const atMin = curCfgIdx <= 0;
                const atMax = curCfgIdx >= exConfigs.length - 1;

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

                const anchorIdx =
                  curCfgIdx >= 0
                    ? curCfgIdx
                    : Math.max(0, exConfigs.findIndex((c) => c.totalWeight >= entry.weight));
                const maxQuickWeights = 4;
                const hasMoreWeights = exConfigs.length > maxQuickWeights;
                const windowStart = Math.max(
                  0,
                  Math.min(exConfigs.length - maxQuickWeights, anchorIdx - 1)
                );
                const visibleConfigs = hasMoreWeights
                  ? exConfigs.slice(windowStart, windowStart + maxQuickWeights)
                  : exConfigs;

                const renderSingleSetWorkspace = () => (
                  <div className="flex flex-col gap-2">
                    {/* Set Selector Pills + Equipment Toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto py-0.5">
                        {Array.from({ length: effectiveSets }, (_, i) => i + 1).map((sIdxNum) => {
                          const sEntry = getSetEntry(ex, sIdxNum);
                          const isActiveSet = sIdxNum === setNum;
                          return (
                            <Button
                              key={sIdxNum}
                              size="xs"
                              color={isActiveSet ? 'primary' : 'secondary'}
                              iconLeading={sEntry.done ? Check : undefined}
                              onPress={() => setCurrentSetIdx(sIdxNum - 1)}
                              className={
                                !isActiveSet && sEntry.done
                                  ? 'bg-success-primary text-success-primary ring-utility-green-300'
                                  : undefined
                              }
                            >
                              סט {sIdxNum}
                            </Button>
                          );
                        })}
                      </div>

                      {ex.allowBarbellToggle && (
                        <ButtonGroup
                          size="sm"
                          selectedKeys={[effectiveMode]}
                          onSelectionChange={(keys) => {
                            const next = Array.from(keys)[0] as EquipmentMode | undefined;
                            if (next) setExerciseEquipmentMode(ex, next);
                          }}
                        >
                          <ButtonGroupItem
                            id="pair"
                            className="px-2.5 py-1.5 text-xs selected:bg-brand-solid selected:text-white"
                          >
                            2 משקולות יד
                          </ButtonGroupItem>
                          <ButtonGroupItem
                            id="barbell"
                            className="px-2.5 py-1.5 text-xs selected:bg-brand-solid selected:text-white"
                          >
                            מוט ארוך
                          </ButtonGroupItem>
                        </ButtonGroup>
                      )}
                    </div>

                    {/* Weight + Reps Controls Panel */}
                    <div
                      className={`flex flex-col gap-2 rounded-xl bg-secondary_alt p-2.5 ring-1 ${
                        entry.done ? 'ring-utility-green-300' : 'ring-secondary'
                      }`}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {/* Weight Sub-Card */}
                        <div
                          className={`flex flex-col justify-between gap-1.5 rounded-xl bg-primary p-2.5 shadow-xs ring-1 ${
                            exConfigs.length > 1 ? 'ring-utility-brand-200' : 'ring-secondary'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1 text-xs font-semibold text-tertiary">
                              <Scales02 className="size-3.5 text-fg-quaternary" />
                              <span>משקל</span>
                            </span>
                            {effectiveSets > 1 && exConfigs.length > 1 && (
                              <Button
                                size="xs"
                                color="link-color"
                                iconLeading={RefreshCw01}
                                onPress={() => selectWeightForExercise(ex, entry.weight)}
                                className="text-[11px]"
                              >
                                לכל הסטים
                              </Button>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <ButtonUtility
                              size="sm"
                              color="secondary"
                              icon={Minus}
                              tooltip="הפחת משקל"
                              isDisabled={atMin}
                              onPress={() => stepSupportedWeight(ex, setNum, -1)}
                              className="size-8 rounded-lg sm:size-9"
                            />

                            <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
                              <span className="truncate text-lg font-bold leading-none text-primary sm:text-xl">
                                {entry.weight === 0 ? 'גוף' : `${entry.weight}`}
                              </span>
                              <span className="text-[10px] font-medium text-tertiary sm:text-[11px]">
                                {entry.weight === 0 ? 'ללא משקולת' : 'קילוגרם'}
                              </span>
                            </div>

                            <ButtonUtility
                              size="sm"
                              color="secondary"
                              icon={Plus}
                              tooltip="הוסף משקל"
                              isDisabled={atMax}
                              onPress={() => stepSupportedWeight(ex, setNum, 1)}
                              className="size-8 rounded-lg sm:size-9"
                            />
                          </div>
                        </div>

                        {/* Reps Sub-Card */}
                        <div className="flex flex-col justify-between gap-1.5 rounded-xl bg-primary p-2 shadow-xs ring-1 ring-secondary sm:p-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <Repeat02 className="size-3.5 text-fg-quaternary" />
                            <span className="text-xs font-semibold text-tertiary">חזרות</span>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <ButtonUtility
                              size="sm"
                              color="secondary"
                              icon={Minus}
                              tooltip="פחות חזרה"
                              onPress={() => stepReps(ex, setNum, -1)}
                              className="size-8 rounded-lg sm:size-9"
                            />

                            <input
                              type="number"
                              inputMode="numeric"
                              aria-label="מספר חזרות"
                              value={entry.reps}
                              onChange={(e) => updateRepsText(ex, setNum, e.target.value)}
                              className="h-8 min-w-0 flex-1 rounded-lg bg-secondary_alt text-center text-md font-bold text-primary ring-1 ring-primary ring-inset focus:ring-2 focus:ring-brand focus:outline-hidden sm:h-9 sm:text-lg"
                            />

                            <ButtonUtility
                              size="sm"
                              color="secondary"
                              icon={Plus}
                              tooltip="עוד חזרה"
                              onPress={() => stepReps(ex, setNum, 1)}
                              className="size-8 rounded-lg sm:size-9"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quick Weight Strip */}
                      {exConfigs.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          {visibleConfigs.map((cfg) => {
                            const selected = cfg.totalWeight === entry.weight;
                            return (
                              <Button
                                key={cfg.totalWeight}
                                size="xs"
                                color={selected ? 'primary' : 'secondary'}
                                onPress={() => selectWeightForSet(ex, setNum, cfg.totalWeight)}
                                className="min-w-0 flex-1 px-1.5"
                              >
                                {cfg.totalWeight === 0 ? '0' : `${cfg.totalWeight}`}
                              </Button>
                            );
                          })}
                          {hasMoreWeights && (
                            <Button
                              size="xs"
                              color="secondary"
                              iconTrailing={ChevronDown}
                              onPress={() => setWeightsModalOpen(true)}
                              className="shrink-0 bg-brand-primary_alt text-brand-secondary ring-utility-brand-300"
                            >
                              עוד ({exConfigs.length})
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Set Completion CTA */}
                      <Button
                        size="md"
                        color={entry.done ? 'secondary' : 'primary'}
                        iconLeading={entry.done ? CheckCircle : Check}
                        onPress={() => toggleSetDone(ex, setNum)}
                        className={`w-full ${
                          entry.done
                            ? 'bg-success-primary text-success-primary ring-utility-green-300 hover:bg-success-primary'
                            : ''
                        }`}
                      >
                        {entry.done ? `סט ${setNum} בוצע (לחץ לביטול)` : `סמן סט ${setNum} כבוצע`}
                      </Button>
                    </div>

                    {/* Visual Equipment & Animation Section */}
                    {isWide ? (
                      <div className="flex flex-1 items-center justify-center rounded-xl bg-secondary_alt p-1.5 ring-1 ring-secondary">
                        <EquipmentBuildDiagram
                          compact
                          cfg={setCfg}
                          mode={effectiveMode}
                          paused={animPaused}
                          colors={colors}
                          fontsLoaded={fontsLoaded}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-center overflow-hidden rounded-xl bg-secondary_alt p-1 ring-1 ring-secondary">
                          <ExerciseAnimation
                            compact
                            micro
                            exercise={ex}
                            paused={animPaused}
                            colors={colors}
                            fontsLoaded={fontsLoaded}
                          />
                        </div>
                        <div className="flex items-center justify-center overflow-hidden rounded-xl bg-secondary_alt p-1 ring-1 ring-secondary">
                          <EquipmentBuildDiagram
                            compact
                            micro
                            cfg={setCfg}
                            mode={effectiveMode}
                            paused={animPaused}
                            colors={colors}
                            fontsLoaded={fontsLoaded}
                          />
                        </div>
                      </div>
                    )}

                    {/* Mobile Steps & Video Triggers */}
                    {!isWide && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          size="xs"
                          color="secondary"
                          iconLeading={List}
                          onPress={() => setExerciseStepsModalOpen(true)}
                          className="flex-1 bg-brand-primary_alt text-brand-secondary ring-utility-brand-300"
                        >
                          שלבים וטיפים ({ex.steps.length})
                        </Button>
                        {ex.videos.map((v, vIdx) => (
                          <Button
                            key={v.url}
                            href={v.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            size="xs"
                            color="secondary"
                            iconLeading={PlayCircle}
                            iconTrailing={ArrowUpRight}
                          >
                            {ex.videos.length > 1 ? `סרטון ${vIdx + 1}` : 'סרטון הדגמה'}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );

                return (
                  <div
                    key={ex.id}
                    className={`flex flex-col gap-2.5 rounded-2xl bg-primary shadow-xs ring-1 ring-secondary ${
                      isWide ? 'min-h-0 flex-1 overflow-hidden p-3.5' : 'p-3'
                    }`}
                  >
                    {/* Card Header (Clean - NO ExerciseGifIcon inside card) */}
                    {isWide ? (
                      <div className="flex items-center justify-between gap-3 border-b border-secondary pb-2.5">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <h1 className="truncate text-lg font-bold text-primary">
                            {idx + 1}. {ex.name}
                          </h1>
                          <p className="truncate text-xs text-tertiary">{conciseMetaText}</p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Badge size="md" color="brand">
                            סט {setNum} מתוך {effectiveSets}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => startTimer(ex.restSec)}
                            className="cursor-pointer rounded-full transition hover:opacity-85"
                            title="הפעל טיימר מנוחה"
                          >
                            <BadgeWithIcon size="md" color="warning" iconLeading={Clock}>
                              מנוחה: {ex.restSec} שניות
                            </BadgeWithIcon>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 border-b border-secondary pb-2.5">
                        <div className="flex items-center gap-1.5">
                          <ButtonUtility
                            size="xs"
                            color="secondary"
                            icon={ArrowRight}
                            tooltip="תרגיל קודם"
                            isDisabled={safeExIdx <= 0}
                            onPress={() => goToExercise(safeExIdx - 1, 0)}
                          />

                          <button
                            type="button"
                            onClick={() => setExerciseDropdownOpen(true)}
                            className={`flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-lg bg-secondary_alt px-2.5 py-1.5 ring-1 transition ${
                              exerciseDropdownOpen ? 'ring-2 ring-brand' : 'ring-secondary'
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <Badge size="sm" color={exAllDone ? 'success' : 'brand'}>
                                {safeExIdx + 1}/{visibleExercises.length}
                              </Badge>
                              <span className="truncate text-sm font-bold text-primary">
                                {ex.shortName}
                              </span>
                            </div>
                            <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-brand-secondary">
                              <span>
                                {exDoneCount}/{effectiveSets}
                              </span>
                              <ChevronDown className="size-3.5" />
                            </span>
                          </button>

                          <ButtonUtility
                            size="xs"
                            color="secondary"
                            icon={ArrowLeft}
                            tooltip="תרגיל הבא"
                            isDisabled={safeExIdx >= visibleExercises.length - 1}
                            onPress={() => goToExercise(safeExIdx + 1, 0)}
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="min-w-0 flex-1 truncate text-[11px] text-tertiary">
                            {conciseMetaText}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Badge size="sm" color="brand">
                              סט {setNum}/{effectiveSets}
                            </Badge>
                            <button
                              type="button"
                              onClick={() => startTimer(ex.restSec)}
                              className="cursor-pointer rounded-full"
                            >
                              <BadgeWithIcon size="sm" color="warning" iconLeading={Clock}>
                                מנוחה: {ex.restSec} שניות
                              </BadgeWithIcon>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {isWide ? (
                      <>
                        <ExerciseTrendCard
                          compact
                          exerciseId={ex.id}
                          workoutHistory={sortedHistoryDesc}
                          liveBestWeight={bestWeightToday}
                          colors={colors}
                          fontsLoaded={fontsLoaded}
                        />
                        <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
                          {/* Exercise Visual + Steps & Videos (Right in RTL -> cols 5) */}
                          <div className="col-span-5 flex min-h-0 flex-col justify-between gap-2.5">
                            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-secondary_alt p-2 ring-1 ring-secondary">
                              <ExerciseAnimation
                                compact
                                exercise={ex}
                                paused={animPaused}
                                colors={colors}
                                fontsLoaded={fontsLoaded}
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button
                                size="xs"
                                color="secondary"
                                iconLeading={List}
                                onPress={() => setExerciseStepsModalOpen(true)}
                                className="flex-1 bg-brand-primary_alt text-brand-secondary ring-utility-brand-300"
                              >
                                שלבי ביצוע וטיפים ({ex.steps.length})
                              </Button>
                              {ex.videos.map((v) => (
                                <Button
                                  key={v.url}
                                  href={v.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  size="xs"
                                  color="secondary"
                                  iconLeading={PlayCircle}
                                  iconTrailing={ArrowUpRight}
                                >
                                  {v.label}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* Active Set Controls & Weight Diagram (Left in RTL -> cols 7) */}
                          <div className="col-span-7 flex min-h-0 flex-col justify-between">
                            {renderSingleSetWorkspace()}
                          </div>
                        </div>
                      </>
                    ) : (
                      renderSingleSetWorkspace()
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="rounded-2xl bg-primary p-6 text-center text-sm text-tertiary ring-1 ring-secondary">
                לא נמצאו תרגילים בסינון הנוכחי. בחר קבוצת שריר אחרת למעלה.
              </div>
            )}
          </div>
        </main>
      )}

      {/* PROGRESS & WORKOUT LOG TAB */}
      {!isWorkoutTab && (
        <ProgressView
          progressStats={progressStats}
          chartExerciseId={chartExerciseId}
          onSelectChartExercise={setChartExerciseId}
          sortedHistoryDesc={sortedHistoryDesc}
          syncStatus={syncStatus}
          importModalOpen={importModalOpen}
          onToggleImportModal={() => setImportModalOpen((o) => !o)}
          importJsonText={importJsonText}
          onChangeImportJsonText={setImportJsonText}
          onExportBackup={handleExportBackup}
          onApplyImportJson={handleApplyImportJson}
          onDeleteSession={handleDeleteSession}
          colors={colors}
          fontsLoaded={fontsLoaded}
        />
      )}

      {/* PERSISTENT BOTTOM DOCK WHEN WORKOUT IS ACTIVE: NAVIGATION + PER-SET REST TIMER */}
      {isWorkoutActive && (
        <footer className="shrink-0 border-t border-secondary bg-primary px-2.5 py-2 sm:px-4 sm:py-2.5">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
            {isWorkoutTab && activeEx && (
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  color="secondary"
                  iconLeading={ArrowRight}
                  isDisabled={isAtVeryStart}
                  onPress={goPrevStep}
                  className="w-full"
                >
                  {prevBtnLabel}
                </Button>

                <Button
                  size="sm"
                  color="secondary"
                  iconLeading={Save01}
                  onPress={() => {
                    setSaveFeedback(null);
                    setSaveModalOpen(true);
                  }}
                  className={`w-full ${
                    totalDoneInView > 0
                      ? 'bg-brand-primary_alt text-brand-secondary ring-utility-brand-300'
                      : ''
                  }`}
                >
                  סיים ושמור ({totalDoneInView}/{totalSetsInView})
                </Button>

                <Button
                  size="sm"
                  color="primary"
                  iconTrailing={isAtVeryEnd ? Flag01 : ArrowLeft}
                  onPress={goNextStep}
                  className={`w-full ${
                    isAtVeryEnd ? 'bg-bg-success-solid hover:bg-bg-success-solid' : ''
                  }`}
                >
                  {nextBtnLabel}
                </Button>
              </div>
            )}

            {/* Per-Set Rest Watch + Live Progress Stats Row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ring-1 ${
                  timerFinished
                    ? 'bg-success-primary ring-utility-green-300'
                    : 'bg-secondary_alt ring-secondary'
                }`}
              >
                <span
                  className={`flex items-center gap-1 font-mono text-xs font-bold sm:text-sm ${
                    timerFinished ? 'text-success-primary' : 'text-primary'
                  }`}
                >
                  {timerFinished ? (
                    <CheckCircle className="size-3.5 shrink-0" />
                  ) : (
                    <Clock className="size-3.5 shrink-0 text-fg-brand-primary" />
                  )}
                  <span className="font-sans text-[11px] font-semibold text-tertiary">
                    מנוחה לסט:
                  </span>
                  <span>{timerFinished ? 'המשך!' : formatTime(timerSeconds)}</span>
                </span>

                <Button
                  size="xs"
                  color={timerRunning ? 'primary-destructive' : 'primary'}
                  onPress={toggleTimer}
                  className="px-2.5 py-1 text-xs"
                >
                  {timerRunning ? 'עצור' : 'הפעל'}
                </Button>
                <Button
                  size="xs"
                  color="secondary"
                  onPress={() => startTimer(60)}
                  className="px-2 py-1 text-xs"
                >
                  60 שניות
                </Button>
                <Button
                  size="xs"
                  color="secondary"
                  onPress={() => startTimer(90)}
                  className="px-2 py-1 text-xs"
                >
                  90 שניות
                </Button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (currentTab !== 'progress') selectMainTab('progress');
                }}
                className="cursor-pointer rounded-full transition hover:opacity-85"
              >
                <BadgeWithIcon size="sm" color="gray" type="modern" iconLeading={Award01}>
                  {isWide
                    ? `${totalSetsInView > 0 ? `סטים: ${totalDoneInView}/${totalSetsInView} • ` : ''}${progressStats.weekWorkouts} השבוע • ${progressStats.totalWorkouts} אימונים`
                    : totalSetsInView > 0
                    ? `${totalDoneInView}/${totalSetsInView} • ${progressStats.totalWorkouts} אימונים`
                    : `${progressStats.totalWorkouts} אימונים`}
                </BadgeWithIcon>
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* MODALS (Untitled UI ModalOverlay + Modal + Dialog) */}
      <ExerciseSwitcherModal
        isOpen={exerciseDropdownOpen}
        onClose={() => setExerciseDropdownOpen(false)}
        visibleExercises={visibleExercises}
        safeExIdx={safeExIdx}
        getExerciseDoneStats={getExerciseDoneStats}
        getLastExerciseLog={getLastExerciseLog}
        onSelectExercise={(idx) => goToExercise(idx, 0)}
        colors={colors}
      />

      <WeightsPickerModal
        isOpen={weightsModalOpen}
        onClose={() => setWeightsModalOpen(false)}
        activeEx={activeEx}
        activeSetNum={activeSetNum}
        activeEffectiveSets={activeEffectiveSets}
        modalConfigs={activeEx ? getConfigsForExercise(activeEx) : []}
        modalMode={activeEx ? getEffectiveMode(activeEx) : 'pair'}
        modalEntry={activeEx ? getSetEntry(activeEx, activeSetNum) : null}
        workoutHistory={sortedHistoryDesc}
        colors={colors}
        onSelectWeightForSet={selectWeightForSet}
        onSelectWeightForAllSets={selectWeightForExercise}
      />

      <ExerciseStepsModal
        isOpen={exerciseStepsModalOpen}
        onClose={() => setExerciseStepsModalOpen(false)}
        activeEx={activeEx}
        colors={colors}
      />

      <GuideModal
        isOpen={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        timerRunning={timerRunning}
        timerFinished={timerFinished}
        timerSeconds={timerSeconds}
        currentSetupMessage={currentSetupMessage}
        onClearSetCheckmarks={clearSetCheckmarks}
      />

      <SaveWorkoutModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        timerRunning={timerRunning}
        timerFinished={timerFinished}
        timerSeconds={timerSeconds}
        workoutElapsedSec={workoutElapsedSec}
        totalDoneInView={totalDoneInView}
        totalSetsInView={totalSetsInView}
        workoutNote={workoutNote}
        onChangeWorkoutNote={setWorkoutNote}
        saveFeedback={saveFeedback}
        onDiscardWorkout={requestDiscardWorkout}
        onSaveWorkoutSession={handleSaveWorkoutSession}
      />

      <DiscardWorkoutModal
        isOpen={discardModalOpen}
        onClose={() => setDiscardModalOpen(false)}
        workoutElapsedSec={workoutElapsedSec}
        totalDoneInView={totalDoneInView}
        onConfirmDiscard={performDiscardWorkout}
      />
    </div>
  );
}
