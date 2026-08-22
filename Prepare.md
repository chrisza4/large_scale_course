# การเตรียม Laptop

สำหรับผู้เข้าเรียน Design large-scale system: Fundamentals เราจะแสดงตัวอย่างบนหลายๆ ภาษาโปรแกรม จึงขอให้เตรียมตัวตามรายการข้างล่าง

Tech stack ที่ใช้

- **TypeScript / Bun**
- **Docker & Docker Compose** — รัน dependency เช่น Redis, Postgres สำหรับตัวอย่างที่ต้องใช้
- **Rust**
- **C**
- **C# / .NET**
- **Java (Maven)**

ถ้าตัวไหนไม่มีแนะนำให้ติดตั้งไว้ตามข้างล่าง

## 1. Git

### Mac

```bash
# ถ้ายังไม่มี Xcode Command Line Tools (มักจะติดตั้ง git มาให้ด้วย)
xcode-select --install
```

หรือใช้ Homebrew: `brew install git`

### Windows

ดาวน์โหลดและติดตั้ง **Git for Windows**: https://git-scm.com/download/win
ระหว่างติดตั้ง แนะนำให้เลือก "Git Bash" เพื่อใช้เป็น terminal ที่ใกล้เคียง Mac/Linux

ตรวจสอบ:

```bash
git --version
```

---

## 2. mise

[mise](https://mise.jdx.dev/) เป็นเครื่องมือที่ใช้บริหารเครื่อง Laptop เวลาที่คุณเขียนโปรแกรมหลายภาษา และต้องจัดการ Version ของภาษาต่างๆ เช่น Node, Ruby, Java, Elixir, C# พร้อมๆ กัน Mise สามารถจัดการให้เราได้ทั้งหมด

ในคู่มือนี้จะใช้ Mise ในการลงภาษาและ Tech ที่ใช้ในระบบ

### ติดตั้ง mise

**Mac** (Homebrew):

```bash
brew install mise
```

**Windows**: ดูวิธีติดตั้งที่ [หน้าติดตั้ง](https://mise.jdx.dev/installing-mise.html)

ตรวจสอบโดย:

```bash
mise --version
```

เข้าไปในโฟลเดอร์ตัวอย่าง แล้วให้ mise ติดตั้ง ตัว mise จะติดตั้งเครื่องมือตามที่ระบุไว้ในเครื่องมือตามที่ระบุใน `mise.toml` (เช่น Rust, Bun เวอร์ชันที่กำหนด):

```bash
cd sharding
mise install
```

> หมายเหตุ: ถ้าไม่สะดวกใช้ mise สามารถดูสิ่งที่ต้องติดตั้งได้ใน file mise.toml

---

## 3. Docker Desktop

### Mac

ดาวน์โหลด **Docker Desktop for Mac**: https://www.docker.com/products/docker-desktop/

- เลือกชิปให้ถูกต้อง (Apple Silicon M1/M2/M3/M4 หรือ Intel)

### Windows

ดูวิธีติดตั้งที่หน้าเอกสารทางการ: https://docs.docker.com/desktop/setup/install/windows-install/ (รวมถึงข้อกำหนดเรื่อง WSL2)

ตรวจสอบว่า Docker พร้อมใช้งาน:

```bash
docker --version
docker compose version
```

ทดสอบรันจริง:

```bash
cd async
docker compose up -d
```

---

## 4. GCC/Clang + Make (สำหรับ `cas_mutex_c`)

**Mac**: มากับ Xcode Command Line Tools (ข้อ 1) อยู่แล้ว ตรวจสอบด้วย `gcc --version` และ `make --version`

**Windows**: ผู้สอนไม่ได้ใช้ Windows ไม่แน่ใจเหมือนกันว่าติดตั้งอย่างไร แต่น่าจะดูจาก https://www.msys2.org/ ได้

ตรวจสอบ:

```bash
gcc --version
clang --version
make --version
```

## 5. เช็คลิสต์ก่อนเข้าคลาส

- [ ] ติดตั้ง Git และ login GitHub (ถ้าต้อง clone/push repo ส่วนตัว)
- [ ] Clone repo นี้ลงเครื่องได้สำเร็จ
- [ ] ติดตั้ง mise และรัน `mise --version` ได้
- [ ] `bun --version` รันได้ (ผ่าน mise หรือติดตั้งตรงก็ได้)
- [ ] `docker --version` และ `docker compose version` รันได้ พร้อมเปิด Docker Desktop ทิ้งไว้
- [ ] ทดลองรัน `cd async && bun install && bun run index.ts` ได้สำเร็จ
- [ ] ทดลองรัน `cd async && docker compose up -d` ได้สำเร็จ (ถ้ามีปัญหาเรื่อง port ชนกัน ให้ปิดโปรแกรมอื่นที่ใช้พอร์ตเดียวกันก่อน)
- [ ] `rustc --version` และ `cargo --version` รันได้ (ผ่าน mise หรือติดตั้งตรงก็ได้)
- [ ] `gcc --version` หรือ `clang --version` และ `make --version` รันได้
- [ ] `dotnet --version` รันได้ (.NET SDK)
- [ ] `java --version` และ `mvn --version` รันได้ (Java + Maven)

หากติดปัญหาระหว่างติดตั้ง สามารถสอบถามทางอีเมล์ผู้สอนได้เลยครับ
