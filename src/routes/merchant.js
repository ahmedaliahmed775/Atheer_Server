// مسار الشحن للتاجر: معالجة طلبات الدفع اللاتصالي عبر NFC
import express from 'express';
import rateLimit from 'express-rate-limit';
import { sequelize, Wallet, Transaction } from '../models/index.js';
import authenticate from '../middleware/authenticate.js';

// تحديد معدل الطلبات لعمليات الشحن للحماية من هجمات الإغراق
// يسمح بـ 30 طلب شحن كل 15 دقيقة لكل عنوان IP
const chargeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'تجاوزت الحد المسموح به من طلبات الشحن. يرجى المحاولة لاحقاً.' },
});

const router = express.Router();

// تطبيق وسيط المصادقة وتحديد معدل الطلبات على جميع مسارات التاجر
router.use(chargeLimiter);
router.use(authenticate);

/**
 * فك تشفير رمز Atheer Token للحصول على رقم هاتف العميل
 * في هذا النظام، الرمز مشفر بـ Base64 ويحتوي على رقم هاتف العميل
 * يُرجع null إذا كان الرمز غير صالح
 */
const decodeAtheerToken = (atheerToken) => {
  try {
    // محاولة فك تشفير الرمز من Base64
    const decoded = Buffer.from(atheerToken, 'base64').toString('utf-8');
    // التحقق من أن النتيجة تبدو كرقم هاتف (أرقام فقط، بين 9 و15 خانة)
    if (/^\d{9,15}$/.test(decoded.trim())) {
      return decoded.trim();
    }
  } catch {
    // في حالة فشل فك التشفير، نُرجع null ليتم رفض الطلب
  }
  return null;
};

/**
 * POST /api/v1/merchant/charge
 * معالجة طلب الدفع اللاتصالي من التاجر
 *
 * هيكل الطلب المتوقع (محاكاة لمعايير البنوك):
 * {
 *   "header": { "serviceDetail": { "serviceName": "ATHEER.ECOMMCASHOUT" } },
 *   "body": { "amount": 500, "atheerToken": "base64_encoded_phone", "nonce": "random_string" }
 * }
 */
router.post('/charge', async (req, res) => {
  // استخراج رقم هاتف التاجر من رمز JWT
  const { phone: merchantPhone, role } = req.user;

  // التحقق من أن المستخدم المصادق عليه هو تاجر وليس عميلاً
  if (role !== 'merchant') {
    return res.status(403).json({
      success: false,
      message: 'هذه الخدمة متاحة للتجار فقط',
    });
  }

  const { header, body } = req.body;

  // التحقق من وجود جميع حقول الطلب المطلوبة
  if (!header?.serviceDetail?.serviceName || !body?.amount || !body?.atheerToken || !body?.nonce) {
    return res.status(400).json({
      success: false,
      message: 'هيكل الطلب غير مكتمل. يرجى التحقق من الحقول المطلوبة',
    });
  }

  const { amount, atheerToken, nonce } = body;
  const { serviceName } = header.serviceDetail;

  // التحقق من صحة المبلغ
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({
      success: false,
      message: 'المبلغ المُدخَل غير صالح',
    });
  }

  const chargeAmount = parseFloat(amount);

  // فك تشفير رمز Atheer للحصول على رقم هاتف العميل
  const customerPhone = decodeAtheerToken(atheerToken);

  // رفض الطلب إذا لم يمكن فك تشفير الرمز أو استخراج رقم هاتف صالح
  if (!customerPhone) {
    return res.status(400).json({
      success: false,
      message: 'رمز atheerToken غير صالح أو لا يحتوي على رقم هاتف مشفر صحيح',
    });
  }

  // بدء معاملة قاعدة بيانات لضمان تكامل البيانات (Atomic Transaction)
  const dbTransaction = await sequelize.transaction();

  try {
    // قفل محفظة العميل لمنع التعديلات المتزامنة (Pessimistic Locking)
    const customerWallet = await Wallet.findOne({
      where: { phone: customerPhone },
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!customerWallet) {
      await dbTransaction.rollback();
      return res.status(404).json({
        success: false,
        message: `لم يتم العثور على محفظة للعميل: ${customerPhone}`,
      });
    }

    const customerBalance = parseFloat(customerWallet.balance);

    // التحقق من كفاية رصيد العميل
    if (customerBalance < chargeAmount) {
      await dbTransaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'رصيد العميل غير كافٍ لإتمام عملية الدفع',
        data: {
          available_balance: customerBalance,
          required_amount: chargeAmount,
        },
      });
    }

    // قفل محفظة التاجر لمنع التعديلات المتزامنة
    const merchantWallet = await Wallet.findOne({
      where: { phone: merchantPhone },
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!merchantWallet) {
      await dbTransaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على محفظة التاجر',
      });
    }

    // خصم المبلغ من رصيد العميل
    await customerWallet.update(
      { balance: customerBalance - chargeAmount },
      { transaction: dbTransaction }
    );

    // إضافة المبلغ إلى رصيد التاجر
    const merchantBalance = parseFloat(merchantWallet.balance);
    await merchantWallet.update(
      { balance: merchantBalance + chargeAmount },
      { transaction: dbTransaction }
    );

    // تسجيل المعاملة المالية في سجل النظام
    const transaction = await Transaction.create(
      {
        sender: customerPhone,
        receiver: merchantPhone,
        amount: chargeAmount,
        status: 'ACCEPTED',
      },
      { transaction: dbTransaction }
    );

    // تأكيد المعاملة وحفظ التغييرات في قاعدة البيانات
    await dbTransaction.commit();

    // إرجاع استجابة محاكية لمعايير البنوك مع تفاصيل العملية
    return res.status(200).json({
      header: {
        serviceDetail: {
          serviceName,
          // رمز النجاح وفق المعايير البنكية
          responseCode: '00',
          responseMessage: 'APPROVED',
        },
        // الطابع الزمني للمعاملة
        transactionDate: new Date().toISOString(),
      },
      body: {
        // حالة المعاملة: مقبولة
        status: 'ACCEPTED',
        transactionId: transaction.id,
        amount: chargeAmount,
        // رقم الحوالة الفريد
        referenceNumber: `ATH${Date.now()}`,
        nonce,
        merchantPhone,
        customerPhone,
        // الرصيد المتبقي للتاجر بعد استلام الدفعة
        merchantNewBalance: merchantBalance + chargeAmount,
      },
    });
  } catch (error) {
    // التراجع عن جميع التغييرات في حالة حدوث خطأ
    await dbTransaction.rollback();
    console.error('خطأ في معالجة عملية الشحن:', error);
    return res.status(500).json({
      header: {
        serviceDetail: {
          serviceName,
          responseCode: '99',
          responseMessage: 'SYSTEM_ERROR',
        },
      },
      body: {
        status: 'REJECTED',
        message: 'حدث خطأ داخلي في الخادم أثناء معالجة عملية الدفع',
      },
    });
  }
});

export default router;
