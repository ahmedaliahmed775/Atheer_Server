# نظام Atheer - خادم المدفوعات اللاتصالية عبر NFC

نظام دفع متكامل يعتمد على تقنية NFC لإجراء المعاملات المالية دون الحاجة إلى اتصال بالإنترنت لحظة الدفع.

---

## 📋 متطلبات التشغيل

- **Node.js**: الإصدار 18 أو أحدث
- **PostgreSQL**: الإصدار 13 أو أحدث
- **npm**: الإصدار 8 أو أحدث

---

## 🗄️ هيكل قاعدة البيانات

### جدول المستخدمين (`users`)

| العمود | النوع | الوصف |
|--------|-------|-------|
| `phone` | مفتاح أساسي (نص) | رقم الهاتف - معرف فريد لكل مستخدم |
| `password` | نص | كلمة المرور مشفرة بـ bcrypt |
| `role` | تعداد | `customer` للعميل أو `merchant` للتاجر |
| `name` | نص | الاسم الكامل للمستخدم |

### جدول المحافظ (`wallets`)

| العمود | النوع | الوصف |
|--------|-------|-------|
| `phone` | مفتاح أساسي + مرجع | رقم هاتف المستخدم |
| `balance` | عشري (15,2) | الرصيد الحالي بالريال اليمني |

### جدول المعاملات (`transactions`)

| العمود | النوع | الوصف |
|--------|-------|-------|
| `id` | UUID | معرف فريد للمعاملة |
| `sender` | نص | رقم هاتف المُرسِل |
| `receiver` | نص | رقم هاتف المُستقبِل |
| `amount` | عشري (15,2) | المبلغ المُحوَّل |
| `status` | نص | حالة المعاملة: `ACCEPTED` أو `REJECTED` |
| `createdAt` | تاريخ ووقت | وقت إنشاء المعاملة |

---

## 🚀 خطوات التثبيت والتشغيل

### 1. استنساخ المشروع

```bash
git clone https://github.com/ahmedaliahmed775/Atheer_Server.git
cd Atheer_Server
```

### 2. تثبيت المكتبات

```bash
npm install
```

### 3. إعداد متغيرات البيئة

```bash
cp .env.example .env
```

ثم عدّل ملف `.env` بالقيم المناسبة:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=atheer_db
DB_USER=postgres
DB_PASSWORD=كلمة_المرور_هنا

JWT_SECRET=مفتاح_سري_طويل_وعشوائي
JWT_EXPIRES_IN=7d

PORT=3000
NODE_ENV=development

ADMIN_EMAIL=admin@atheer.app
ADMIN_PASSWORD=كلمة_مرور_الإدارة
```

### 4. إنشاء قاعدة البيانات

```bash
psql -U postgres -c "CREATE DATABASE atheer_db;"
```

### 5. تشغيل الخادم

```bash
# وضع الإنتاج
npm start

# وضع التطوير (مع إعادة التشغيل التلقائي)
npm run dev
```

---

## 📡 نقاط نهاية API

**البادئة الأساسية:** `/api/v1`

### 🔐 المصادقة

#### تسجيل حساب جديد
```
POST /api/v1/auth/signup
```

**جسم الطلب:**
```json
{
  "phone": "770123456",
  "password": "كلمة_المرور",
  "name": "اسم المستخدم",
  "role": "customer"
}
```

**ملاحظة:** العميل `customer` يحصل على رصيد ابتدائي **100,000 ريال**، والتاجر `merchant` يبدأ برصيد **صفر**.

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم إنشاء الحساب بنجاح",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
    "user": {
      "phone": "770123456",
      "name": "اسم المستخدم",
      "role": "customer",
      "initial_balance": 100000
    }
  }
}
```

#### تسجيل الدخول
```
POST /api/v1/auth/login
```

**جسم الطلب:**
```json
{
  "phone": "770123456",
  "password": "كلمة_المرور"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "تم تسجيل الدخول بنجاح",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
    "user": {
      "phone": "770123456",
      "name": "اسم المستخدم",
      "role": "customer"
    }
  }
}
```

---

### 💰 المحفظة (يتطلب Bearer Token)

#### استعراض الرصيد
```
GET /api/v1/wallet/balance
Authorization: Bearer <access_token>
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "phone": "770123456",
    "balance": 99500.00,
    "currency": "YER"
  }
}
```

