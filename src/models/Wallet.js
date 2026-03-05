// نموذج المحفظة - يحتفظ برصيد كل مستخدم في النظام
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Wallet = sequelize.define(
  'Wallet',
  {
    // رقم هاتف المستخدم - مفتاح أساسي ومرجع للمستخدم
    phone: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
      references: {
        model: 'users',
        key: 'phone',
      },
    },
    // الرصيد الحالي للمحفظة بالريال اليمني
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      validate: {
        // لا يُسمح بأن يكون الرصيد سالباً
        min: 0,
      },
    },
  },
  {
    tableName: 'wallets',
    timestamps: false,
  }
);

export default Wallet;
