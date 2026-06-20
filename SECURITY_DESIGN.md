# Security Design ตามหลัก CIA Triad

เอกสารนี้ออกแบบความปลอดภัยสำหรับ Square Frame Tool โดยอ้างอิงโครงสร้างจริงของโปรเจกต์ PHP 7.4 + Apache + Docker

## ขอบเขตระบบ

- หน้าเว็บหลัก: `public/index.php`
- Logic แปลงรูป: `public/assets/js/app.js`
- API บันทึก ZIP fallback: `public/api/save-export.php`
- โฟลเดอร์ ZIP ที่ระบบสร้าง: `public/downloads`
- Log ระบบ: `storage/app.log`
- Security bootstrap: `src/bootstrap.php`
- Apache policy: `public/.htaccess`, `public/downloads/.htaccess`

## ข้อมูลสำคัญ

- รูปต้นฉบับของผู้ใช้ประมวลผลใน browser เป็นหลัก ไม่อัปโหลดเข้า server
- ZIP จะถูกส่งเข้า server เฉพาะกรณี fallback บน localhost หรือ browser บางตัวที่ดาวน์โหลดตรงไม่ได้
- ZIP ที่ server สร้างอยู่ใน `public/downloads`
- Log อยู่ใน `storage/app.log` และไม่ควรเปิด public
- Session ใช้สำหรับ CSRF token ของ API

## 1. Confidentiality - การรักษาความลับ

เป้าหมาย: ให้ข้อมูลรูป, ZIP, session token, log และ internal path ถูกเข้าถึงได้เฉพาะส่วนที่จำเป็น

### Controls ที่ใช้แล้ว

