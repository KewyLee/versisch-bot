/**
 * analyzePdfFields.js
 * 
 * Утилита для анализа полей PDF-формы.
 * Запускается отдельно для определения имен полей в PDF-шаблоне.
 */

const pdffiller = require('pdffiller');
const path = require('path');

// Путь к PDF-шаблону
const templatePath = path.join(__dirname, '..', '..', 'BIG_Vermittlervollmacht.pdf');

console.log(`Анализируем поля PDF-шаблона: ${templatePath}`);

// Получение списка полей в PDF-форме
pdffiller.getFieldNames(templatePath, (err, fields) => {
  if (err) {
    console.error('Ошибка при получении полей формы:', err);
    process.exit(1);
  }
  
  console.log('Найдены следующие поля в PDF-форме:');
  console.log('---------------------------------');
  
  if (fields && fields.length > 0) {
    fields.forEach((field, index) => {
      console.log(`${index + 1}. ${field}`);
    });
  } else {
    console.log('Полей в форме не найдено или форма не является заполняемой (AcroForm).');
    console.log('Убедитесь, что PDF содержит заполняемые поля (Form Fields).');
  }
});

/**
 * Для запуска этой утилиты выполните команду:
 * node project-folder/utils/analyzePdfFields.js
 */ 