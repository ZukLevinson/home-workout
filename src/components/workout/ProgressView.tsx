import React from 'react';
import {
  Activity,
  Award01,
  BarChart02,
  Calendar,
  Clock,
  Download01,
  File02,
  Trash01,
  Upload01,
} from '@untitledui/icons';
import { Badge, BadgeWithIcon } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { TextArea } from '@/components/base/textarea/textarea';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import ExerciseGifIcon from '../ExerciseGifIcon';
import ProgressChart from '../ProgressChart';
import { formatElapsedDuration } from './Modals';
import { EXERCISES } from '../../data/exercises';
import type { SyncStatus, ThemeColors, WorkoutSession } from '../../types';

export interface ProgressViewProps {
  progressStats: {
    totalWorkouts: number;
    weekWorkouts: number;
    totalSets: number;
  };
  chartExerciseId: string;
  onSelectChartExercise: (exId: string) => void;
  sortedHistoryDesc: WorkoutSession[];
  syncStatus: SyncStatus;
  importModalOpen: boolean;
  onToggleImportModal: () => void;
  importJsonText: string;
  onChangeImportJsonText: (val: string) => void;
  onExportBackup: () => void;
  onApplyImportJson: () => void;
  onDeleteSession: (sessionId: string) => void;
  colors: ThemeColors;
  fontsLoaded: boolean;
}

