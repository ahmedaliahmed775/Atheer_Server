// إعداد لوحة الإدارة AdminJS لإدارة بيانات النظام
import { AdminJS } from 'adminjs';
import { buildAuthenticatedRouter } from '@adminjs/express';
import { Database, Resource } from '@adminjs/sequelize';
import { sequelize, User, Wallet, Transaction } from '../models/index.js';
import 'dotenv/config';

// التحقق من وجود الإعدادات الأمنية المطلوبة للوحة الإدارة
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  تحذير: ADMIN_EMAIL أو ADMIN_PASSWORD غير محددين. سيتم استخدام البيانات الافتراضية للبيئة التطويرية فقط.');
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  تحذير: JWT_SECRET غير محدد. جلسات لوحة الإدارة ستستخدم مفتاحاً افتراضياً غير آمن.');
}

// مفتاح تشفير ملفات تعريف الارتباط (يجب أن يكون 32 حرفاً على الأقل)
const COOKIE_SECRET = process.env.JWT_SECRET || 'atheer_dev_cookie_secret_32_chars_!';

// تسجيل محوّل Sequelize مع AdminJS
AdminJS.registerAdapter({ Database, Resource });

/**
 * إنشاء وإعداد لوحة الإدارة
 * متاحة على المسار /admin
 */
const setupAdmin = (app) => {
  const adminJs = new AdminJS({
    // تسجيل نماذج قاعدة البيانات في لوحة الإدارة
    resources: [
      {
        resource: User,
        options: {
          // عنوان القسم بالعربية
          navigation: { name: 'إدارة المستخدمين', icon: 'User' },
          // إخفاء حقل كلمة المرور من القوائم لأسباب أمنية
          listProperties: ['phone', 'name', 'role'],
          showProperties: ['phone', 'name', 'role'],
          editProperties: ['phone', 'name', 'role', 'password'],
          filterProperties: ['phone', 'name', 'role'],
        },
      },
      {
        resource: Wallet,
        options: {
          navigation: { name: 'إدارة المحافظ', icon: 'Money' },
          listProperties: ['phone', 'balance'],
          showProperties: ['phone', 'balance'],
          editProperties: ['balance'],
          filterProperties: ['phone'],
        },
      },
      {
        resource: Transaction,
        options: {
          navigation: { name: 'سجل المعاملات', icon: 'Receipt' },
          // لوحة المعاملات للعرض فقط (لا يُسمح بالتعديل)
          actions: {
            new: { isAccessible: false },
            edit: { isAccessible: false },
            delete: { isAccessible: false },
          },
          listProperties: ['id', 'sender', 'receiver', 'amount', 'status', 'createdAt'],
          showProperties: ['id', 'sender', 'receiver', 'amount', 'status', 'createdAt'],
          filterProperties: ['sender', 'receiver', 'status'],
        },
      },
    ],
    // المسار الجذري للوحة الإدارة
    rootPath: '/admin',
    // إعدادات الواجهة
    branding: {
      companyName: 'Atheer - نظام الدفع اللاتصالي',
      logo: false,
      favicon: false,
    },
  });

  // إعداد مسار لوحة الإدارة مع المصادقة بكلمة مرور ثابتة
  const adminRouter = buildAuthenticatedRouter(
    adminJs,
    {
      authenticate: async (email, password) => {
        // التحقق من بيانات المدير (يجب تغييرها في الإنتاج)
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@atheer.app';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        if (email === adminEmail && password === adminPassword) {
          return { email };
        }
        return null;
      },
      cookieName: 'atheer-admin-session',
      cookiePassword: COOKIE_SECRET,
    },
    null,
    {
      // إعدادات الجلسة لحماية لوحة الإدارة
      resave: false,
      saveUninitialized: true,
      secret: COOKIE_SECRET,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      },
    }
  );

  // تسجيل مسار الإدارة في تطبيق Express
  app.use(adminJs.options.rootPath, adminRouter);

  return adminJs;
};

export default setupAdmin;
