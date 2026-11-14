export type ThemeMode = 'light' | 'dark' | null | undefined;

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  border: string;
  primary: string;
  primaryForeground: string;
  primarySoft: string;
  secondary: string;
  secondaryForeground: string;
  mutedForeground: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
}

export type EquipmentMode = 'pair' | 'single' | 'barbell' | 'platePair' | 'bodyweight';

export type WorkoutTabKey = 'workoutA' | 'workoutB' | 'express' | 'progress' | 'all' | 'calculator';

export interface ExerciseVideo {
  label: string;
  url: string;
}

export interface Exercise {
  id: string;
  workouts: ('workoutA' | 'workoutB' | 'express')[];
  orderA?: number;
  orderB?: number;
  orderExpress?: number;
  name: string;
  muscle: string;
  secondaryMuscles: string;
  equipment: string;
  equipmentMode: EquipmentMode;
  allowBarbellToggle?: boolean;
  sets: number;
  reps: string;
  defaultWeight: number;
  defaultReps: number;
  weightUnitLabel: string;
  tempo: string;
  restSec: number;
  animKeys: string[];
  animLabels?: string[];
  videos: ExerciseVideo[];
  steps: string[];
  homeTip: string;
  avoid: string;
}

export interface PlateConfig {
  totalWeight: number;
  barWeight: number;
  sideWeight: number;
  c5: number;
  c25: number;
  c125: number;
  c05: number;
  totalPlatesSide: number;
  mode: EquipmentMode;
}

export interface SetEntry {
  weight: number;
  reps: number;
  done: boolean;
}

export interface ModeOverrideEntry {
  mode: EquipmentMode;
}

export type ActiveDraft = Record<string, SetEntry | ModeOverrideEntry | undefined>;

export interface LoggedSet {
  setNum: number;
  weight: number;
  reps: number;
}

export interface LoggedExerciseItem {
  exId: string;
  exName: string;
  sets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  isoDate?: string;
  createdAtMs?: number;
  displayDate?: string;
  workoutTab?: string;
  workoutTitle?: string;
  note?: string;
  totalSets?: number;
  items?: LoggedExerciseItem[];
}

export interface SyncStatus {
  mode: 'connecting' | 'cloud' | 'local';
  message: string;
}

export interface GlossaryItem {
  title: string;
  body: string;
}

export interface WeeklyScheduleDay {
  day: string;
  label: string;
  highlight: 'primary' | 'secondary' | 'card';
}

export interface SetupMessage {
  title: string;
  desc: string;
}
