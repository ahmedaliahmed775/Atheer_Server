// مسارات المحفظة: استعراض الرصيد وسجل المعاملات
import express from 'express';
import { Op } from 'sequelize';
import rateLimit from 'express-rate-limit';
import { Wallet, Transaction } from '../models/index.js';
import authenticate from '../middleware/authenticate.js';

// تحديد معدل الطلبات للحماية من هجمات الإغراق
// يسمح بـ 100 طلب كل 15 دقيقة لكل عنوان IP
const walletLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'تجاوزت الحد المسموح به من الطلبات. يرجى المحاولة لاحقاً.' },
});

const router = express.Router();

// تطبيق وسيط المصادقة وتحديد معدل الطلبات على جميع مسارات المحفظة
router.use(walletLimiter);
router.use(authenticate);

/**
 * GET /api/v1/wallet/balance
 * إرجاع الرصيد الحالي للمستخدم المسجّل دخوله
 */
router.get('/balance', async (req, res) => {
  try {
    // استخراج رقم هاتف المستخدم من رمز JWT
    const { phone } = req.user;

    // البحث عن محفظة المستخدم في قاعدة البيانات
    const wallet = await Wallet.findByPk(phone);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على محفظة لهذا المستخدم',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        phone,
        // تحويل الرصيد إلى عدد عشري
        balance: parseFloat(wallet.balance),
        currency: 'YER',
      },
    });
  } catch (error) {
    console.error('خطأ في استعراض الرصيد:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ داخلي في الخادم',
    });
  }
});

/**
 * GET /api/v1/wallet/history
 * إرجاع آخر 50 معاملة مالية للمستخدم (كمُرسِل أو مُستقبِل)
 */
router.get('/history', async (req, res) => {
  try {
    const { phone } = req.user;

    // البحث عن جميع المعاملات التي يكون فيها المستخدم مرسلاً أو مستقبلاً
    const transactions = await Transaction.findAll({
      where: {
        [Op.or]: [{ sender: phone }, { receiver: phone }],
      },
      // ترتيب المعاملات من الأحدث إلى الأقدم
      order: [['createdAt', 'DESC']],
      // إرجاع آخر 50 معاملة فقط
      limit: 50,
    });

    // تنسيق البيانات وإضافة نوع المعاملة (صادرة أو واردة)
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.sender === phone ? 'OUTGOING' : 'INCOMING',
      sender: tx.sender,
      receiver: tx.receiver,
      amount: parseFloat(tx.amount),
      status: tx.status,
      createdAt: tx.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        phone,
        total: formattedTransactions.length,
        transactions: formattedTransactions,
      },
    });
  } catch (error) {
    console.error('خطأ في استعراض سجل المعاملات:', error);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ داخلي في الخادم',
    });
  }
});

export default router;
