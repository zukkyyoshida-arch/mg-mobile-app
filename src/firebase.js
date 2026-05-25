import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDefCbA8tYgHdH74vQ827Ijup6fMYetxKU",
  authDomain: "mg-mobile-app-d1006.firebaseapp.com",
  projectId: "mg-mobile-app-d1006",
  storageBucket: "mg-mobile-app-d1006.firebasestorage.app",
  messagingSenderId: "391290124313",
  appId: "1:391290124313:web:bddb939b0cfeb2149b5288"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore instead of Realtime Database (More stable without explicit URLs)
export const db = getFirestore(app);

// Helper function to sync player data
export const syncPlayerData = (roomId, playerId, data) => {
  if (!roomId || !playerId) return Promise.resolve();
  const playerRef = doc(db, `rooms/${roomId}/players/${playerId}`);
  return setDoc(playerRef, data, { merge: true });
};

// Helper function to subscribe to all players in a room (for dashboard)
export const subscribeToRoom = (roomId, callback) => {
  if (!roomId) return () => {};
  const playersRef = collection(db, `rooms/${roomId}/players`);
  const unsubscribe = onSnapshot(playersRef, (snapshot) => {
    const data = {};
    snapshot.forEach((docSnap) => {
      data[docSnap.id] = docSnap.data();
    });
    callback(data);
  }, (error) => {
    console.error("Firestore Error:", error);
    alert("ダッシュボード受信エラー（権限設定などを確認してください）: " + error.message);
  });
  return unsubscribe;
};

// Helper function to remove a player from a room
export const removePlayer = (roomId, playerId) => {
  if (!roomId || !playerId) return Promise.resolve();
  const playerRef = doc(db, `rooms/${roomId}/players/${playerId}`);
  // deleteDoc は import に追加しておく必要があります
  import("firebase/firestore").then(({ deleteDoc }) => {
    deleteDoc(playerRef).catch(console.error);
  });
  return Promise.resolve();
};

// Helper function to archive a room's results permanently
export const archiveRoom = (roomId, playersArray) => {
  if (!roomId || !playersArray || playersArray.length === 0) return Promise.reject(new Error("保存するデータがありません"));
  return import("firebase/firestore").then(({ addDoc, collection }) => {
    return addDoc(collection(db, "archives"), {
      roomId,
      timestamp: new Date().toISOString(),
      players: playersArray
    });
  });
};
