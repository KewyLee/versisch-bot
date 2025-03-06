/**
 * pdfGenerator.js
 * 
 * Модуль для заполнения PDF-форм данными пользователя.
 * Использует библиотеку pdf-lib для работы с существующим PDF-шаблоном.
 * 
 * @author Versisch Bot Team
 * @version 1.0.0
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Опционально загружаем pdfjs-dist
let pdfjsLib;
try {
  pdfjsLib = require('pdfjs-dist');
} catch (error) {
  console.log('Модуль pdfjs-dist не найден. Функция анализа PDF будет недоступна.');
}

// Полифилл для atob, который не доступен в Node.js
function atob(base64) {
  return Buffer.from(base64, 'base64').toString('binary');
}

/**
 * Создает PDF документ на основе данных формы
 * @param {Object} formData - данные формы
 * @param {string} signatureData - данные подписи в формате base64
 * @returns {Promise<string>} - путь к созданному PDF файлу
 */
async function generatePdfFromData(formData, signatureData) {
  try {
    console.log('=== НАЧАЛО ГЕНЕРАЦИИ PDF ===');
    
    // Загружаем шаблон PDF
    const templatePath = path.join(__dirname, '..', 'BIG_Vermittlervollmacht.pdf');
    console.log(`Загрузка шаблона PDF: ${templatePath}`);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Шаблон PDF не найден: ${templatePath}`);
    }
    
    const pdfBytes = fs.readFileSync(templatePath);
    console.log(`Шаблон PDF загружен, размер: ${pdfBytes.length} байт`);
    
    // Загружаем PDF документ
    console.log('Создание PDF документа из шаблона...');
    const pdfDoc = await PDFDocument.load(pdfBytes, { 
      ignoreEncryption: true,
      updateMetadata: false
    });
    
    // Получаем первую страницу
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('PDF документ не содержит страниц');
    }
    
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    
    console.log(`Размеры PDF: ширина=${width}, высота=${height}`);
    
    // Настройки текста - используем латинские буквы для совместимости
    console.log('Загрузка шрифта...');
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const textOptions = {
      font,
      size: 10,
      color: rgb(0, 0, 0)
    };
    
    // Извлекаем данные из формы
    console.log('Обработка данных формы...');
    const { 
      firstName, 
      lastName, 
      insuranceNumber, 
      insuranceAddress,
      addressComponents,
      insuranceCompany,
      birthDate
    } = formData;
    
    // Транслитерация кириллических символов в латиницу
    function transliterate(text) {
      if (!text) return '';
      
      // Таблица транслитерации
      const translitMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
        'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
        'Ж': 'ZH', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'KH', 'Ц': 'TS', 'Ч': 'CH', 'Ш': 'SH', 'Щ': 'SCH', 'Ъ': '',
        'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'YU', 'Я': 'YA'
      };
      
      return text.split('').map(char => translitMap[char] || char).join('');
    }
    
    // Переменные для адреса
    let street = '';
    let houseNumber = '';
    let zipCode = '';
    let city = '';
    
    // Используем уже разобранные компоненты адреса, если они есть
    if (addressComponents) {
      street = addressComponents.street || '';
      houseNumber = addressComponents.houseNumber || '';
      zipCode = addressComponents.zipCode || '';
      city = addressComponents.city || '';
      console.log('Используются компоненты адреса из formData.addressComponents');
    } else if (insuranceAddress) {
      // Для обратной совместимости
      console.log('Внимание: addressComponents не найден, используется прямой адрес');
      street = insuranceAddress || '';
    }
    
    // Координаты полей на основе анализа PDF
    console.log('Настройка координат полей...');
    const fieldCoordinates = {
      firstName: { x: 150, y: height - 120 },
      lastName: { x: 300, y: height - 120 },
      insuranceNumber: { x: 150, y: height - 180 },
      street: { x: 150, y: height - 210 },
      houseNumber: { x: 350, y: height - 210 },
      zipCode: { x: 150, y: height - 240 },
      city: { x: 250, y: height - 240 },
      insuranceCompany: { x: 200, y: height - 300 },
      birthDate: { x: 200, y: height - 270 },
      date: { x: 150, y: height - 400 }
    };
    
    console.log('Заполнение полей формы...');
    
    // Имя (с транслитерацией)
    if (firstName) {
      const transliteratedFirstName = transliterate(firstName);
      firstPage.drawText(transliteratedFirstName, { 
        ...textOptions, 
        x: fieldCoordinates.firstName.x, 
        y: fieldCoordinates.firstName.y 
      });
      console.log(`Добавлено имя: ${firstName} (транслитерация: ${transliteratedFirstName})`);
    }
    
    // Фамилия (с транслитерацией)
    if (lastName) {
      const transliteratedLastName = transliterate(lastName);
      firstPage.drawText(transliteratedLastName, { 
        ...textOptions, 
        x: fieldCoordinates.lastName.x, 
        y: fieldCoordinates.lastName.y 
      });
      console.log(`Добавлена фамилия: ${lastName} (транслитерация: ${transliteratedLastName})`);
    }
    
    // Номер страховки
    if (insuranceNumber) {
      firstPage.drawText(insuranceNumber, { 
        ...textOptions, 
        x: fieldCoordinates.insuranceNumber.x, 
        y: fieldCoordinates.insuranceNumber.y 
      });
      console.log(`Добавлен номер страховки: ${insuranceNumber}`);
    }
    
    // Улица
    if (street) {
      firstPage.drawText(street, { 
        ...textOptions, 
        x: fieldCoordinates.street.x, 
        y: fieldCoordinates.street.y 
      });
      console.log(`Добавлена улица: ${street}`);
    }
    
    // Номер дома
    if (houseNumber) {
      firstPage.drawText(houseNumber, { 
        ...textOptions, 
        x: fieldCoordinates.houseNumber.x, 
        y: fieldCoordinates.houseNumber.y 
      });
      console.log(`Добавлен номер дома: ${houseNumber}`);
    }
    
    // Индекс
    if (zipCode) {
      firstPage.drawText(zipCode, { 
        ...textOptions, 
        x: fieldCoordinates.zipCode.x, 
        y: fieldCoordinates.zipCode.y 
      });
      console.log(`Добавлен индекс: ${zipCode}`);
    }
    
    // Город
    if (city) {
      firstPage.drawText(city, { 
        ...textOptions, 
        x: fieldCoordinates.city.x, 
        y: fieldCoordinates.city.y 
      });
      console.log(`Добавлен город: ${city}`);
    }
    
    // Страховая компания (с транслитерацией)
    if (insuranceCompany) {
      const transliteratedCompany = transliterate(insuranceCompany);
      firstPage.drawText(transliteratedCompany, { 
        ...textOptions, 
        x: fieldCoordinates.insuranceCompany.x, 
        y: fieldCoordinates.insuranceCompany.y 
      });
      console.log(`Добавлена страховая компания: ${insuranceCompany} (транслитерация: ${transliteratedCompany})`);
    }
    
    // Дата рождения
    if (birthDate) {
      firstPage.drawText(birthDate, { 
        ...textOptions, 
        x: fieldCoordinates.birthDate.x, 
        y: fieldCoordinates.birthDate.y 
      });
      console.log(`Добавлена дата рождения: ${birthDate}`);
    }
    
    // Текущая дата
    const currentDate = new Date().toLocaleDateString('de-DE');
    firstPage.drawText(currentDate, { 
      ...textOptions, 
      x: fieldCoordinates.date.x, 
      y: fieldCoordinates.date.y 
    });
    console.log(`Добавлена текущая дата: ${currentDate}`);
    
    // Добавляем подпись, если она есть
    if (signatureData) {
      await addSignatureToDocument(pdfDoc, signatureData, height);
    }
    
    // Сохраняем PDF
    console.log('Сохранение PDF...');
    const pdfBuffer = await pdfDoc.save({ 
      useObjectStreams: false,
      addDefaultPage: false,
      updateFieldAppearances: false
    });
    
    // Создаем директорию output, если она не существует
    const outputDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Создана директория: ${outputDir}`);
    }
    
    const outputPath = path.join(outputDir, `vollmacht_${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(`PDF успешно создан: ${outputPath}, размер: ${pdfBuffer.length} байт`);
    
    return outputPath;
  } catch (error) {
    console.error('Ошибка при создании PDF:', error);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Добавляет подпись в PDF документ
 * @param {PDFDocument} pdfDoc - PDF документ
 * @param {string} signatureData - данные подписи в формате base64
 * @param {number} height - высота страницы
 * @returns {Promise<void>}
 */
async function addSignatureToDocument(pdfDoc, signatureData, height) {
  try {
    console.log('Начинаем добавление подписи в PDF...');
    
    // Проверяем, что данные подписи предоставлены
    if (!signatureData) {
      console.warn('Данные подписи не предоставлены');
      return;
    }

    // Удаляем префикс data:image/png;base64, если он есть
    const base64Data = signatureData.replace(/^data:image\/png;base64,/, '');
    console.log('Префикс base64 удален из данных подписи');
    
    // Преобразуем base64 в Uint8Array (работает в Node.js и браузере)
    let bytes;
    try {
      const binaryString = atob(base64Data);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log(`Подпись преобразована в Uint8Array, размер: ${bytes.length} байт`);
    } catch (error) {
      console.error('Ошибка при декодировании base64:', error);
      // Альтернативный способ декодирования
      bytes = Buffer.from(base64Data, 'base64');
      console.log(`Использован альтернативный способ декодирования, размер: ${bytes.length} байт`);
    }
    
    // Встраиваем изображение подписи в PDF
    console.log('Встраиваем изображение подписи в PDF...');
    const signatureImage = await pdfDoc.embedPng(bytes);
    
    // Получаем размеры изображения
    const { width: imgWidth, height: imgHeight } = signatureImage.size();
    console.log(`Размеры изображения подписи: ширина=${imgWidth}, высота=${imgHeight}`);
    
    // Масштабируем изображение, чтобы оно не было слишком большим
    const maxWidth = 150;
    const scale = Math.min(1, maxWidth / imgWidth);
    const scaledWidth = imgWidth * scale;
    const scaledHeight = imgHeight * scale;
    console.log(`Масштабированные размеры: ширина=${scaledWidth}, высота=${scaledHeight}, масштаб=${scale}`);
    
    // Получаем первую страницу
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    
    // Координаты для размещения подписи (внизу страницы)
    const signatureX = 350;
    const signatureY = height - 400; // Размещаем подпись рядом с датой
    console.log(`Координаты подписи: x=${signatureX}, y=${signatureY}`);
    
    // Добавляем изображение подписи на страницу
    firstPage.drawImage(signatureImage, {
      x: signatureX,
      y: signatureY,
      width: scaledWidth,
      height: scaledHeight,
    });
    
    console.log('Подпись успешно добавлена в PDF');
  } catch (error) {
    console.warn(`Не удалось добавить подпись: ${error.message}`);
    console.error(error);
    // Не прерываем выполнение при ошибке с подписью
  }
}

/**
 * Получает координаты текста из PDF-файла
 * @param {string} pdfPath - путь к PDF-файлу
 * @returns {Promise<void>} - выводит координаты в консоль
 */
async function getTextPositions(pdfPath) {
  try {
    // Проверяем доступность модуля pdfjs-dist
    if (!pdfjsLib) {
      console.error('Модуль pdfjs-dist не установлен. Установите его с помощью npm install pdfjs-dist');
      return;
    }
    
    // Проверяем существование файла
    if (!fs.existsSync(pdfPath)) {
      console.error(`Файл не найден: ${pdfPath}`);
      return;
    }
    
    // Получаем абсолютный путь к файлу
    const absolutePath = path.resolve(pdfPath);
    console.log(`Анализ PDF-файла: ${absolutePath}`);
    
    // Читаем файл в буфер
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // Загружаем PDF-файл из буфера
    const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
    console.log(`PDF загружен, количество страниц: ${pdf.numPages}`);
    
    // Получаем первую страницу
    const page = await pdf.getPage(1);
    
    // Получаем текстовое содержимое
    const content = await page.getTextContent();
    
    console.log('Координаты текста в PDF:');
    content.items.forEach(item => {
      console.log(`Текст: "${item.str}", Координаты: x=${item.transform[4]}, y=${item.transform[5]}`);
    });
    
    // Возвращаем координаты для возможного использования
    return content.items.map(item => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5]
    }));
  } catch (error) {
    console.error('Ошибка при анализе PDF:', error);
    throw error;
  }
}

module.exports = {
  generatePdfFromData,
  getTextPositions
}; 