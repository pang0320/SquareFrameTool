<?php
declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'bootstrap.php';

$appName = (string) $config['app_name'];
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrfToken = (string) $_SESSION['csrf_token'];
$cssVersion = substr(hash_file('sha256', __DIR__ . '/assets/css/app.css'), 0, 16);
$jsVersion = substr(hash_file('sha256', __DIR__ . '/assets/js/app.js'), 0, 16);
$sweetAlertCssVersion = substr(hash_file('sha256', __DIR__ . '/assets/vendor/sweetalert2/sweetalert2.min.css'), 0, 16);
$sweetAlertJsVersion = substr(hash_file('sha256', __DIR__ . '/assets/vendor/sweetalert2/sweetalert2.all.min.js'), 0, 16);
?>
<!doctype html>
<html lang="th">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="theme-color" content="#f5f5f7">
    <meta name="csrf-token" content="<?= e($csrfToken); ?>">
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link rel="apple-touch-icon" href="favicon.svg">
    <title><?= e($appName); ?></title>
    <link rel="stylesheet" href="assets/vendor/sweetalert2/sweetalert2.min.css?v=<?= e($sweetAlertCssVersion); ?>">
    <link rel="stylesheet" href="assets/css/app.css?v=<?= e($cssVersion); ?>">
</head>
<body>
    <nav class="global-nav" aria-label="เมนูหลัก">
        <div class="nav-inner">
            <a class="brand" href="#app-title" aria-label="Frame Studio หน้าแรก">
                <span class="brand-mark" aria-hidden="true"></span>
                <span>Frame Studio</span>
            </a>
            <div class="nav-links" aria-label="ทางลัด">
                <a href="#import">นำเข้า</a>
                <a href="#edit">ปรับแต่ง</a>
                <a href="#results">รูปภาพ</a>
            </div>
            <button class="nav-clear" type="button" id="clearAllButton" disabled>ล้างทั้งหมด</button>
        </div>
    </nav>

    <main class="app-shell" aria-labelledby="app-title">
        <header class="app-header">
            <p class="eyebrow">เครื่องมือจัดเฟรมภาพ</p>
            <h1 id="app-title">กรอบสี่เหลี่ยมที่พอดี<br><span>โดยไม่เสียความคมชัด</span></h1>
            <p class="intro">เปลี่ยนรูปทุกขนาดให้เป็น 1:1, 4:5, 9:16 หรือ 16:9 เติมพื้นที่ว่างด้วยสีที่คุณเลือก และส่งออกหลายรูปพร้อมกันด้วยความละเอียดต้นฉบับ</p>
        </header>

        <section class="workspace" aria-label="เครื่องมือแปลงรูป">
            <section class="drop-zone" id="import">
                <div class="drop-target" id="dropZone">
                    <input id="fileInput" class="file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple>
                    <div class="drop-visual" aria-hidden="true">
                        <span class="photo-shape photo-shape-back"></span>
                        <span class="photo-shape photo-shape-front">
                            <span class="photo-sun"></span>
                            <span class="photo-mountain"></span>
                        </span>
                    </div>
                    <div class="drop-copy">
                        <span class="section-kicker">เริ่มต้นที่นี่</span>
                        <h2>วางรูปของคุณ<br>ลงในสตูดิโอ</h2>
                        <p>ลากไฟล์มาวาง หรือเลือกรูป PNG, JPG และ WEBP ได้หลายไฟล์พร้อมกัน</p>
                        <button class="button button-primary" type="button" id="chooseFilesButton">
                            <span class="button-plus" aria-hidden="true">+</span>
                            เลือกรูปภาพ
                        </button>
                    </div>
                    <div class="drop-note">
                        <strong>คงพิกเซลต้นฉบับ</strong>
                        <span>ไม่มีการขยายหรือลดขนาดภาพ</span>
                    </div>
                </div>
            </section>

            <section class="editor-section" id="edit" aria-labelledby="edit-title">
                <div class="section-heading">
                    <div>
                        <p class="eyebrow">ปรับแต่ง</p>
                        <h2 id="edit-title">ทำให้ทุกภาพเป็นแบบคุณ</h2>
                    </div>
                    <button class="button button-quiet reset-settings" type="button" id="resetSettingsButton">คืนค่าเริ่มต้น</button>
                </div>

                <div class="settings-panel">
                    <section class="setting-card setting-card-color" aria-labelledby="color-title">
                        <div class="card-heading">
                            <span class="card-number">01</span>
                            <div>
                                <h3 id="color-title">สีและระยะขอบ</h3>
                                <p>เลือกพื้นที่รอบภาพให้เข้ากับงาน</p>
                            </div>
                        </div>

                        <div class="setting-stack">
                            <div class="setting-group">
                                <span class="setting-label">สีพื้นหลัง</span>
                                <div class="color-controls">
                                    <label class="custom-color-picker">
                                        <input class="color-picker" id="backgroundColorInput" type="color" value="#ffffff" aria-label="เปิดจานสีเพื่อเลือกสีพื้นหลัง">
                                        <span class="color-picker-rainbow" aria-hidden="true"></span>
                                        <span>เลือกสีเอง</span>
                                    </label>
                                    <label class="hex-color-field">
                                        <span class="sr-only">รหัสสีพื้นหลังแบบ HEX</span>
                                        <input id="backgroundColorHexInput" type="text" value="#FFFFFF" maxlength="7" inputmode="text" spellcheck="false" autocomplete="off" aria-label="รหัสสีพื้นหลังแบบ HEX">
                                    </label>
                                    <div class="color-presets" aria-label="สีแนะนำ">
                                        <button class="color-swatch is-selected" type="button" data-color="#ffffff" aria-label="สีขาว"></button>
                                        <button class="color-swatch" type="button" data-color="#f2f2f2" aria-label="สีเทาอ่อน"></button>
                                        <button class="color-swatch" type="button" data-color="#111111" aria-label="สีดำ"></button>
                                        <button class="color-swatch" type="button" data-color="#dff4ea" aria-label="สีเขียวอ่อน"></button>
                                        <button class="color-swatch" type="button" data-color="#ffe7ec" aria-label="สีชมพูอ่อน"></button>
                                    </div>
                                </div>
                            </div>

                            <fieldset class="setting-group aspect-fieldset">
                                <legend class="setting-label">สัดส่วนผลลัพธ์</legend>
                                <div class="aspect-options">
                                    <label title="เหมาะกับโพสต์จัตุรัส"><input type="radio" name="aspectRatio" value="1:1" checked><span>1:1</span></label>
                                    <label title="เหมาะกับฟีดแนวตั้ง"><input type="radio" name="aspectRatio" value="4:5"><span>4:5</span></label>
                                    <label title="เหมาะกับสตอรี่หรือรีล"><input type="radio" name="aspectRatio" value="9:16"><span>9:16</span></label>
                                    <label title="เหมาะกับภาพแนวนอน"><input type="radio" name="aspectRatio" value="16:9"><span>16:9</span></label>
                                </div>
                            </fieldset>

                            <label class="setting-group setting-range">
                                <span class="setting-label">ขอบเพิ่ม</span>
                                <div class="range-row">
                                    <input id="paddingInput" type="range" min="0" max="500" step="10" value="0">
                                    <output id="paddingOutput">0 px</output>
                                </div>
                            </label>
                        </div>
                    </section>

                    <section class="setting-card" aria-labelledby="position-title">
                        <div class="card-heading">
                            <span class="card-number">02</span>
                            <div>
                                <h3 id="position-title">ตำแหน่งภาพ</h3>
                                <p>กำหนดจุดยึดบนพื้นที่สี่เหลี่ยม</p>
                            </div>
                        </div>

                        <fieldset class="setting-group alignment-fieldset">
                            <legend class="setting-label">เลือกตำแหน่ง</legend>
                            <div class="alignment-grid">
                                <label title="ซ้ายบน"><input type="radio" name="alignment" value="top-left"><span>↖</span></label>
                                <label title="บนกลาง"><input type="radio" name="alignment" value="top-center"><span>↑</span></label>
                                <label title="ขวาบน"><input type="radio" name="alignment" value="top-right"><span>↗</span></label>
                                <label title="ซ้ายกลาง"><input type="radio" name="alignment" value="middle-left"><span>←</span></label>
                                <label title="กึ่งกลาง"><input type="radio" name="alignment" value="middle-center" checked><span>●</span></label>
                                <label title="ขวากลาง"><input type="radio" name="alignment" value="middle-right"><span>→</span></label>
                                <label title="ซ้ายล่าง"><input type="radio" name="alignment" value="bottom-left"><span>↙</span></label>
                                <label title="ล่างกลาง"><input type="radio" name="alignment" value="bottom-center"><span>↓</span></label>
                                <label title="ขวาล่าง"><input type="radio" name="alignment" value="bottom-right"><span>↘</span></label>
                            </div>
                        </fieldset>
                    </section>

                    <section class="setting-card setting-card-watermark" aria-labelledby="watermark-title">
                        <div class="card-heading">
                            <span class="card-number">03</span>
                            <div>
                                <h3 id="watermark-title">ลายน้ำ</h3>
                                <p>วางโลโก้หรือไฟล์ลายน้ำลงบนทุกภาพ</p>
                            </div>
                        </div>

                        <input id="watermarkFileInput" class="file-input" type="file" accept="image/png,image/jpeg,image/webp">

                        <div class="watermark-picker">
                            <button class="button button-quiet watermark-choose" type="button" id="chooseWatermarkButton">เลือกลายน้ำ</button>
                            <button class="button button-quiet watermark-remove" type="button" id="removeWatermarkButton" hidden>เอาออก</button>
                        </div>

                        <div class="watermark-preview" id="watermarkPreviewBox">
                            <img id="watermarkPreviewImage" alt="ตัวอย่างลายน้ำ" hidden>
                            <span id="watermarkStatus">ยังไม่ได้เลือกลายน้ำ</span>
                        </div>

                        <div class="watermark-controls">
                            <label class="setting-group setting-range">
                                <span class="setting-label">ความชัด</span>
                                <div class="range-row compact-range">
                                    <input id="watermarkOpacityInput" type="range" min="0.1" max="1" step="0.05" value="0.7">
                                    <output id="watermarkOpacityOutput">70%</output>
                                </div>
                            </label>

                            <label class="setting-group setting-range">
                                <span class="setting-label">ขนาด</span>
                                <div class="range-row compact-range">
                                    <input id="watermarkSizeInput" type="range" min="5" max="45" step="1" value="18">
                                    <output id="watermarkSizeOutput">18%</output>
                                </div>
                            </label>

                            <label class="setting-group setting-range">
                                <span class="setting-label">ระยะขอบ</span>
                                <div class="range-row compact-range">
                                    <input id="watermarkMarginInput" type="range" min="0" max="300" step="5" value="48">
                                    <output id="watermarkMarginOutput">48 px</output>
                                </div>
                            </label>
                        </div>

                        <fieldset class="setting-group watermark-position-fieldset">
                            <legend class="setting-label">ตำแหน่งลายน้ำ</legend>
                            <div class="watermark-position-grid">
                                <label title="ซ้ายบน"><input type="radio" name="watermarkPosition" value="top-left"><span>↖</span></label>
                                <label title="บนกลาง"><input type="radio" name="watermarkPosition" value="top-center"><span>↑</span></label>
                                <label title="ขวาบน"><input type="radio" name="watermarkPosition" value="top-right"><span>↗</span></label>
                                <label title="ซ้ายกลาง"><input type="radio" name="watermarkPosition" value="middle-left"><span>←</span></label>
                                <label title="กึ่งกลาง"><input type="radio" name="watermarkPosition" value="middle-center"><span>●</span></label>
                                <label title="ขวากลาง"><input type="radio" name="watermarkPosition" value="middle-right"><span>→</span></label>
                                <label title="ซ้ายล่าง"><input type="radio" name="watermarkPosition" value="bottom-left"><span>↙</span></label>
                                <label title="ล่างกลาง"><input type="radio" name="watermarkPosition" value="bottom-center"><span>↓</span></label>
                                <label title="ขวาล่าง"><input type="radio" name="watermarkPosition" value="bottom-right" checked><span>↘</span></label>
                            </div>
                        </fieldset>
                    </section>

                    <section class="setting-card setting-card-output" aria-labelledby="output-title">
                        <div class="card-heading">
                            <span class="card-number">04</span>
                            <div>
                                <h3 id="output-title">ไฟล์ส่งออก</h3>
                                <p>เลือกรูปแบบ คุณภาพ และชื่อไฟล์</p>
                            </div>
                        </div>

                        <div class="output-grid">
                            <label class="setting-group">
                                <span class="setting-label">ชนิดไฟล์</span>
                                <select id="formatSelect">
                                    <option value="image/png">PNG คมชัด lossless</option>
                                    <option value="image/jpeg">JPG คุณภาพสูง</option>
                                    <option value="image/webp">WEBP คุณภาพสูง</option>
                                </select>
                            </label>
                            <label class="setting-group control">
                                <span class="setting-label">คุณภาพ JPG/WEBP</span>
                                <div class="range-row">
                                    <input id="qualityInput" type="range" min="0.8" max="1" step="0.01" value="1">
                                    <output id="qualityOutput">100%</output>
                                </div>
                            </label>
                            <label class="setting-group">
                                <span class="setting-label">คำหน้าชื่อไฟล์</span>
                                <input class="text-input" id="filePrefixInput" type="text" maxlength="30" placeholder="เช่น square-">
                            </label>
                            <label class="setting-group">
                                <span class="setting-label">คำท้ายชื่อไฟล์</span>
                                <input class="text-input" id="fileSuffixInput" type="text" maxlength="30" value="-1x1">
                            </label>
                            <label class="setting-group output-sort">
                                <span class="setting-label">เรียงรูป</span>
                                <select id="sortSelect">
                                    <option value="added">ตามลำดับนำเข้า</option>
                                    <option value="name-asc">ชื่อตาม A-Z</option>
                                    <option value="name-desc">ชื่อตาม Z-A</option>
                                    <option value="size-desc">ขนาดใหญ่ก่อน</option>
                                    <option value="size-asc">ขนาดเล็กก่อน</option>
                                </select>
                            </label>
                        </div>
                    </section>
                </div>
            </section>

            <section class="results-section" id="results" aria-labelledby="results-title">
                <div class="results-bar">
                    <div>
                        <p class="eyebrow">รูปภาพของคุณ</p>
                        <h2 id="results-title">พร้อมดูตัวอย่างและส่งออก</h2>
                    </div>
                    <div class="download-actions">
                        <button class="button button-quiet download-images" type="button" id="downloadImagesButton" disabled>ดาวน์โหลดเป็นรูปแยก</button>
                        <button class="button button-primary download-all" type="button" id="downloadAllButton" disabled>ดาวน์โหลดทั้งหมดเป็น ZIP</button>
                    </div>
                </div>

                <div class="status-panel" aria-live="polite">
                    <strong id="summaryText">ยังไม่มีรูปที่นำเข้า</strong>
                    <span id="detailText">เลือกสัดส่วนผลลัพธ์ได้ 1:1, 4:5, 9:16 หรือ 16:9 โดยคงพิกเซลภาพเดิม</span>
                    <a class="manual-download" id="manualDownloadLink" href="#" download hidden>บันทึกไฟล์ ZIP</a>
                </div>

                <section class="gallery" id="gallery" aria-label="รายการรูปที่แปลงแล้ว"></section>
            </section>
        </section>
    </main>

    <footer class="app-footer">
        <span>Frame Studio</span>
        <span>ประมวลผลภาพบนอุปกรณ์ของคุณ</span>
    </footer>

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
                <button class="button button-icon rotate-left" type="button" title="หมุนซ้าย" aria-label="หมุนรูปไปทางซ้าย">↺</button>
                <button class="button button-icon rotate-right" type="button" title="หมุนขวา" aria-label="หมุนรูปไปทางขวา">↻</button>
                <button class="button button-dark download-one" type="button">ดาวน์โหลด</button>
                <button class="button button-quiet remove-one" type="button" aria-label="ลบรูปนี้">ลบ</button>
            </div>
        </article>
    </template>

    <script src="assets/vendor/sweetalert2/sweetalert2.all.min.js?v=<?= e($sweetAlertJsVersion); ?>" defer></script>
    <script src="assets/js/app.js?v=<?= e($jsVersion); ?>" defer></script>
</body>
</html>
