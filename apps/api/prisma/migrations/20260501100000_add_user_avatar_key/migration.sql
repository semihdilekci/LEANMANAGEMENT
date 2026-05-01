-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar_key" VARCHAR(128) NOT NULL DEFAULT 'day/rainy/1';

-- Deterministic çeşitlilik — kullanıcı başına sabit avatar (hash üzerinden indeks)
UPDATE "users" SET "avatar_key" = (
  ARRAY[
    'day/rainy/1',
    'day/rainy/2',
    'day/rainy/3',
    'day/rainy/4',
    'evening/clear/1',
    'evening/hot/1',
    'morning/bright',
    'morning/clear/1',
    'morning/clear/2',
    'morning/cloudy',
    'morning/cold/cloudy/2',
    'morning/cold/snow/1',
    'morning/foggy/1',
    'morning/foggy/2',
    'morning/haze/2',
    'morning/hot/1',
    'morning/windy',
    'night/clear/1',
    'night/cloudy',
    'night/cold/clear/1',
    'night/cold/snow',
    'night/foggy',
    'night/hot/clear/2',
    'night/windy'
  ]
)[1 + mod(abs(hashtext(id::text)), 24)];
