<?php
declare(strict_types=1);

return [
    'app_name' => getenv('APP_NAME') ?: 'Square White Frame',
    'environment' => getenv('APP_ENV') ?: 'production',
    'debug' => filter_var(getenv('APP_DEBUG') ?: 'false', FILTER_VALIDATE_BOOLEAN),
    'log_file' => getenv('APP_LOG_FILE') ?: dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'app.log',
];
