<?php
declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'bootstrap.php';

$appName = (string) $config['app_name'];
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = (string) $_SESSION['csrf_token'];
?>
<!doctype html>
<html lang="th">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="csrf-token" content="<?= e($csrfToken); ?>">
    <title><?= e($appName); ?></title>
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body>
    <main class="app-shell" aria-labelledby="app-title">
        <header class="app-header">
            <div>
                <h1 id="app-title">แปลงรูปเป็น 1:1 กรอบขาว</h1>
                <p>วางภาพบนพื้นหลังสีขาว โดยคงจำนวนพิกเซลเดิมของภาพไว้ ไม่มีการย่อหรือขยายภาพต้นฉบับ</p>
            </div>
            <button class="button button-ghost" type="button" id="clearAllButton" disabled>ล้างทั้งหมด</button>
        </header>

        <section class="workspace" aria-label="เครื่องมือแปลงรูป">
            <section class="drop-zone" id="dropZone">
                <input id="fileInput" class="file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple>
                <div class="drop-content">
                    <span class="drop-icon" aria-hidden="true">+</span>
                    <div>
                        <h2>เลือกรูปหรือวางไฟล์ที่นี่</h2>
                        <p>รองรับ PNG, JPG, WEBP หลายไฟล์พร้อมกัน</p>
                    </div>
                    <button class="button" type="button" id="chooseFilesButton">นำเข้ารูป</button>
                </div>
            </section>

            <section class="controls" aria-label="ตัวเลือกการส่งออก">
                <label class="control">
                    <span>ชนิดไฟล์</span>
                    <select id="formatSelect">
                        <option value="image/png">PNG คมชัด lossless</option>
                        <option value="image/jpeg">JPG คุณภาพสูง</option>
                        <option value="image/webp">WEBP คุณภาพสูง</option>
                    </select>
                </label>
                <label class="control">
                    <span>คุณภาพ JPG/WEBP</span>
                    <input id="qualityInput" type="range" min="0.8" max="1" step="0.01" value="1">
                    <output id="qualityOutput">100%</output>
                </label>
                <button class="button button-primary" type="button" id="downloadAllButton" disabled>ดาวน์โหลดทั้งหมดเป็น ZIP</button>
            </section>

            <section class="status-panel" aria-live="polite">
                <strong id="summaryText">ยังไม่มีรูปที่นำเข้า</strong>
                <span id="detailText">ผลลัพธ์จะเป็นสี่เหลี่ยมจัตุรัส ขนาดเท่าด้านที่ยาวที่สุดของแต่ละรูป</span>
                <a class="manual-download" id="manualDownloadLink" href="#" download hidden>บันทึกไฟล์ ZIP</a>
            </section>

            <section class="gallery" id="gallery" aria-label="รายการรูปที่แปลงแล้ว"></section>
        </section>
    </main>

    <template id="imageCardTemplate">
        <article class="image-card">
            <div class="preview-wrap">
                <canvas class="preview-canvas"></canvas>
            </div>
            <div class="image-meta">
                <h3 class="image-name"></h3>
                <dl>
                    <div>
                        <dt>ต้นฉบับ</dt>
                        <dd class="original-size"></dd>
                    </div>
                    <div>
                        <dt>ผลลัพธ์</dt>
                        <dd class="output-size"></dd>
                    </div>
                </dl>
            </div>
            <div class="card-actions">
                <button class="button button-secondary download-one" type="button">ดาวน์โหลด</button>
                <button class="button button-ghost remove-one" type="button" aria-label="ลบรูปนี้">ลบ</button>
            </div>
        </article>
    </template>

    <script src="assets/js/app.js" defer></script>
</body>
</html>
