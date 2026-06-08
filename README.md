# Square White Frame

เว็บ PHP 7.4 สำหรับแปลงรูปหลายไฟล์ให้เป็นอัตราส่วน 1:1 ด้วยพื้นหลังสีขาว

## วิธีรัน

```powershell
php -S 127.0.0.1:8000 -t public
```

แล้วเปิด `http://127.0.0.1:8000`

ถ้าเครื่องไม่มี PHP CLI สามารถเปิด `public/index.html` เพื่อใช้งานแบบ static ได้ เพราะการแปลงรูปทำในเบราว์เซอร์ทั้งหมด

## หลักการรักษาความคม

- ประมวลผลในเบราว์เซอร์ ไม่อัปโหลดรูปขึ้นเซิร์ฟเวอร์
- canvas ผลลัพธ์มีขนาดเท่าด้านที่ยาวที่สุดของรูปต้นฉบับ
- วางรูปที่ขนาดพิกเซลเดิมตรงกลาง canvas
- พื้นที่ที่เหลือเติมด้วยสีขาว
- ค่าเริ่มต้นส่งออกเป็น PNG แบบ lossless
- บน localhost ถ้าเบราว์เซอร์ไม่รองรับ download event ระบบจะบันทึก ZIP ไว้ใน `public/downloads` และแสดง path ไฟล์บนหน้าจอ

## โครงสร้าง

- `config/app.php` ตั้งค่าจาก environment
- `src/bootstrap.php` error handling, session cookies, security headers
- `public/index.php` หน้าเว็บหลัก
- `public/assets/css/app.css` สไตล์
- `public/assets/js/app.js` logic แปลงรูปและสร้าง ZIP
