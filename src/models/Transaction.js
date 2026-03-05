// نموذج المعاملة المالية - يسجل كل عملية دفع في النظام
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Transaction = sequelize.define(
  'Transaction',
  {
    // معرف فريد للمعاملة بصيغة UUID
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // رقم هاتف المُرسِل (العميل الذي يدفع)
    sender: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    // رقم هاتف المُستقبِل (التاجر الذي يستلم الدفعة)
    receiver: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    // المبلغ المُحوَّل بالريال اليمني
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        // يجب أن يكون المبلغ موجباً
        min: 0.01,
      },
    },
    // حالة المعاملة: ACCEPTED أو REJECTED أو PENDING
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'ACCEPTED',
    },
  },
  {
    tableName: 'transactions',
    // نحتاج فقط لتاريخ الإنشاء، ولا نحتاج لتاريخ التحديث
    timestamps: true,
    updatedAt: false,
  }
);

export default Transaction;
