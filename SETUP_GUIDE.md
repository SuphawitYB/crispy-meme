# คู่มือการติดตั้งและเริ่มใช้งาน Smart Bin Server (สำหรับ Windows)

คู่มือนี้จะช่วยคุณติดตั้งโปรแกรมที่จำเป็นและเปิดใช้งาน Server บนคอมพิวเตอร์เครื่องใหม่ครับ

## 1. ติดตั้ง Python
ถ้าเครื่องยังไม่มี Python ให้ทำการติดตั้งก่อน:
1. ไปที่เว็บ [python.org/downloads](https://www.python.org/downloads/)
2. กดปุ่ม **Download Python** (เวอร์ชั่นล่าสุด)
3. **สำคัญ:** ตอนเปิดตัวติดตั้ง ให้ติ๊กถูกช่อง **"Add Python to PATH"** ด้านล่างสุด ก่อนกด Install Now
4. รอจนติดตั้งเสร็จ

## 2. ติดตั้ง Library ที่จำเป็น
เมื่อมี Python แล้ว เราต้องลงตัวช่วย (Library) ให้โปรแกรมทำงานได้
1. เปิดโฟลเดอร์โปรเจคนี้ (`smartbin_tce`)
2. คลิกขวาที่ว่างๆ ในโฟลเดอร์ เลือก **"Open in Terminal"** (หรือพิมพ์ `cmd` ในช่อง address bar ด้านบนแล้วกด Enter)
3. พิมพ์คำสั่งต่อไปนี้แล้วกด Enter:
   ```bash
   pip install -r requirements.txt
   ```
4. รอจนมันเขียนว่า Successfully installed...

## 3. วิธีเปิด Server
1. เปิด Terminal ในโฟลเดอร์นี้เหมือนเดิม
2. พิมพ์คำสั่ง:
   ```bash
   python server.py
   ```
3. ถ้าสำเร็จ จะขึ้นข้อความประมาณว่า:
   ```
   * Running on all addresses (0.0.0.0)
   * Running on http://127.0.0.1:5000
   ```
   แปลว่า Server พร้อมใช้งานแล้วครับ!

## 4. การเชื่อมต่อหน้าเว็บกับ Server
1. เปิดไฟล์ `script.js` ด้วยโปรแกรมเช่น Notepad หรือ VS Code
2. หาบรรทัดที่เขียนว่า `API_URL` (ประมาณบรรทัด 17)
3. **ถ้าเปิดเว็บเครื่องเดียวกับ Server:** ใช้ `http://localhost:5000/api`
4. **ถ้าเปิดเว็บเครื่องอื่น:** ต้องใช้ IP ของเครื่องที่รัน Server
   - วิธีดู IP: เปิด cmd แล้วพิมพ์ `ipconfig`
   - มองหา `IPv4 Address` (เช่น `192.168.1.105`)
   - แก้ใน `script.js` เป็น `http://192.168.1.105:5000/api`

## ปัญหาที่พบบ่อย
- **'python' is not recognized:** แปลว่าตอนลง Python ลืมติ๊ก "Add Python to PATH" ให้ลองลงใหม่แล้วติ๊กด้วยครับ
- **ModuleNotFoundError: No module named 'flask':** แปลว่าลืมทำขั้นตอนที่ 2 (ติดตั้ง Library)
