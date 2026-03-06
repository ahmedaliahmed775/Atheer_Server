// نقطة الدخول الرئيسية لخادم Atheer
import 'dotenv/config';
import express from 'express';
import { sequelize } from './models/index.js';
import authRoutes from './routes/auth.js';
import walletRoutes from './routes/wallet.js';
import merchantRoutes from './routes/merchant.js';
import setupAdmin from './admin/index.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// وسيط تحليل طلبات JSON
app.use(express.json());
// وسيط تحليل طلبات النماذج المشفرة بـ URL
app.use(express.urlencoded({ extended: true }));

// ===== إعداد لوحة الإدارة AdminJS =====
// يجب إضافة مسار الإدارة قبل بقية المسارات
setupAdmin(app);

// ===== مسارات API =====
// مسارات المصادقة: تسجيل الحساب وتسجيل الدخول
app.use('/api/v1/auth', authRoutes);
// مسارات المحفظة: الرصيد وسجل المعاملات
app.use('/api/v1/wallet', walletRoutes);
// مسارات التاجر: عمليات الشحن والدفع
app.use('/api/v1/merchant', merchantRoutes);

// مسار الصفحة الرئيسية للتحقق من حالة الخادم
app.get('/', (req, res) => {
  res.json({
    name: 'Atheer Server - نظام الدفع اللاتصالي',
    version: '1.0.0',
    status: 'running',
    // توقيت تشغيل الخادم
    uptime: process.uptime(),
    endpoints: {
      admin: '/admin',
      api: '/api/v1',
      auth: {
        signup: 'POST /api/v1/auth/signup',
        login: 'POST /api/v1/auth/login',
      },
      wallet: {
        balance: 'GET /api/v1/wallet/balance',
        history: 'GET /api/v1/wallet/history',
      },
      merchant: {
        charge: 'POST /api/v1/merchant/charge',
      },
    },
  });
});

// معالج الأخطاء العامة
app.use((err, req, res, _next) => {
  console.error('خطأ غير متوقع:', err);
  res.status(500).json({
    success: false,
    message: 'حدث خطأ داخلي غير متوقع في الخادم',
  });
});

// معالج المسارات غير الموجودة
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `المسار المطلوب غير موجود: ${req.method} ${req.path}`,
  });
});

/**
 * تهيئة قاعدة البيانات وتشغيل الخادم
 */
const startServer = async () => {
  try {
    // اختبار الاتصال بقاعدة البيانات
    await sequelize.authenticate();
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');

    // مزامنة نماذج Sequelize مع جداول قاعدة البيانات
    // في بيئة الإنتاج، يُفضَّل استخدام Migrations بدلاً من sync
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✅ تم مزامنة نماذج قاعدة البيانات');

    // تشغيل الخادم على المنفذ المحدد
    // تشغيل الخادم على المنفذ المحدد والسماح بالاتصالات الخارجية
   // تشغيل الخادم على المنفذ المحدد والسماح بالاتصالات الخارجية
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 خادم Atheer يعمل على المنفذ ${PORT}`);
      console.log(`📊 لوحة الإدارة: http://localhost:${PORT}/admin`);
      console.log(`🔗 واجهة API: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error('❌ فشل تشغيل الخادم:', error);
    process.exit(1);
  }
};

startServer();

export default app;
