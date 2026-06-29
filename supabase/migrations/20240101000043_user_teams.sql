-- Notification teams: users can belong to several. Routing (part requests, leave,
-- claims, etc.) targets the members of the relevant team(s) — their own email + push —
-- instead of static contact emails on the organisation.
CREATE TABLE IF NOT EXISTS user_teams (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team    TEXT NOT NULL,   -- procurement | sales | hr | hod | ceo | management
  PRIMARY KEY (user_id, team)
);
CREATE INDEX IF NOT EXISTS idx_user_teams_team ON user_teams(team);
