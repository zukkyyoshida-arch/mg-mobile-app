-- mg-mobile-sync: 戦略MG 記帳補助アプリの同期用スキーマ（Cloudflare D1）

-- ルーム。PIN と講師キーは平文で持たず、ソルト付き SHA-256 のみ保存する。
CREATE TABLE IF NOT EXISTS rooms (
  room_id            TEXT PRIMARY KEY,
  pin_salt           TEXT NOT NULL,
  pin_hash           TEXT NOT NULL,
  teacher_key_hash   TEXT NOT NULL,
  created_at         INTEGER NOT NULL,
  -- PIN 総当たり対策: 一定時間内の失敗回数
  pin_fail_count     INTEGER NOT NULL DEFAULT 0,
  pin_fail_window_at INTEGER NOT NULL DEFAULT 0
);

-- プレイヤー。端末トークンは SHA-256 ハッシュのみ保存。
-- version は書き込みごとに +1（楽観ロック）。data=ダッシュボード用サマリー JSON、backup=全期の仕訳 JSON。
CREATE TABLE IF NOT EXISTS players (
  room_id     TEXT NOT NULL,
  player      TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 0,
  data        TEXT NOT NULL DEFAULT '{}',
  backup      TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (room_id, player),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);

-- 講師が保存する最終成績。
CREATE TABLE IF NOT EXISTS archives (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id    TEXT NOT NULL,
  timestamp  TEXT NOT NULL,
  players    TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);
CREATE INDEX IF NOT EXISTS idx_archives_room ON archives(room_id, id DESC);
