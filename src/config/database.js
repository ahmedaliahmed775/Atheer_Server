// إعداد الاتصال بقاعدة البيانات باستخدام Sequelize ORM
import { Sequelize } from 'sequelize';
import 'dotenv/config';

// إنشاء نسخة Sequelize للتواصل مع قاعدة بيانات PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME || 'atheer_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      // الحد الأقصى لعدد الاتصالات المتزامنة
      max: 10,
      // الحد الأدنى للاتصالات المحتفظ بها
      min: 0,
      // الوقت الأقصى للانتظار قبل رفع خطأ (بالمللي ثانية)
      acquire: 30000,
      // الوقت الذي يُعتبر بعده الاتصال الخامل قابلاً للإغلاق (بالمللي ثانية)
      idle: 10000,
    },
  }
);

export default sequelize;
