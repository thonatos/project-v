CREATE TABLE `locales` (
	`code` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`english_label` text NOT NULL,
	`native_label` text,
	`region` text,
	`is_builtin` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `locales_enabled_sort_idx` ON `locales` (`enabled`,`sort_order`);
--> statement-breakpoint
INSERT INTO `locales` (`code`, `label`, `english_label`, `native_label`, `region`, `is_builtin`, `enabled`, `sort_order`, `created_at`, `updated_at`) VALUES
  ('zh-cn', '简体中文', 'Simplified Chinese', '中文(简体)', 'CN', 1, 1, 0, 0, 0),
  ('zh-tw', '繁體中文', 'Traditional Chinese', '中文(繁體)', 'TW', 1, 1, 10, 0, 0),
  ('en-us', '英语 (美国)', 'English (US)', 'English', 'US', 1, 1, 20, 0, 0),
  ('en-gb', '英语 (英国)', 'English (UK)', 'English', 'GB', 1, 1, 30, 0, 0),
  ('ja-jp', '日语', 'Japanese', '日本語', 'JP', 1, 1, 40, 0, 0),
  ('ko-kr', '韩语', 'Korean', '한국어', 'KR', 1, 1, 50, 0, 0),
  ('fr-fr', '法语', 'French', 'Français', 'FR', 1, 1, 60, 0, 0),
  ('de-de', '德语', 'German', 'Deutsch', 'DE', 1, 1, 70, 0, 0),
  ('es-es', '西班牙语', 'Spanish', 'Español', 'ES', 1, 1, 80, 0, 0),
  ('pt-br', '葡萄牙语 (巴西)', 'Portuguese (BR)', 'Português', 'BR', 1, 1, 90, 0, 0),
  ('ru-ru', '俄语', 'Russian', 'Русский', 'RU', 1, 1, 100, 0, 0),
  ('ar-sa', '阿拉伯语', 'Arabic', 'العربية', 'SA', 1, 1, 110, 0, 0);