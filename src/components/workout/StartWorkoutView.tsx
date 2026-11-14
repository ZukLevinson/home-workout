import React from 'react';
import {
  Activity,
  Award01,
  BookOpen01,
  Calendar,
  Clock,
  Play,
  Repeat02,
  Zap,
} from '@untitledui/icons';
import { Badge, BadgeWithIcon } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import ExerciseGifIcon from '../ExerciseGifIcon';
import { WORKOUT_NAMES_MAP } from '../../data/exercises';
import type { Exercise, SetupMessage, ThemeColors, WorkoutSession } from '../../types';

export interface StartWorkoutViewProps {
  currentTab: 'workoutA' | 'workoutB' | 'all';
  muscleFilter: string;
  exercises: Exercise[];
  totalSets: number;
  setupMessage?: SetupMessage;
  lastSessionForTab: WorkoutSession | null;
  getLastExerciseLog: (exId: string) => { date?: string; sets: { weight: number }[] } | null;
  onStartWorkout: (startExIdx?: number) => void;
  onOpenGuide: () => void;
  colors: ThemeColors;
}

export function StartWorkoutView({
  currentTab,
  muscleFilter,
  exercises,
  totalSets,
  setupMessage,
  lastSessionForTab,
  getLastExerciseLog,
  onStartWorkout,
  onOpenGuide,
  colors,
}: StartWorkoutViewProps) {
  const workoutTitle =
    currentTab === 'all'
      ? muscleFilter === 'all'
        ? 'אימון חופשי: כל התרגילים'
        : `אימון ממוקד: ${muscleFilter}`
      : WORKOUT_NAMES_MAP[currentTab] || 'אימון כוח';

  const setupDesc = setupMessage
    ? setupMessage.desc
    : 'בחר קבוצת שריר למעלה או התחל ישירות — שעון האימון יתחיל לרוץ מרגע הלחיצה ותוכל לסיים או לבטל בכל עת.';

  const estimatedMinutes = Math.max(10, Math.round(totalSets * 2.3));

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 py-3 sm:px-5 sm:py-5">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3.5 pb-6 sm:gap-4">
        {/* Start Workout Hero Card */}
        <section className="flex flex-col gap-4 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <FeaturedIcon icon={Activity} size="lg" color="brand" theme="modern" />
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <BadgeWithIcon size="sm" color="brand" iconLeading={Zap}>
                    מוכן להתחלה
                  </BadgeWithIcon>
                  <Badge size="sm" color="gray" type="modern">
                    {exercises.length} תרגילים • {totalSets} סטים
                  </Badge>
                  <BadgeWithIcon size="sm" color="gray" type="modern" iconLeading={Clock}>
                    כ-{estimatedMinutes} דקות
                  </BadgeWithIcon>
                </div>

                <h1 className="text-lg font-bold text-primary sm:text-display-xs">
                  {workoutTitle}
                </h1>
                <p className="max-w-2xl text-xs leading-relaxed text-tertiary sm:text-sm">
                  {setupDesc}
                </p>
              </div>
            </div>

            {lastSessionForTab?.displayDate && (
              <BadgeWithIcon size="sm" color="success" iconLeading={Calendar}>
                אימון קודם: {lastSessionForTab.displayDate}
              </BadgeWithIcon>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-secondary_alt p-3 ring-1 ring-secondary sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-primary sm:text-sm">
                מדידת זמן אימון רציפה + טיימר מנוחה לכל סט
              </span>
              <span className="text-xs text-tertiary">
                הזמן הכולל של האימון ירוץ מרגע ההתחלה; ניתן לסיים, לשמור או לבטל בכל שלב.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="md"
                color="secondary"
                iconLeading={BookOpen01}
                onPress={onOpenGuide}
              >
                ציוד ומדריך
              </Button>
              <Button
                size="lg"
                color="primary"
                iconLeading={Play}
                isDisabled={exercises.length === 0}
                onPress={() => onStartWorkout(0)}
                className="flex-1 sm:flex-none"
              >
                התחל אימון
              </Button>
            </div>
          </div>
        </section>

        {/* Workout Plan Exercise Preview */}
        <section className="flex flex-col gap-3 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-secondary pb-3">
            <div className="flex items-center gap-2">
              <FeaturedIcon icon={Repeat02} size="sm" color="gray" theme="modern" />
              <div className="flex flex-col">
                <h2 className="text-sm font-bold text-primary sm:text-md">
                  תרגילים באימון ({exercises.length})
                </h2>
                <p className="text-xs text-tertiary">
                  לחץ על &quot;התחל אימון&quot; למעלה או על תרגיל ספציפי כדי להתחיל ממנו
                </p>
              </div>
            </div>

            <Badge size="sm" color="gray" type="modern">
              סך הכל {totalSets} סטים
            </Badge>
          </div>

          {exercises.length === 0 ? (
            <div className="rounded-xl bg-secondary_alt p-6 text-center text-sm text-tertiary ring-1 ring-secondary">
              לא נמצאו תרגילים בסינון הנוכחי. בחר קבוצת שריר אחרת למעלה.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {exercises.map((ex, idx) => {
                const lastLog = getLastExerciseLog(ex.id);
                const lastBestWeight =
                  lastLog && lastLog.sets.length > 0
                    ? Math.max(...lastLog.sets.map((s) => s.weight))
                    : null;
                const repMatch = ex.reps.match(/\d+\s*(?:עד|-)\s*\d+/);
                const shortReps = repMatch
                  ? `${repMatch[0].replace(/\s*עד\s*/, '–')} חזרות`
                  : `${ex.defaultReps} חזרות`;

                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => onStartWorkout(idx)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl bg-secondary_alt p-2.5 text-start ring-1 ring-secondary transition duration-100 hover:bg-primary_hover hover:ring-brand"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <ExerciseGifIcon
                        exerciseId={ex.id}
                        size={44}
                        borderColor={colors.border}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-xs font-bold text-primary sm:text-sm">
                          {idx + 1}. {ex.shortName}
                        </span>
                        <span className="truncate text-[11px] text-tertiary">
                          {ex.muscle} • {ex.sets} סטים • {shortReps} • מנוחה {ex.restSec} שניות
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <BadgeWithIcon
                        size="sm"
                        color={lastBestWeight !== null ? 'brand' : 'gray'}
                        type={lastBestWeight !== null ? 'pill-color' : 'modern'}
                        iconLeading={lastBestWeight !== null ? Award01 : undefined}
                      >
                        {lastBestWeight !== null
                          ? `${lastBestWeight} קילוגרם`
                          : `${ex.defaultWeight} קילוגרם`}
                      </BadgeWithIcon>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
