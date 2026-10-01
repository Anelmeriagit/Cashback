# CashBack

Личный список кешбэков (Жанна и Денис) + напоминания в Telegram. Статика + Vercel Functions (`api/`), данные в Vercel Blob.

## Переменные окружения (Vercel)
| Имя | Назначение |
|---|---|
| `AUTH_USER` | общий логин |
| `AUTH_HASH` | хэш пароля `соль:scrypt` (hex) |
| `SESSION_SECRET` | отдельный случайный ключ подписи сессий (≥32 байт) |
| `SESSION_VERSION` | номер сессий (по умолчанию `1`); смените, чтобы разлогинить все устройства |
| `BLOB_READ_WRITE_TOKEN` | выдаёт Vercel при подключении Blob |
| `TELEGRAM_BOT_TOKEN` | токен бота |
| `CRON_SECRET` | секрет для `/api/cron` и `/api/tg-setup`, передаётся только заголовком |

## Служебные вызовы
```
curl -H "Authorization: Bearer $CRON_SECRET" https://<домен>/api/tg-setup        # один раз: вебхук и меню бота
curl -H "Authorization: Bearer $CRON_SECRET" "https://<домен>/api/cron?dry=1"    # сухой прогон
curl -H "Authorization: Bearer $CRON_SECRET" "https://<домен>/api/cron?slot=evening"  # ручной повтор вечернего слота
```
