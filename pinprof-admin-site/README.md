# PinProf Admin Site

Shared-hosting PHP backend for the `pinprof-admin` frontend build.

## Setup on KnownHost shared hosting

1. Create a MariaDB/MySQL database in cPanel.
2. Import [schema.sql](/Users/pillyliu/Documents/Codex/Pillyliu%20Pinball%20Website/pinprof-admin-site/schema.sql).
3. Copy `config.example.php` to `config.php` on the server and fill in DB credentials plus an admin password hash.
4. Deploy the built frontend from `pinprof-admin/dist` plus this folder into `public_html/pinprof-admin/`.
5. Keep the existing `/pinball` payload deployed at `public_html/pinball/`.

## Password hash

Generate a password hash locally on any machine with PHP:

```bash
php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"
```

If PHP is unavailable locally, use any temporary PHP shell or hash generator and paste the result into `config.php`.
