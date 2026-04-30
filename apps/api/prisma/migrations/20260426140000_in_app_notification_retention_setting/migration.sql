-- Sistem ayarı: worker in-app retention (Faz 8 iter 3). Seed ile aynı key.
INSERT INTO "system_settings" ("key", "value", "description", "created_at", "updated_at", "updated_by_user_id")
VALUES (
  'IN_APP_NOTIFICATION_RETENTION_DAYS',
  to_jsonb(90),
  'In-app bildirimler kaç gün saklanır (worker retention)',
  NOW(),
  NOW(),
  NULL
) ON CONFLICT ("key") DO NOTHING;
