-- Faz 7 — şifre süresi uyarısı aşaması (notification enum genişletmesi ayrı migration’da; sıra: notifications tablosundan sonra)

ALTER TABLE "users" ADD COLUMN "password_expiry_warning_stage" INTEGER NOT NULL DEFAULT 0;
