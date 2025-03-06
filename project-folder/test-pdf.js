/**
 * Скрипт для тестирования генерации PDF
 * Запуск: node test-pdf.js
 */

const fs = require('fs');
const path = require('path');
const { generatePdfFromData } = require('./utils/pdfGenerator');

// Тестовые данные для заполнения PDF
const testData = {
  firstName: 'Иван',
  lastName: 'Петров',
  insuranceNumber: '123456789',
  insuranceCompany: 'Test Insurance',
  birthDate: '01.01.1990',
  addressComponents: {
    street: 'Hauptstraße',
    houseNumber: '123',
    zipCode: '10115',
    city: 'Berlin'
  }
};

// Функция для тестирования
async function testPdfGeneration() {
  console.log('=== НАЧАЛО ТЕСТИРОВАНИЯ ГЕНЕРАЦИИ PDF ===');
  console.log('Тестовые данные:', JSON.stringify(testData, null, 2));
  
  try {
    // Проверяем наличие шаблона PDF
    const templatePath = path.join(__dirname, 'BIG_Vermittlervollmacht.pdf');
    if (!fs.existsSync(templatePath)) {
      console.error(`ОШИБКА: Шаблон PDF не найден по пути: ${templatePath}`);
      return;
    }
    console.log(`Шаблон PDF найден: ${templatePath}`);
    
    // Создаем директорию для выходных файлов, если она не существует
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Создана директория для выходных файлов: ${outputDir}`);
    }
    
    console.log('Генерация PDF...');
    const outputPath = await generatePdfFromData(testData);
    
    console.log(`\n=== PDF УСПЕШНО СОЗДАН ===`);
    console.log(`Путь к файлу: ${outputPath}`);
    console.log(`Размер файла: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} КБ`);
    
    // Проверяем, что файл можно открыть
    try {
      fs.accessSync(outputPath, fs.constants.R_OK);
      console.log('Файл доступен для чтения');
    } catch (error) {
      console.error('ОШИБКА: Файл недоступен для чтения:', error.message);
    }
    
    console.log('\nДля проверки PDF откройте файл в любом PDF-просмотрщике.');
    
  } catch (error) {
    console.error('ОШИБКА при генерации PDF:', error);
    console.error(error.stack);
  }
}

// Запускаем тест
testPdfGeneration().catch(console.error); 