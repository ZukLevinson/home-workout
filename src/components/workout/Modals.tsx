import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen01,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  InfoCircle,
  Lightbulb02,
  List,
  Package,
  PlayCircle,
  RefreshCw01,
  Save01,
  Scales02,
  Trash01,
  Zap,
} from '@untitledui/icons';
import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { Badge, BadgeWithIcon } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { CloseButton } from '@/components/base/buttons/close-button';
import { TextArea } from '@/components/base/textarea/textarea';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import ExerciseGifIcon from '../ExerciseGifIcon';
import { getExerciseTrendSummary } from '../ExerciseTrendCard';
import {
  EQUIPMENT_SUMMARY_ITEMS,
  GLOSSARY_ITEMS,
  WEEKLY_SCHEDULE,
  describeConfigSetup,
} from '../../data/exercises';
import type { EquipmentMode, Exercise, PlateConfig, SetEntry, ThemeColors, WorkoutSession } from '../../types';

function formatTime(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function formatElapsedDuration(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface ExerciseSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  visibleExercises: Exercise[];
  safeExIdx: number;
  getExerciseDoneStats: (ex: Exercise) => {
    doneCount: number;
    effectiveSets: number;
    allDone: boolean;
    bestWeightToday: number;
  };
  getLastExerciseLog: (exId: string) => { date?: string; sets: { weight: number }[] } | null;
  onSelectExercise: (idx: number) => void;
  colors: ThemeColors;
}

export function ExerciseSwitcherModal({
  isOpen,
  onClose,
  visibleExercises,
  safeExIdx,
  getExerciseDoneStats,
  getLastExerciseLog,
  onSelectExercise,
  colors,
}: ExerciseSwitcherModalProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <Modal className="max-w-xl ring-1 ring-secondary">
        <Dialog className="flex max-h-[82dvh] flex-col p-0">
          <div className="flex items-center justify-between gap-3 border-b border-secondary px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2.5">
              <FeaturedIcon icon={Zap} size="sm" color="brand" theme="modern" />
              <div className="flex flex-col">
                <h2 className="text-sm font-bold text-primary sm:text-md">
                  בחר תרגיל ({visibleExercises.length} תרגילים)
                </h2>
                <p className="text-xs text-tertiary">מעבר מהיר בין כל תרגילי האימון</p>
              </div>
            </div>
            <CloseButton onPress={onClose} label="סגור" size="sm" />
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto p-4 sm:p-5">
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
                <button
                  key={itemEx.id}
                  type="button"
                  onClick={() => {
                    onSelectExercise(idx);
                    onClose();
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl p-2.5 text-start transition duration-100 ring-1 ring-inset ${
                    isCur
                      ? 'bg-brand-primary_alt ring-brand'
                      : allDone
                      ? 'bg-success-primary ring-utility-green-300 hover:bg-primary_hover'
                      : 'bg-primary ring-secondary hover:bg-primary_hover'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <ExerciseGifIcon
                      exerciseId={itemEx.id}
                      size={48}
                      active={isCur}
                      borderColor={colors.border}
                      activeBorderColor={colors.primary}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold text-primary">
                        {idx + 1}. {itemEx.shortName}
                      </span>
                      <span className="truncate text-xs text-tertiary">
                        {itemEx.muscle} • {effectiveSets} סטים • {lastSummary}
                      </span>
                    </div>
                  </div>

                  <Badge
                    size="sm"
                    color={allDone ? 'success' : isCur ? 'brand' : 'gray'}
                    type={isCur || allDone ? 'pill-color' : 'modern'}
                  >
                    {allDone ? 'הושלם' : `${doneCount}/${effectiveSets}`}
                  </Badge>
                </button>
              );
            })}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export interface WeightsPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEx: Exercise | null;
  activeSetNum: number;
  activeEffectiveSets: number;
  modalConfigs: PlateConfig[];
  modalMode: EquipmentMode;
  modalEntry: SetEntry | null;
  workoutHistory: WorkoutSession[];
  colors: ThemeColors;
  onSelectWeightForSet: (ex: Exercise, setNum: number, weight: number) => void;
  onSelectWeightForAllSets: (ex: Exercise, weight: number) => void;
}

