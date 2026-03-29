-- Quest Claiming Schema

CREATE TABLE IF NOT EXISTS claimed_quests (
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    quest_id TEXT NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (player_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_claimed_quests_player ON claimed_quests(player_id);
