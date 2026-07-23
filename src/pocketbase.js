import PocketBase, { ClientResponseError } from 'pocketbase';

const PB_URL = import.meta.env.VITE_PB_URL || 'https://kazukiyoshidamacbook-air-2.tail4dd8e5.ts.net';

export const pb = new PocketBase(PB_URL);
// デバウンス連続送信が自動キャンセルされるのを防ぐ（必須）
pb.autoCancellation(false);

const PLAYERS_COLLECTION = 'players';
const ARCHIVES_COLLECTION = 'archives';

// Helper function to sync player data ((room, player) で upsert)
// backup が渡されたときだけ仕訳明細フルバックアップ(json)も一緒に保存する（後方互換）
export const syncPlayerData = (roomId, playerId, data, backup) => {
  if (!roomId || !playerId) return Promise.resolve();

  const filter = pb.filter('room = {:room} && player = {:player}', { room: roomId, player: playerId });

  // backup が undefined のときは body に含めない（旧サーバー/旧スキーマとの後方互換）
  const body = backup === undefined ? { data } : { data, backup };

  return pb.collection(PLAYERS_COLLECTION).getFirstListItem(filter)
    .then((record) => {
      return pb.collection(PLAYERS_COLLECTION).update(record.id, body);
    })
    .catch((error) => {
      if (error instanceof ClientResponseError && error.status === 404) {
        return pb.collection(PLAYERS_COLLECTION)
          .create({ room: roomId, player: playerId, ...body })
          .catch((createError) => {
            // ユニーク制約違反（他クライアントと同時作成）の場合は1回だけupdateにリトライ
            if (createError instanceof ClientResponseError && createError.status === 400) {
              return pb.collection(PLAYERS_COLLECTION).getFirstListItem(filter)
                .then((record) => pb.collection(PLAYERS_COLLECTION).update(record.id, body));
            }
            throw createError;
          });
      }
      throw error;
    });
};

// Helper function to fetch a single player record in full (backup 含む)
// 参加時の上書き防止／サーバー復元のために使用する。存在しなければ null、通信エラーは throw
export const fetchPlayerRecord = (roomId, playerId) => {
  if (!roomId || !playerId) return Promise.resolve(null);

  const filter = pb.filter('room = {:room} && player = {:player}', { room: roomId, player: playerId });

  return pb.collection(PLAYERS_COLLECTION).getFirstListItem(filter)
    .catch((error) => {
      if (error instanceof ClientResponseError && error.status === 404) {
        return null;
      }
      throw error;
    });
};

// Helper function to subscribe to all players in a room (for dashboard)
// Firestoreの onSnapshot 互換: { [playerId]: playerData } のマップをcallbackへ渡す
export const subscribeToRoom = (roomId, callback) => {
  if (!roomId) return () => {};

  const filter = pb.filter('room = {:room}', { room: roomId });
  const map = {};
  let cancelled = false;
  let realUnsubscribe = null;

  const emit = () => callback({ ...map });

  // ① 初回全件取得（backup(最大5MB)はダッシュボードで不要なので受信しない＝通信量削減）
  pb.collection(PLAYERS_COLLECTION).getFullList({ filter, fields: 'id,room,player,data' })
    .then((records) => {
      records.forEach((record) => {
        map[record.player] = record.data;
      });
      if (!cancelled) emit();
    })
    .catch((error) => {
      console.error('PocketBase Error:', error);
      alert('ダッシュボード受信エラー（権限設定などを確認してください）: ' + error.message);
    });

  // ② リアルタイム購読
  pb.collection(PLAYERS_COLLECTION)
    .subscribe('*', (e) => {
      const record = e.record;
      if (!record || record.room !== roomId) return;

      if (e.action === 'delete') {
        delete map[record.player];
      } else {
        // create / update
        map[record.player] = record.data;
      }
      emit();
    }, { filter, fields: 'id,room,player,data' })
    .then((unsub) => {
      if (cancelled) {
        // すでにunsubscribeが呼ばれていた場合は即座に解除する
        unsub();
        return;
      }
      realUnsubscribe = unsub;
    })
    .catch((error) => {
      console.error('PocketBase Error:', error);
      alert('ダッシュボード受信エラー（権限設定などを確認してください）: ' + error.message);
    });

  // 同期的にunsubscribe関数を返す
  return () => {
    cancelled = true;
    if (realUnsubscribe) {
      realUnsubscribe();
      realUnsubscribe = null;
    }
  };
};

// Helper function to remove a player from a room
export const removePlayer = (roomId, playerId) => {
  if (!roomId || !playerId) return Promise.resolve();

  const filter = pb.filter('room = {:room} && player = {:player}', { room: roomId, player: playerId });

  return pb.collection(PLAYERS_COLLECTION).getFirstListItem(filter)
    .then((record) => pb.collection(PLAYERS_COLLECTION).delete(record.id))
    .catch((error) => {
      if (error instanceof ClientResponseError && error.status === 404) {
        return Promise.resolve();
      }
      throw error;
    });
};

// Helper function to archive a room's results permanently
export const archiveRoom = (roomId, playersArray) => {
  if (!roomId || !playersArray || playersArray.length === 0) return Promise.reject(new Error('保存するデータがありません'));

  return pb.collection(ARCHIVES_COLLECTION).create({
    roomId,
    timestamp: new Date().toISOString(),
    players: playersArray
  });
};

// Helper function to list all archives (Archives.jsx 用)
export const listArchives = () => {
  return pb.collection(ARCHIVES_COLLECTION).getFullList({ sort: '-timestamp' });
};