export function WeightsPickerModal({
  isOpen,
  onClose,
  activeEx,
  activeSetNum,
  activeEffectiveSets,
  modalConfigs,
  modalMode,
  modalEntry,
  workoutHistory,
  colors,
  onSelectWeightForSet,
  onSelectWeightForAllSets,
}: WeightsPickerModalProps) {
  const modalTrend = activeEx
    ? getExerciseTrendSummary(activeEx.id, workoutHistory, colors)
    : null;
  const prevBest = modalTrend?.last ? modalTrend.last.bestWeight : null;

  return (
    <ModalOverlay
      isOpen={isOpen && Boolean(activeEx)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <Modal className="max-w-xl ring-1 ring-secondary">
        <Dialog className="flex max-h-[82dvh] flex-col p-0">
          {activeEx && modalEntry && (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-secondary px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <FeaturedIcon icon={Scales02} size="sm" color="brand" theme="modern" />
                  <div className="flex min-w-0 flex-col">
                    <h2 className="truncate text-sm font-bold text-primary sm:text-md">
                      כל המשקלים הנתמכים ({modalConfigs.length})
                    </h2>
                    <p className="truncate text-xs text-tertiary">
                      {activeEx.name} • סט {activeSetNum}
                      {prevBest !== null ? ` • אימון קודם: ${prevBest} קילוגרם` : ''}
                    </p>
                  </div>
                </div>
                <CloseButton onPress={onClose} label="סגור" size="sm" />
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto p-4 sm:p-5">
                {modalConfigs.map((cfg) => {
                  const isCur = cfg.totalWeight === modalEntry.weight;
                  const isPrev = prevBest !== null && cfg.totalWeight === prevBest;

                  return (
                    <div
                      key={cfg.totalWeight}
                      className={`flex items-center justify-between gap-2.5 rounded-xl p-2.5 ring-1 ring-inset transition duration-100 ${
                        isCur
                          ? 'bg-brand-primary_alt ring-brand'
                          : 'bg-primary ring-secondary hover:bg-primary_hover'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectWeightForSet(activeEx, activeSetNum, cfg.totalWeight);
                          onClose();
                        }}
                        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-start"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`text-sm font-bold ${
                              isCur ? 'text-brand-secondary' : 'text-primary'
                            }`}
                          >
                            {cfg.totalWeight === 0
                              ? '0 קילוגרם (משקל גוף)'
                              : `${cfg.totalWeight} קילוגרם`}
                          </span>
                          {isCur && (
                            <BadgeWithIcon size="sm" color="brand" iconLeading={Check}>
                              נבחר
                            </BadgeWithIcon>
                          )}
                          {isPrev && (
                            <Badge size="sm" color="gray" type="modern">
                              פעם קודמת
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-tertiary">
                          {describeConfigSetup(cfg, modalMode)}
                        </span>
                      </button>

                      {activeEffectiveSets > 1 && (
                        <Button
                          size="xs"
                          color="secondary"
                          iconLeading={RefreshCw01}
                          onPress={() => {
                            onSelectWeightForAllSets(activeEx, cfg.totalWeight);
                            onClose();
                          }}
                        >
                          לכל הסטים
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export interface ExerciseStepsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEx: Exercise | null;
  colors: ThemeColors;
}

export function ExerciseStepsModal({
  isOpen,
  onClose,
  activeEx,
  colors,
}: ExerciseStepsModalProps) {
  return (
    <ModalOverlay
      isOpen={isOpen && Boolean(activeEx)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <Modal className="max-w-xl ring-1 ring-secondary">
        <Dialog className="flex max-h-[84dvh] flex-col p-0">
          {activeEx && (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-secondary px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <ExerciseGifIcon
                    exerciseId={activeEx.id}
                    size={44}
                    active
                    borderColor={colors.border}
                    activeBorderColor={colors.primary}
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h2 className="line-clamp-2 text-sm font-bold text-primary sm:text-md">
                      {activeEx.name}
                    </h2>
                    <p className="truncate text-xs text-tertiary">
                      {activeEx.muscle} • {activeEx.equipment}
                    </p>
                  </div>
                </div>
                <CloseButton onPress={onClose} label="סגור" size="sm" />
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="flex items-start gap-2 rounded-xl bg-secondary_alt p-3 ring-1 ring-secondary">
                    <Clock className="mt-0.5 size-4 shrink-0 text-fg-brand-primary" />
                    <div className="text-xs text-secondary">
                      <span className="font-bold text-primary">קצב תנועה: </span>
                      {activeEx.tempo}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-warning-primary p-3 ring-1 ring-utility-yellow-300">
                    <Clock className="size-4 shrink-0 text-warning-primary" />
                    <span className="text-xs font-bold text-warning-primary">
                      מנוחה בין סט לסט: {activeEx.restSec} שניות
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 rounded-xl bg-secondary_alt p-3.5 ring-1 ring-secondary">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-primary">
                    <List className="size-4 text-fg-brand-primary" />
                    <span>שלבי ביצוע</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {activeEx.steps.map((st, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary ring-1 ring-secondary">
                          {sIdx + 1}
                        </span>
                        <p className="flex-1 text-xs leading-relaxed text-primary sm:text-sm">
                          {st}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="flex items-start gap-2 rounded-xl bg-secondary_alt p-3 ring-1 ring-secondary">
                    <Lightbulb02 className="mt-0.5 size-4 shrink-0 text-success-primary" />
                    <p className="text-xs leading-relaxed text-secondary">
                      <span className="font-bold text-success-primary">למה זה טוב: </span>
                      {activeEx.homeTip}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-secondary_alt p-3 ring-1 ring-secondary">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-error-primary" />
                    <p className="text-xs leading-relaxed text-secondary">
                      <span className="font-bold text-error-primary">ממה להיזהר: </span>
                      {activeEx.avoid}
                    </p>
                  </div>
                </div>

                {activeEx.videos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeEx.videos.map((v) => (
                      <Button
                        key={v.url}
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        color="secondary"
                        iconLeading={PlayCircle}
                        iconTrailing={ArrowUpRight}
                      >
                        {v.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  timerRunning: boolean;
  timerFinished: boolean;
  timerSeconds: number;
  currentSetupMessage?: { title: string; desc: string };
  onClearSetCheckmarks: () => void;
}

export function GuideModal({
  isOpen,
  onClose,
  timerRunning,
  timerFinished,
  timerSeconds,
  currentSetupMessage,
  onClearSetCheckmarks,
}: GuideModalProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <Modal className="max-w-2xl ring-1 ring-secondary">
        <Dialog className="flex max-h-[85dvh] flex-col p-0">
          <div className="flex items-center justify-between gap-3 border-b border-secondary px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2.5">
              <FeaturedIcon icon={BookOpen01} size="sm" color="brand" theme="modern" />
              <h2 className="text-sm font-bold text-primary sm:text-md">
                מדריך, ציוד ולוח שבועי
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {(timerRunning || timerFinished) && (
                <BadgeWithIcon
                  size="sm"
                  color={timerFinished ? 'success' : 'brand'}
                  iconLeading={timerFinished ? CheckCircle : Clock}
                >
                  {timerFinished ? 'המשך' : formatTime(timerSeconds)}
                </BadgeWithIcon>
              )}
              <CloseButton onPress={onClose} label="סגור" size="sm" />
            </div>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto p-4 sm:p-5">
            {currentSetupMessage && (
              <div className="flex items-start gap-2.5 rounded-xl bg-brand-primary_alt p-3.5 ring-1 ring-utility-brand-300">
                <InfoCircle className="mt-0.5 size-4 shrink-0 text-brand-secondary" />
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-primary">{currentSetupMessage.title}</h3>
                  <p className="text-xs leading-relaxed text-secondary">
                    {currentSetupMessage.desc}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-xl bg-secondary_alt p-3.5 ring-1 ring-secondary">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary sm:text-sm">
                <Package className="size-4 text-fg-brand-primary" />
                <span>פרופיל הציוד והמשקלים הנתמכים ב-AI Trainer</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {EQUIPMENT_SUMMARY_ITEMS.map((item) => (
                  <Badge key={item} size="sm" color="gray" type="modern">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {GLOSSARY_ITEMS.map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col gap-1 rounded-xl bg-secondary_alt p-3 ring-1 ring-secondary"
                >
                  <h4 className="text-xs font-bold text-primary sm:text-sm">{item.title}</h4>
                  <p className="text-xs leading-relaxed text-tertiary">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2.5 rounded-xl bg-error-primary p-3.5 ring-1 ring-error_subtle/40">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-error-primary" />
              <div className="flex flex-col gap-1">
                <h4 className="text-xs font-bold text-error-primary sm:text-sm">
                  בטיחות עבודה עם ספסל אימון (עד 100 קילוגרם)
                </h4>
                <p className="text-xs leading-relaxed text-secondary">
                  כשמתאמנים עם ספסל בעל מגבלת עומס של עד 100 קילוגרם (משקל גוף + משקולות יחד),
                  מומלץ שלא לשכב או לשבת עליו עם משקלים כבדים, אלא להישען עם יד אחת או להניח
                  ידיים/רגליים כשהספסל צמוד לקיר.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 rounded-xl bg-secondary_alt p-3.5 ring-1 ring-secondary">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary sm:text-sm">
                <Calendar className="size-4 text-fg-brand-primary" />
                <span>דוגמה לשילוב שבועי מומלץ (כוח + אימונים פונקציונליים)</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-7">
                {WEEKLY_SCHEDULE.map((d) => {
                  const isPrimary = d.highlight === 'primary';
                  const isSec = d.highlight === 'secondary';
                  return (
                    <div
                      key={d.day}
                      className={`flex flex-col items-center justify-center rounded-lg px-2 py-2 text-center ring-1 ring-inset ${
                        isPrimary
                          ? 'bg-brand-solid text-white ring-transparent'
                          : isSec
                          ? 'bg-brand-primary_alt text-brand-secondary ring-utility-brand-300'
                          : 'bg-primary text-primary ring-secondary'
                      }`}
                    >
                      <span className="text-xs font-bold">{d.day}</span>
                      <span
                        className={`text-[11px] ${
                          isPrimary ? 'text-white/90' : 'text-tertiary'
                        }`}
                      >
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-start pt-1">
              <Button
                size="sm"
                color="secondary-destructive"
                iconLeading={Trash01}
                onPress={() => {
                  onClearSetCheckmarks();
                  onClose();
                }}
              >
                נקה את כל סימוני הסטים באימון הנוכחי
              </Button>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export interface SaveWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  timerRunning: boolean;
  timerFinished: boolean;
  timerSeconds: number;
  workoutElapsedSec: number;
  totalDoneInView: number;
  totalSetsInView: number;
  workoutNote: string;
  onChangeWorkoutNote: (val: string) => void;
  saveFeedback: { error: boolean; text: string } | null;
  onDiscardWorkout: () => void;
  onSaveWorkoutSession: () => void;
}

export function SaveWorkoutModal({
  isOpen,
  onClose,
  timerRunning,
  timerFinished,
  timerSeconds,
  workoutElapsedSec,
  totalDoneInView,
  totalSetsInView,
  workoutNote,
  onChangeWorkoutNote,
  saveFeedback,
  onDiscardWorkout,
  onSaveWorkoutSession,
}: SaveWorkoutModalProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <Modal className="max-w-lg ring-1 ring-brand/40">
        <Dialog className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <FeaturedIcon icon={Save01} size="sm" color="brand" theme="modern" />
              <h2 className="text-sm font-bold text-primary sm:text-md">
                סיום ושמירת האימון
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {(timerRunning || timerFinished) && (
                <BadgeWithIcon
                  size="sm"
                  color={timerFinished ? 'success' : 'brand'}
                  iconLeading={timerFinished ? CheckCircle : Clock}
                >
                  {timerFinished ? 'המשך' : formatTime(timerSeconds)}
                </BadgeWithIcon>
              )}
              <CloseButton onPress={onClose} label="סגור" size="sm" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeWithIcon
                size="md"
                color={totalDoneInView > 0 ? 'success' : 'gray'}
                iconLeading={CheckCircle}
              >
                {totalDoneInView} מתוך {totalSetsInView} סטים סומנו כבוצעו
              </BadgeWithIcon>
              <BadgeWithIcon size="md" color="brand" iconLeading={Clock}>
                זמן אימון: {formatElapsedDuration(workoutElapsedSec)}
              </BadgeWithIcon>
            </div>
            <p className="text-xs leading-relaxed text-tertiary sm:text-sm">
              כל הסטים שסימנת (כולל המשקלים, החזרות ומשך האימון) יישמרו ביומן בענן ועל המכשיר,
              או שתוכל לבטל ולזרוק את האימון הנוכחי.
            </p>
          </div>

          <TextArea
            label="הערה לאימון הבא (לא חובה)"
            value={workoutNote}
            onChange={onChangeWorkoutNote}
            rows={3}
            placeholder="למשל: היה קל בלחיצת חזה, לעלות מדרגה במשקל בפעם הבאה"
          />

          {saveFeedback && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ring-1 ${
                saveFeedback.error
                  ? 'bg-error-primary text-error-primary ring-error_subtle'
                  : 'bg-success-primary text-success-primary ring-utility-green-300'
              }`}
            >
              <AlertTriangle className="size-4 shrink-0" />
              <span>{saveFeedback.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              size="sm"
              color="secondary-destructive"
              iconLeading={Trash01}
              onPress={onDiscardWorkout}
            >
              בטל וזרוק אימון
            </Button>
            <Button
              size="md"
              color="primary"
              iconLeading={Save01}
              onPress={onSaveWorkoutSession}
            >
              שמור וסיים אימון
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

export interface DiscardWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  workoutElapsedSec: number;
  totalDoneInView: number;
  onConfirmDiscard: () => void;
}

export function DiscardWorkoutModal({
  isOpen,
  onClose,
  workoutElapsedSec,
  totalDoneInView,
  onConfirmDiscard,
}: DiscardWorkoutModalProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <Modal className="max-w-md ring-1 ring-error_subtle/60">
        <Dialog className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <FeaturedIcon icon={AlertTriangle} size="sm" color="error" theme="modern" />
              <h2 className="text-sm font-bold text-primary sm:text-md">
                ביטול וזריקת האימון הנוכחי?
              </h2>
            </div>
            <CloseButton onPress={onClose} label="סגור" size="sm" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeWithIcon size="sm" color="gray" type="modern" iconLeading={Clock}>
                זמן שנמדד: {formatElapsedDuration(workoutElapsedSec)}
              </BadgeWithIcon>
              <Badge size="sm" color="gray" type="modern">
                {totalDoneInView} סטים שסומנו יימחקו
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-tertiary sm:text-sm">
              האימון הפעיל ייעצר ותחזור למסך תחילת האימון ללא שמירה ביומן ההתקדמות.
              היסטוריית האימונים הקודמים והמשקלים המועדפים יישמרו.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button size="sm" color="secondary" onPress={onClose}>
              המשך באימון
            </Button>
            <Button
              size="sm"
              color="primary-destructive"
              iconLeading={Trash01}
              onPress={onConfirmDiscard}
            >
              בטל וזרוק אימון
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