- ประมวลผลรูปใน browser เพื่อลดการส่งรูปต้นฉบับเข้า server
- ใช้ CSRF token จาก session สำหรับ `public/api/save-export.php`
- ตั้ง session cookie เป็น `HttpOnly`, `SameSite=Strict` และ `Secure` เมื่อใช้ HTTPS
- ปิด `display_errors` และ log error ลง `storage/app.log`
- ใช้ `htmlspecialchars()` ผ่าน helper `e()` ก่อน render ค่า server-side
- ตั้ง security headers:
  - `Content-Security-Policy`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy`
  - `Cross-Origin-Opener-Policy`
  - `Cross-Origin-Resource-Policy`
- ปิด directory listing ด้วย `.htaccess`
- Docker ใช้ `no-new-privileges:true`
- ปิด `expose_php`

### Design rules

- ห้ามเก็บรูปต้นฉบับบน server ถ้าไม่จำเป็น
- ห้าม log session id, CSRF token, raw filename ที่ไม่ sanitize, หรือข้อมูลส่วนตัว
- ZIP ใน `public/downloads` ต้องถือเป็นข้อมูลชั่วคราว ไม่ใช่พื้นที่เก็บถาวร
- Production ต้องรันผ่าน HTTPS เท่านั้น เพื่อให้ session cookie ใช้ `Secure`
- ถ้าต้องให้ดาวน์โหลด ZIP เฉพาะเจ้าของไฟล์ในอนาคต ให้ย้าย ZIP ออกจาก `public/` แล้วเสิร์ฟผ่าน PHP endpoint ที่ตรวจสิทธิ์ก่อน

### Recommended next controls

- เพิ่ม job ลบ ZIP เก่า เช่น ลบไฟล์ใน `public/downloads` ที่อายุเกิน 24 ชั่วโมง
- ถ้ารัน public internet ให้ใช้ reverse proxy/WAF ที่บังคับ HTTPS
- จำกัดการเข้าถึง `storage/` จาก web server เสมอ
- ตั้ง permission:
  - `storage/` เป็น write เฉพาะ web user
  - `public/downloads/` เป็น write เฉพาะ web user และอ่านได้เท่าที่จำเป็น

## 2. Integrity - ความถูกต้องและความครบถ้วน

เป้าหมาย: ป้องกันการแก้ไขข้อมูลหรือไฟล์โดยไม่ได้รับอนุญาต และตรวจสอบความถูกต้องของ input/output

### Controls ที่ใช้แล้ว

- `save-export.php` รับเฉพาะ `POST`
- ตรวจ CSRF ด้วย `hash_equals()`
- ตรวจ `Content-Type` ต้องเป็น `application/zip`
- จำกัดขนาด ZIP ไม่เกิน 250MB ทั้งจาก `CONTENT_LENGTH` และระหว่างอ่าน stream
- sanitize filename ด้วย `basename()`, allowlist character และบังคับ extension `.zip`
- สร้างชื่อไฟล์ใหม่ด้วย timestamp + random bytes เพื่อกัน overwrite
- บันทึก SHA-256 ของ ZIP ใน audit log
- ลบไฟล์ทันทีถ้าอ่าน stream ล้มเหลวหรือขนาดเกิน
- JS ตรวจไฟล์รูปด้วย allowlist MIME type และจำกัดขนาดไฟล์รูปไม่เกิน 40MB
- JS กันไฟล์รูปซ้ำด้วย SHA-256 fingerprint ก่อนเพิ่มเข้า gallery

### Design rules

- ทุก input จาก browser ต้อง validate ฝั่ง server ซ้ำเสมอ
- ห้ามเชื่อ filename จาก browser โดยตรง
- ห้ามเขียนไฟล์ทับชื่อเดิม
- ถ้ามี DB ในอนาคต ต้องใช้ PDO prepared statement ทุก query
- ถ้ามี authentication ในอนาคต ต้องใช้ `password_hash()` และ `password_verify()`
- ถ้าเพิ่ม upload endpoint ใหม่ ต้องตรวจ:
  - ขนาดไฟล์
  - extension allowlist
  - MIME ด้วย `finfo`
  - path traversal
  - generated filename
  - storage นอก public ถ้าเป็นข้อมูลลับ

### Recommended next controls

- ตรวจ ZIP magic bytes ก่อนบันทึกถ้าต้องรับ ZIP จาก external network จริง
- เพิ่ม automated test สำหรับ:
  - invalid method
  - invalid CSRF
  - invalid MIME
  - oversized upload
  - unsafe filename
- เก็บ hash manifest สำหรับ release asset สำคัญ เช่น `app.js`, `app.css`, vendor library
- ทำ backup config และ source code ผ่าน Git remote ที่เปิด branch protection

## 3. Availability - ความพร้อมใช้งาน

เป้าหมาย: ให้ระบบเปิดใช้งานได้ต่อเนื่อง กู้คืนได้ และไม่ล่มง่ายจากไฟล์ใหญ่หรือ request ผิดปกติ

### Controls ที่ใช้แล้ว

- Docker Compose ตั้ง `restart: unless-stopped`
- Dockerfile มี `HEALTHCHECK`
- PHP จำกัด:
  - `upload_max_filesize=250M`
  - `post_max_size=250M`
  - `max_execution_time=120`
  - `memory_limit=512M`
- API อ่าน stream แบบ chunk 1MB ไม่โหลด ZIP ทั้งก้อนเข้า memory
- Apache ปิด directory listing
- Static asset และ client-side processing ช่วยลด load ฝั่ง server

### Design rules

- ต้องมี monitoring healthcheck ของ container
- ต้องเก็บ log เพื่อวิเคราะห์ปัญหา แต่ต้อง rotate log ไม่ให้ disk เต็ม
- ต้องลบ ZIP เก่าอัตโนมัติเพื่อป้องกัน disk เต็ม
- ต้องมี backup source code, config และเอกสาร deploy
- ต้องมีขั้นตอน restore ที่ทำซ้ำได้จาก Git + Docker

### Recommended next controls

- เพิ่ม log rotation สำหรับ `storage/app.log`
- เพิ่ม scheduled cleanup สำหรับ `public/downloads`
- วาง reverse proxy เช่น Nginx/Traefik/Cloudflare หน้า container เมื่อเปิด public
- เปิด rate limit สำหรับ endpoint `public/api/save-export.php`
- ใช้ firewall จำกัด port ที่เปิดจริง เหลือเฉพาะ HTTP/HTTPS
- ถ้ารัน production ให้มี UPS, snapshot หรือ backup volume ตามรอบ

## Trust Boundaries

| Boundary | Input | Risk | Control |
|---|---|---|---|
| Browser to PHP API | ZIP blob, filename header, CSRF header | CSRF, oversized upload, malicious filename | CSRF, content-type check, size limit, filename sanitize |
| PHP to filesystem | ZIP write, log write | path traversal, overwrite, disk full | generated filename, fixed directory, cleanup plan |
| Public web root | downloads, assets | data exposure, direct file listing | `.htaccess`, attachment header, cleanup plan |
| Runtime config | env vars | debug leak, wrong env | env defaults, `APP_DEBUG=false` |

## Operational Checklist

ก่อนเปิดใช้งานจริง:

- ตั้ง `APP_ENV=production`
- ตั้ง `APP_DEBUG=false`
- เปิด HTTPS หน้า web server/proxy
- ตรวจว่า `storage/` ไม่ถูก serve ผ่าน web
- ตรวจว่า `public/downloads/` ไม่มี directory listing
- ตั้ง cleanup ZIP เก่า
- ตั้ง log rotation
- ตรวจ `docker compose ps` ต้องเป็น `healthy`
- ตรวจ `docker compose logs --tail 100 web` ไม่มี fatal error

## Incident Response

ถ้าพบ ZIP รั่วหรือมีไฟล์ผิดปกติ:

1. หยุด endpoint ชั่วคราวหรือปิด container
2. สำรอง log ที่เกี่ยวข้องจาก `storage/app.log`
3. ลบ ZIP ใน `public/downloads`
4. ตรวจ audit log event `zip_export_saved`
5. ตรวจ IP/User-Agent/เวลาที่เกิดเหตุ
6. rebuild และ redeploy image ล่าสุด
7. เพิ่ม rule rate limit หรือ firewall ถ้าเป็น traffic ผิดปกติ

## Disaster Recovery

ข้อมูลที่ต้อง backup:

- Source code ใน Git
- `.env` หรือ environment variable ที่ใช้จริง
- `storage/app.log` ถ้าต้องใช้ตรวจสอบเหตุการณ์ย้อนหลัง
- `public/downloads` เฉพาะกรณี business ต้องเก็บ ZIP ชั่วคราวไว้จริง

ขั้นตอนกู้คืน:

```bash
git clone <repo-url>
cd SquareFrameTool
cp .env.example .env
docker compose up -d --build
docker compose ps
curl -I http://127.0.0.1:8088/
```

## Security Acceptance Criteria

- ผู้ใช้ทั่วไปไม่เห็น PHP error หรือ stack trace
- ไฟล์ที่ไม่ใช่ ZIP ส่งเข้า `save-export.php` ไม่ได้
- request ไม่มี CSRF token บันทึก ZIP ไม่ได้
- ไฟล์ใหญ่เกิน limit ถูกปฏิเสธ
- filename อันตรายไม่สามารถทำ path traversal ได้
- ZIP ที่บันทึกมีชื่อแบบ generated unique name
- security headers ถูกส่งทุกหน้า
- container health เป็น `healthy`
