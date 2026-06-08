<?php
declare(strict_types=1);

require dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'bootstrap.php';

header('Content-Type: application/json; charset=UTF-8');

function json_response(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(405, ['ok' => false, 'message' => 'Method not allowed']);
}

$csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
$sessionToken = $_SESSION['csrf_token'] ?? '';
if (!is_string($sessionToken) || $sessionToken === '' || !hash_equals($sessionToken, $csrfToken)) {
    json_response(419, ['ok' => false, 'message' => 'Invalid CSRF token']);
}

$contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
if (strpos($contentType, 'application/zip') !== 0) {
    json_response(415, ['ok' => false, 'message' => 'Only ZIP files are accepted']);
}

$maxBytes = 250 * 1024 * 1024;
$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength <= 0 || $contentLength > $maxBytes) {
    json_response(413, ['ok' => false, 'message' => 'ZIP file is too large']);
}

$rawName = rawurldecode((string) ($_SERVER['HTTP_X_FILE_NAME'] ?? 'square-white-frame.zip'));
$safeName = preg_replace('/[^A-Za-z0-9._-]+/', '-', basename($rawName));
$safeName = trim((string) $safeName, '.-');
if ($safeName === '' || strtolower(pathinfo($safeName, PATHINFO_EXTENSION)) !== 'zip') {
    $safeName = 'square-white-frame.zip';
}

$downloadDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'downloads';
if (!is_dir($downloadDir)) {
    mkdir($downloadDir, 0750, true);
}

$baseName = pathinfo($safeName, PATHINFO_FILENAME);
$targetName = $baseName . '-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.zip';
$targetPath = $downloadDir . DIRECTORY_SEPARATOR . $targetName;

$input = fopen('php://input', 'rb');
$output = fopen($targetPath, 'wb');
if ($input === false || $output === false) {
    json_response(500, ['ok' => false, 'message' => 'Cannot create export file']);
}

$bytesWritten = 0;
while (!feof($input)) {
    $chunk = fread($input, 1024 * 1024);
    if ($chunk === false) {
        fclose($input);
        fclose($output);
        @unlink($targetPath);
        json_response(500, ['ok' => false, 'message' => 'Cannot read export file']);
    }

    $bytesWritten += strlen($chunk);
    if ($bytesWritten > $maxBytes) {
        fclose($input);
        fclose($output);
        @unlink($targetPath);
        json_response(413, ['ok' => false, 'message' => 'ZIP file is too large']);
    }

    fwrite($output, $chunk);
}

fclose($input);
fclose($output);

$audit = [
    'time' => gmdate('c'),
    'event' => 'zip_export_saved',
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
    'file' => $targetName,
    'bytes' => $bytesWritten,
    'sha256' => hash_file('sha256', $targetPath),
];
error_log('Audit: ' . json_encode($audit, JSON_UNESCAPED_SLASHES));

json_response(201, [
    'ok' => true,
    'url' => 'downloads/' . rawurlencode($targetName),
    'file_path' => realpath($targetPath),
]);
