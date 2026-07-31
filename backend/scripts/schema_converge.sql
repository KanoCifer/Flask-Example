-- ============================================================================
-- schema_converge.sql — 一次性收口：数据库 schema 对齐 Go 端 GORM 模型
--
-- 背景：
--   项目统一由 Go 端 GORM AutoMigrate 管理 schema（Python SQLAlchemy 只做查询）。
--   现有库由历史 Alembic 迁移链构建，存在两类漂移：
--     1) 类型漂移：BIGINT / NUMERIC / TEXT 等旧类型，Go 模型期望 INTEGER / DOUBLE PRECISION / VARCHAR。
--     2) 索引漂移：旧 Alembic 命名（下划线合并，如 ix_*_createdat）与 Go/新命名（ix_*_created_at）
--        并存，属于重复垃圾；另有 Go 模型不再定义的单列索引。
--
-- 原则：
--   - 只做【类型收敛】和【删冗余索引】，不删任何列（user 时间字段、passkey 三字段、
--     gallery 的 thumbnail_url/medium_url/width/height/aspect_ratio/status 等
--     多余列均保留 —— Go 模型不读它们，AutoMigrate 也不会删，留着无碍）。
--   - event/log 的 extra 列保持 jsonb（Go 用 datatypes.JSON，映射 jsonb）。
--
-- 执行前请先备份：pg_dump -Fc -f backup.dump "postgresql://.../postgres"
-- 执行后重启 Go 后端让 AutoMigrate 补建缺失索引/约束。
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) 类型收敛（对齐 Go 模型）
-- ---------------------------------------------------------------------------

-- gallery_image: BIGINT → INTEGER（Go: FileSize int / SortOrder int / UserID *uint）
ALTER TABLE gallery_image ALTER COLUMN file_size  TYPE INTEGER USING file_size::integer;
ALTER TABLE gallery_image ALTER COLUMN sort_order TYPE INTEGER USING sort_order::integer;
ALTER TABLE gallery_image ALTER COLUMN user_id    TYPE INTEGER USING user_id::integer;

-- subscription: NUMERIC → DOUBLE PRECISION, BIGINT → INTEGER（Go: Price float64 / UserID uint）
ALTER TABLE subscription ALTER COLUMN price   TYPE DOUBLE PRECISION USING price::double precision;
ALTER TABLE subscription ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;

-- device_track: NUMERIC → DOUBLE PRECISION, BIGINT → INTEGER（Go: Price float64 / UserID uint）
ALTER TABLE device_track ALTER COLUMN price   TYPE DOUBLE PRECISION USING price::double precision;
ALTER TABLE device_track ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;

-- rss_info: BIGINT → INTEGER（Go: EntryCount int / UserID uint）
ALTER TABLE rss_info ALTER COLUMN entry_count TYPE INTEGER USING entry_count::integer;
ALTER TABLE rss_info ALTER COLUMN user_id     TYPE INTEGER USING user_id::integer;

-- user: BIGINT → INTEGER, TEXT → VARCHAR(100)（Go: LoginCount int / GithubID *int / *IP *string size:100）
ALTER TABLE "user" ALTER COLUMN github_id        TYPE INTEGER USING github_id::integer;
ALTER TABLE "user" ALTER COLUMN login_count      TYPE INTEGER USING login_count::integer;
ALTER TABLE "user" ALTER COLUMN last_login_ip    TYPE VARCHAR(100) USING last_login_ip::varchar(100);
ALTER TABLE "user" ALTER COLUMN current_login_ip TYPE VARCHAR(100) USING current_login_ip::varchar(100);

-- passkey_credential: BIGINT → INTEGER（Go: SignCount int / UserID uint）
ALTER TABLE passkey_credential ALTER COLUMN sign_count TYPE INTEGER USING sign_count::integer;
ALTER TABLE passkey_credential ALTER COLUMN user_id    TYPE INTEGER USING user_id::integer;

-- profile: BIGINT → INTEGER（Go: UserID uint）
ALTER TABLE profile ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;

-- ---------------------------------------------------------------------------
-- 2) 删除冗余/废弃索引
--    旧 Alembic 下划线命名（Go/新约定不再生成）+ Go 模型不再定义的单列索引
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS ix_gallery_image_createdat;
DROP INDEX IF EXISTS ix_gallery_image_sortorder;
DROP INDEX IF EXISTS ix_gallery_image_userid;

DROP INDEX IF EXISTS ix_subscription_createdat;
DROP INDEX IF EXISTS ix_subscription_userid;

DROP INDEX IF EXISTS ix_device_track_createdat;
DROP INDEX IF EXISTS ix_device_track_userid;

DROP INDEX IF EXISTS ix_rss_info_createdat;
DROP INDEX IF EXISTS ix_rss_info_rssurl;
DROP INDEX IF EXISTS ix_rss_info_userid;

DROP INDEX IF EXISTS ix_user_deletedat;  -- gorm.Model 的 deleted_at 无索引

DROP INDEX IF EXISTS ix_passkey_credential_createdat;
DROP INDEX IF EXISTS ix_passkey_credential_userid;

DROP INDEX IF EXISTS ix_profile_userid;  -- 与 uq_profile_user_id 重复

-- event: Go 只建复合 ix_event_type_timestamp，单列不再建
DROP INDEX IF EXISTS ix_event_timestamp;
DROP INDEX IF EXISTS ix_event_type;

-- log: Go 只建单列 ix_log_timestamp / ix_log_level，复合 ix_log_timestamp_level 不再建
DROP INDEX IF EXISTS ix_log_timestamp_level;

COMMIT;

-- 收口完成。下一步：重启 Go 后端（AutoMigrate 补建缺失索引/约束），
-- 并验证 `gorm migrate` 无多余操作。
