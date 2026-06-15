# วิธีรัน Square Frame Tool ด้วย Docker

โปรเจคนี้ใช้ PHP 7.4 และ Apache ภายใน Docker ไม่จำเป็นต้องติดตั้ง PHP ลงใน Windows

## สิ่งที่ต้องมี

1. Docker Desktop
2. Docker Compose ซึ่งมากับ Docker Desktop
3. เปิด Docker Desktop และรอจนสถานะ Engine เป็น Running

ตรวจสอบจาก Terminal:

```powershell
docker --version
docker compose version
docker info
```

## รันโปรเจคครั้งแรก

เปิด Terminal ในโฟลเดอร์ `SquareFrameTool` แล้วใช้คำสั่ง:

```powershell
docker compose up -d --build
```

เปิดหน้าเว็บ:

```text
http://127.0.0.1:8088/
```

ดูสถานะ container:

```powershell
docker compose ps
```

ดู log:

```powershell
docker compose logs -f web
```

กด `Ctrl+C` เพื่อหยุดดู log โดยหน้าเว็บจะยังทำงานต่อ

## หยุดและเปิดใหม่

หยุด container:

```powershell
docker compose stop
```

เปิด container ที่หยุดไว้:

```powershell
docker compose start
```

หยุดและลบ container/network:

```powershell
docker compose down
```

เปิดใหม่หลังใช้ `down`:

```powershell
docker compose up -d
```

## หลังแก้โค้ด

Docker image จะเก็บโค้ดไว้ตอน build หลังแก้ PHP, JavaScript หรือ CSS ให้ build ใหม่:

```powershell
docker compose up -d --build
```

ถ้าเบราว์เซอร์ยังแสดงไฟล์เก่า ให้กด `Ctrl+F5`

## เปลี่ยน port

ค่าเริ่มต้นใช้ port `8088` หาก port ถูกใช้อยู่ ให้สร้างไฟล์ `.env` จาก `.env.example`:

```powershell
Copy-Item .env.example .env
```

แก้ค่าใน `.env` เช่น:

```dotenv
APP_PORT=8090
```

แล้วรัน:

```powershell
docker compose up -d
```

เปิด `http://127.0.0.1:8090/`

## ตรวจ syntax PHP ใน container

```powershell
docker compose exec web php -l /var/www/html/public/index.php
docker compose exec web php -l /var/www/html/public/api/save-export.php
docker compose exec web php -l /var/www/html/src/bootstrap.php
docker compose exec web php -l /var/www/html/config/app.php
```

## ตรวจ configuration

ตรวจไฟล์ Compose:

```powershell
docker compose config
```

ตรวจ Apache:

```powershell
docker compose exec web apache2ctl configtest
```

ตรวจ PHP version:

```powershell
docker compose exec web php -v
```

ผลลัพธ์ต้องเป็น PHP 7.4

## ตำแหน่งข้อมูลที่ถูกสร้าง

- ZIP ที่ระบบบันทึก: `public/downloads`
- Application log: `storage/app.log`

สองโฟลเดอร์นี้ mount จาก Windows เข้า container ข้อมูลจึงไม่หายเมื่อใช้ `docker compose down`

## แก้ปัญหาเบื้องต้น

Docker daemon ไม่ทำงาน:

```text
failed to connect to the docker API
```

ให้เปิด Docker Desktop รอจน Engine ทำงาน แล้วลอง `docker info` อีกครั้ง

ตรวจว่า port ถูกใช้อยู่หรือไม่:

```powershell
Get-NetTCPConnection -LocalPort 8088 -ErrorAction SilentlyContinue
```

ดู error ล่าสุด:

```powershell
docker compose logs --tail 100 web
```

ล้าง image แล้ว build ใหม่ทั้งหมด:

```powershell
docker compose down
docker compose build --no-cache
docker compose up -d
```
