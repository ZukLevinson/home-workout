import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from '../firebaseConfig';

const LOCAL_DRAFT_KEY = 'hw_rn_active_draft_v1';
const LOCAL_HISTORY_KEY = 'hw_rn_workout_history_v1';

let appInstance = null;
let authInstance = null;
let dbInstance = null;

export function getFirebaseServices() {
  if (!isFirebaseConfigured()) {
    return { app: null, auth: null, db: null, configured: false };
  }
  if (!appInstance) {
    appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
  }
  return { app: appInstance, auth: authInstance, db: dbInstance, configured: true };
}

export async function loadLocalState() {
  try {
    const [rawDraft, rawHistory] = await Promise.all([
      AsyncStorage.getItem(LOCAL_DRAFT_KEY),
      AsyncStorage.getItem(LOCAL_HISTORY_KEY),
    ]);
    return {
      draft: rawDraft ? JSON.parse(rawDraft) : {},
      history: rawHistory ? JSON.parse(rawHistory) : [],
    };
  } catch (err) {
    return { draft: {}, history: [] };
  }
}

export async function saveLocalDraft(draft) {
  try {
    await AsyncStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
  } catch (err) {
    // ignore storage quota errors
  }
}

export async function saveLocalHistory(history) {
  try {
    await AsyncStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    // ignore storage quota errors
  }
}

export function subscribeAuthAndFirestore({ onUserChange, onDraftRemote, onHistoryRemote, onSyncStatus }) {
  const { auth, db, configured } = getFirebaseServices();
  if (!configured || !auth || !db) {
    onSyncStatus({ mode: 'local', message: 'שמירה מקומית על המכשיר (ממתין לחיבור פרויקט Firebase)' });
    return () => {};
  }

  let unsubDraft = null;
  let unsubWorkouts = null;

  const cleanupListeners = () => {
    if (unsubDraft) {
      unsubDraft();
      unsubDraft = null;
    }
    if (unsubWorkouts) {
      unsubWorkouts();
      unsubWorkouts = null;
    }
  };

  onSyncStatus({ mode: 'connecting', message: 'מתחבר למסד הנתונים בענן (Firebase)...' });

  const unsubAuth = onAuthStateChanged(auth, async (user) => {
    cleanupListeners();
    if (!user) {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        onSyncStatus({
          mode: 'local',
          message: 'שמירה מקומית על המכשיר (חיבור לענן לא זמין כרגע)',
        });
      }
      return;
    }

    onUserChange(user);
    onSyncStatus({
      mode: 'cloud',
      message: user.isAnonymous
        ? 'מסונכרן אוטומטית לענן (Firebase Firestore)'
        : `מסונכרן לחשבון Google (${user.email || 'מחובר'})`,
    });

    // Listen to active draft document: /users/{uid}/state/activeDraft
    const draftRef = doc(db, 'users', user.uid, 'state', 'activeDraft');
    unsubDraft = onSnapshot(
      draftRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && typeof data.draftJson === 'string') {
            try {
              const parsed = JSON.parse(data.draftJson);
              if (parsed && typeof parsed === 'object') {
                onDraftRemote(parsed);
              }
            } catch (e) {
              // ignore malformed draft
            }
          }
        }
      },
      () => {}
    );

    // Listen to workouts collection: /users/{uid}/workouts ordered by createdAtMs desc
    const workoutsQuery = query(
      collection(db, 'users', user.uid, 'workouts'),
      orderBy('createdAtMs', 'desc')
    );
    unsubWorkouts = onSnapshot(
      workoutsQuery,
      (snap) => {
        const list = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data());
        });
        onHistoryRemote(list);
      },
      () => {}
    );
  });

  return () => {
    cleanupListeners();
    unsubAuth();
  };
}

export async function syncDraftToCloud(uid, draftObj) {
  const { db, configured } = getFirebaseServices();
  if (!configured || !db || !uid) return;
  const draftJson = JSON.stringify(draftObj || {});
  if (draftJson.length > 24000) return;
  const ref = doc(db, 'users', uid, 'state', 'activeDraft');
  await setDoc(ref, {
    draftJson,
    updatedAtMs: Date.now(),
  });
}

export async function saveWorkoutToCloud(uid, sessionDoc) {
  const { db, configured } = getFirebaseServices();
  if (!configured || !db || !uid) return;
  const ref = doc(db, 'users', uid, 'workouts', sessionDoc.id);
  await setDoc(ref, sessionDoc);
}

export async function deleteWorkoutFromCloud(uid, workoutId) {
  const { db, configured } = getFirebaseServices();
  if (!configured || !db || !uid) return;
  const ref = doc(db, 'users', uid, 'workouts', workoutId);
  await deleteDoc(ref);
}

export async function connectGoogleAccount() {
  if (Platform.OS !== 'web') {
    throw new Error('התחברות מהירה עם Google זמינה כרגע בגרסת הדפדפן.');
  }
  const { auth, configured } = getFirebaseServices();
  if (!configured || !auth) {
    throw new Error('פרויקט Firebase טרם הוגדר.');
  }
  const provider = new GoogleAuthProvider();
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    try {
      const res = await linkWithPopup(auth.currentUser, provider);
      return res.user;
    } catch (err) {
      // If Google account already linked to an existing user, sign in directly to that Google user
      if (err && err.code === 'auth/credential-already-in-use') {
        const res = await signInWithPopup(auth, provider);
        return res.user;
      }
      throw err;
    }
  }
  const res = await signInWithPopup(auth, provider);
  return res.user;
}
