ALTER TABLE "Presence"
  ADD COLUMN "authTokenHash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "peerId" TEXT,
  ADD COLUMN "connectionState" TEXT NOT NULL DEFAULT 'idle';
