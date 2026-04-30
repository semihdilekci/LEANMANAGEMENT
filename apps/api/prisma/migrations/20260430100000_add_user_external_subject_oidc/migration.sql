-- Faz 2.1 İter 1 — ADR 0008: IdP `sub` ile platform user.id ayrımı için isteğe bağlı kolon
ALTER TABLE "users" ADD COLUMN "external_subject" VARCHAR(255);