export function ProgressView({
  progressStats,
  chartExerciseId,
  onSelectChartExercise,
  sortedHistoryDesc,
  syncStatus,
  importModalOpen,
  onToggleImportModal,
  importJsonText,
  onChangeImportJsonText,
  onExportBackup,
  onApplyImportJson,
  onDeleteSession,
  colors,
  fontsLoaded,
}: ProgressViewProps) {
  const selectedEx = EXERCISES.find((e) => e.id === chartExerciseId);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-6">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-tertiary">אימונים ששמרת ביומן</span>
              <span className="text-display-xs font-bold text-primary">
                {progressStats.totalWorkouts}
              </span>
            </div>
            <FeaturedIcon icon={Calendar} size="md" color="gray" theme="modern" />
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-tertiary">אימונים ב-7 הימים האחרונים</span>
              <span className="text-display-xs font-bold text-brand-secondary">
                {progressStats.weekWorkouts}
              </span>
            </div>
            <FeaturedIcon icon={Activity} size="md" color="brand" theme="modern" />
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-tertiary">סך הכל סטים שביצעת</span>
              <span className="text-display-xs font-bold text-primary">
                {progressStats.totalSets}
              </span>
            </div>
            <FeaturedIcon icon={Award01} size="md" color="success" theme="modern" />
          </div>
        </div>

        {/* Weight Progression Chart Card */}
        <div className="flex flex-col gap-3.5 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <FeaturedIcon icon={BarChart02} size="sm" color="brand" theme="modern" />
              <div className="flex flex-col">
                <h2 className="text-sm font-bold text-primary sm:text-md">
                  גרף התקדמות במשקלים לפי תרגיל
                </h2>
                <p className="text-xs text-tertiary">
                  בחר תרגיל כדי לצפות בעליית המשקל מאימון לאימון
                </p>
              </div>
            </div>
            {selectedEx && (
              <Badge size="sm" color="brand">
                {selectedEx.name} • {selectedEx.muscle}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {EXERCISES.map((ex, i) => {
              const active = chartExerciseId === ex.id;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => onSelectChartExercise(ex.id)}
                  className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl p-2 text-center transition duration-100 ring-1 ring-inset ${
                    active
                      ? 'bg-brand-primary_alt ring-2 ring-brand'
                      : 'bg-secondary_alt ring-secondary hover:bg-primary_hover'
                  }`}
                >
                  <ExerciseGifIcon
                    exerciseId={ex.id}
                    size={56}
                    active={active}
                    borderColor={colors.border}
                    activeBorderColor={colors.primary}
                  />
                  <span
                    className={`line-clamp-1 text-xs font-semibold ${
                      active ? 'text-brand-secondary' : 'text-primary'
                    }`}
                  >
                    {i + 1}. {ex.shortName}
                  </span>
                </button>
              );
            })}
          </div>

          <ProgressChart
            exerciseId={chartExerciseId}
            workoutHistory={sortedHistoryDesc}
            colors={colors}
            fontsLoaded={fontsLoaded}
          />
        </div>

        {/* Workout Log + Cloud Sync / JSON Backup */}
        <div className="flex flex-col gap-3.5 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary pb-3.5">
            <div className="flex items-center gap-2.5">
              <FeaturedIcon icon={Calendar} size="sm" color="gray" theme="modern" />
              <div className="flex flex-col">
                <h2 className="text-sm font-bold text-primary sm:text-md">יומן האימונים שלך</h2>
                <p className="text-xs text-tertiary">{syncStatus.message}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="xs"
                color="secondary"
                iconLeading={Download01}
                onPress={onExportBackup}
              >
                גיבוי נתונים
              </Button>
              <Button
                size="xs"
                color="secondary"
                iconLeading={Upload01}
                onPress={onToggleImportModal}
              >
                שחזור מגיבוי
              </Button>
            </div>
          </div>

          {importModalOpen && (
            <div className="flex flex-col gap-3 rounded-xl bg-secondary_alt p-3.5 ring-1 ring-secondary">
              <TextArea
                label="הדבק תוכן קובץ גיבוי (JSON)"
                value={importJsonText}
                onChange={onChangeImportJsonText}
                rows={4}
                placeholder='{"workoutHistory": [...]}'
              />
              <div className="flex justify-end">
                <Button size="sm" color="primary" iconLeading={Upload01} onPress={onApplyImportJson}>
                  טען גיבוי
                </Button>
              </div>
            </div>
          )}

          {sortedHistoryDesc.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 rounded-xl bg-secondary_alt px-4 py-8 text-center ring-1 ring-secondary">
              <FeaturedIcon icon={Calendar} size="lg" color="gray" theme="modern" />
              <div className="flex max-w-md flex-col gap-1">
                <h3 className="text-sm font-bold text-primary">עדיין לא שמרת אימונים ביומן</h3>
                <p className="text-xs leading-relaxed text-tertiary">
                  בחר אימון בלשוניות למעלה, סמן את הסטים שביצעת עם המשקל ומספר החזרות, ולחץ בתחתית
                  העמוד על שמירה כדי לתעד את ההתקדמות.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedHistoryDesc.map((sess) => (
                <div
                  key={sess.id}
                  className="flex flex-col gap-3 rounded-xl bg-secondary_alt p-3.5 ring-1 ring-secondary"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-secondary pb-2.5">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-primary">{sess.workoutTitle}</h3>
                        {typeof sess.durationSec === 'number' && sess.durationSec > 0 && (
                          <BadgeWithIcon size="sm" color="brand" iconLeading={Clock}>
                            משך: {formatElapsedDuration(sess.durationSec)}
                          </BadgeWithIcon>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-tertiary">
                        <Calendar className="size-3.5" />
                        <span>{sess.displayDate}</span>
                      </div>
                    </div>

                    <Button
                      size="xs"
                      color="tertiary-destructive"
                      iconLeading={Trash01}
                      onPress={() => onDeleteSession(sess.id)}
                    >
                      מחק רישום
                    </Button>
                  </div>

                  {Boolean(sess.note) && (
                    <div className="flex items-start gap-2 rounded-lg bg-primary px-3 py-2 text-xs text-primary ring-1 ring-secondary">
                      <File02 className="mt-0.5 size-3.5 shrink-0 text-fg-quaternary" />
                      <span>
                        <strong className="font-semibold">הערה: </strong>
                        {sess.note}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    {(sess.items || []).map((item, idx2) => {
                      const exMeta = EXERCISES.find((e) => e.id === item.exId);
                      return (
                        <div
                          key={`${item.exId}-${idx2}`}
                          className="flex items-center gap-3 rounded-lg bg-primary p-2.5 ring-1 ring-secondary"
                        >
                          <ExerciseGifIcon
                            exerciseId={item.exId}
                            size={40}
                            borderColor={colors.border}
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="truncate text-xs font-bold text-primary sm:text-sm">
                              {exMeta ? exMeta.shortName : item.exName}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {(item.sets || []).map((st) => (
                                <Badge key={st.setNum} size="sm" color="gray" type="modern">
                                  סט {st.setNum}: {st.weight} קילוגרם × {st.reps} חזרות
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