#### سجل المعاملات (آخر 50 معاملة)
```
GET /api/v1/wallet/history
Authorization: Bearer <access_token>
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "phone": "770123456",
    "total": 1,
    "transactions": [
      {
        "id": "uuid-هنا",
        "type": "OUTGOING",
        "sender": "770123456",
        "receiver": "770999999",
        "amount": 500.00,
        "status": "ACCEPTED",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

---

### 🏪 التاجر (يتطلب Bearer Token لتاجر)

#### شحن العميل (استلام دفعة NFC)
```
POST /api/v1/merchant/charge
Authorization: Bearer <merchant_access_token>
Content-Type: application/json
```

**جسم الطلب (محاكاة لمعايير البنوك):**
```json
{
  "header": {
    "serviceDetail": {
      "serviceName": "ATHEER.ECOMMCASHOUT"
    }
  },
  "body": {
    "amount": 500,
    "atheerToken": "NzcwMTIzNDU2",
    "nonce": "random_unique_string_123"
  }
}
```

> **ملاحظة:** `atheerToken` هو رقم هاتف العميل مشفراً بـ Base64.
> مثال: الرقم `770123456` يُشفَّر إلى `NzcwMTIzNDU2`.

**الاستجابة عند النجاح:**
```json
{
  "header": {
    "serviceDetail": {
      "serviceName": "ATHEER.ECOMMCASHOUT",
      "responseCode": "00",
      "responseMessage": "APPROVED"
    },
    "transactionDate": "2024-01-15T10:30:00.000Z"
  },
  "body": {
    "status": "ACCEPTED",
    "transactionId": "uuid-هنا",
    "amount": 500,
    "referenceNumber": "ATH1705312200000",
    "nonce": "random_unique_string_123",
    "merchantPhone": "770999999",
    "customerPhone": "770123456",
    "merchantNewBalance": 500
  }
}
```

---

## 🛡️ لوحة الإدارة

متاحة على المسار: `http://localhost:3000/admin`

**بيانات الدخول الافتراضية:**
- البريد الإلكتروني: `admin@atheer.app`
- كلمة المرور: `admin123`

> ⚠️ **تحذير:** يجب تغيير بيانات الدخول الافتراضية قبل النشر في بيئة الإنتاج.

**الأقسام المتاحة في لوحة الإدارة:**
- **إدارة المستخدمين:** عرض وإضافة وتعديل المستخدمين
- **إدارة المحافظ:** عرض وتعديل أرصدة المحافظ
- **سجل المعاملات:** عرض المعاملات المالية (للعرض فقط)

---

## 🔒 الأمان

- كلمات المرور مشفرة باستخدام **bcrypt** مع salt rounds = 12
- المصادقة تعتمد على **JWT** مع انتهاء صلاحية قابل للتخصيص
- عمليات قاعدة البيانات تستخدم **Sequelize Transactions** لضمان تكامل البيانات
- قفل تشاؤمي (**Pessimistic Locking**) لمنع تعارض العمليات المتزامنة
- التحقق من دور المستخدم في نقطة نهاية التاجر

---

## 🏗️ هيكل المشروع

```
Atheer_Server/
├── src/
│   ├── admin/
│   │   └── index.js          # إعداد لوحة الإدارة AdminJS
│   ├── config/
│   │   └── database.js       # إعداد اتصال قاعدة البيانات
│   ├── middleware/
│   │   └── authenticate.js   # وسيط التحقق من JWT
│   ├── models/
│   │   ├── index.js          # تسجيل النماذج والعلاقات
│   │   ├── User.js           # نموذج المستخدم
│   │   ├── Wallet.js         # نموذج المحفظة
│   │   └── Transaction.js    # نموذج المعاملة
│   ├── routes/
│   │   ├── auth.js           # مسارات المصادقة
│   │   ├── wallet.js         # مسارات المحفظة
│   │   └── merchant.js       # مسارات التاجر
│   └── app.js                # نقطة الدخول الرئيسية
├── .env.example              # قالب متغيرات البيئة
├── package.json
└── README.md
```

---

## 📦 المكتبات المستخدمة

| المكتبة | الوصف |
|---------|-------|
| `express` | إطار عمل خادم الويب |
| `sequelize` | ORM للتعامل مع قاعدة البيانات |
| `pg` + `pg-hstore` | محرك PostgreSQL لـ Node.js |
| `jsonwebtoken` | إنشاء والتحقق من رموز JWT |
| `bcryptjs` | تشفير كلمات المرور |
| `adminjs` | لوحة إدارة ديناميكية |
| `@adminjs/express` | دمج AdminJS مع Express |
| `@adminjs/sequelize` | دمج AdminJS مع Sequelize |
| `dotenv` | إدارة متغيرات البيئة |

---

## 📱 تكامل SDK الأندرويد

رمز `atheerToken` المُرسَل في طلب `/merchant/charge` هو رقم هاتف العميل مشفراً بـ **Base64**.

**مثال تشفير في Kotlin (Android SDK):**
```kotlin
// تشفير رقم هاتف العميل إلى Base64
val customerPhone = "770123456"
val atheerToken = Base64.encodeToString(customerPhone.toByteArray(), Base64.NO_WRAP)
// النتيجة: "NzcwMTIzNDU2"
```

يجب على التطبيق الأندرويد إرسال هذا الرمز ضمن الحمولة JSON إلى نقطة نهاية التاجر عند إتمام عملية الدفع عبر NFC.

---

*نظام Atheer - مدفوعات ذكية بلا حدود*
