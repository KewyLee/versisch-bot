/**
 * Скрипт для анализа PDF-файла и определения расположения полей
 * Запуск: node analyze-pdf.js
 */

const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist');

// Путь к PDF-файлу
const PDF_PATH = path.join(__dirname, 'BIG_Vermittlervollmacht.pdf');

/**
 * Анализирует PDF-файл и выводит информацию о тексте и его расположении
 */
async function analyzePdf() {
  try {
    console.log(`Анализ PDF-файла: ${PDF_PATH}`);
    
    // Проверяем существование файла
    if (!fs.existsSync(PDF_PATH)) {
      console.error(`Файл не найден: ${PDF_PATH}`);
      console.log('Доступные PDF-файлы в текущей директории:');
      const files = fs.readdirSync(__dirname).filter(file => file.endsWith('.pdf'));
      if (files.length === 0) {
        console.log('PDF-файлы не найдены');
      } else {
        files.forEach(file => console.log(`- ${file}`));
      }
      return;
    }
    
    // Читаем файл в буфер и преобразуем в Uint8Array
    const buffer = fs.readFileSync(PDF_PATH);
    const data = new Uint8Array(buffer);
    
    // Загружаем PDF-файл из буфера
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    console.log(`PDF загружен, количество страниц: ${pdf.numPages}`);
    
    // Получаем первую страницу
    const page = await pdf.getPage(1);
    
    // Получаем размеры страницы
    const viewport = page.getViewport({ scale: 1.0 });
    console.log(`Размеры страницы: ширина=${viewport.width}, высота=${viewport.height}`);
    
    // Получаем текстовое содержимое
    const content = await page.getTextContent();
    
    // Создаем карту ключевых слов для поиска полей
    const keywordMap = {
      'Name': 'Имя/Фамилия',
      'Vorname': 'Имя',
      'Versicherungsnummer': 'Номер страховки',
      'Straße': 'Улица',
      'Hausnummer': 'Номер дома',
      'PLZ': 'Индекс',
      'Ort': 'Город',
      'Geburtsdatum': 'Дата рождения',
      'Versicherung': 'Страховая компания',
      'Datum': 'Дата',
      'Unterschrift': 'Подпись'
    };
    
    console.log('\n=== АНАЛИЗ ТЕКСТА В PDF ===');
    
    // Выводим все текстовые элементы и их координаты
    content.items.forEach((item, index) => {
      console.log(`[${index}] Текст: "${item.str}", X: ${item.transform[4].toFixed(2)}, Y: ${item.transform[5].toFixed(2)}, Ширина: ${item.width?.toFixed(2) || 'N/A'}`);
    });
    
    console.log('\n=== НАЙДЕННЫЕ ПОЛЯ ===');
    
    // Ищем ключевые слова и предполагаемые поля для ввода
    const foundFields = [];
    
    content.items.forEach((item) => {
      for (const [keyword, fieldName] of Object.entries(keywordMap)) {
        if (item.str.includes(keyword)) {
          const field = {
            keyword,
            fieldName,
            labelX: item.transform[4],
            labelY: item.transform[5],
            inputX: item.transform[4] + 150, // Предполагаемая позиция поля ввода
            inputY: item.transform[5]
          };
          
          foundFields.push(field);
          console.log(`Поле: ${fieldName} (${keyword})`);
          console.log(`  Метка: X=${field.labelX.toFixed(2)}, Y=${field.labelY.toFixed(2)}`);
          console.log(`  Предполагаемое поле ввода: X=${field.inputX.toFixed(2)}, Y=${field.inputY.toFixed(2)}`);
        }
      }
    });
    
    // Анализируем формы в PDF, если они есть
    try {
      const annotations = await page.getAnnotations();
      if (annotations.length > 0) {
        console.log('\n=== ФОРМЫ И АННОТАЦИИ В PDF ===');
        annotations.forEach((annotation, index) => {
          console.log(`[${index}] Тип: ${annotation.subtype}, Имя: ${annotation.fieldName || 'Нет имени'}`);
          if (annotation.rect) {
            console.log(`  Координаты: [${annotation.rect.join(', ')}]`);
          }
        });
      } else {
        console.log('\nВ PDF не найдены интерактивные формы.');
      }
    } catch (error) {
      console.log('\nНе удалось получить информацию о формах:', error.message);
    }
    
    console.log('\n=== ПРИМЕЧАНИЕ ===');
    console.log('Координаты полей установлены вручную и не должны быть изменены без явного запроса.');
    
    // Сохраняем результаты анализа в файл
    const outputPath = path.join(__dirname, 'pdf-analysis-result.json');
    const analysisResult = {
      pdfInfo: {
        path: PDF_PATH,
        pageCount: pdf.numPages,
        dimensions: {
          width: viewport.width,
          height: viewport.height
        }
      },
      textItems: content.items.map(item => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width
      })),
      foundFields,
      note: "Координаты полей установлены вручную и не должны быть изменены без явного запроса."
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(analysisResult, null, 2));
    console.log(`\nРезультаты анализа сохранены в файл: ${outputPath}`);
    
  } catch (error) {
    console.error('Ошибка при анализе PDF:', error);
    console.error(error.stack);
  }
}

// Запускаем анализ
analyzePdf().catch(console.error); 