-- Run auto-archive function periodically
SELECT cron.schedule('auto-archive-preparations', '0 */6 * * *', 'SELECT auto_archive_completed_preparations();');