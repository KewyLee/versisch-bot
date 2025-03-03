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

/**
 * Заполняет PDF-шаблон данными пользователя
 * @param {Object} formData - Данные формы от пользователя
 * @param {string} signatureData - Base64-строка с изображением подписи
 * @returns {Promise<Buffer>} - Промис с буфером заполненного PDF
 */
async function generatePdfFromData(formData, signatureData) {
  try {
    console.log('Начало заполнения PDF-шаблона с использованием pdf-lib');
    
    // Путь к шаблону PDF
    const templatePath = process.env.PDF_TEMPLATE_PATH || 
                        path.join(__dirname, '..', 'BIG_Vermittlervollmacht.pdf');
    
    console.log(`Используется шаблон: ${templatePath}`);
    
    // Проверяем существование шаблона
    if (!fs.existsSync(templatePath)) {
      throw new Error(`PDF шаблон не найден по пути: ${templatePath}`);
    }
    
    // Чтение файла шаблона
    const templateBytes = fs.readFileSync(templatePath);
    
    // Загружаем PDF документ
    const pdfDoc = await PDFDocument.load(templateBytes);
    
    // Получаем первую страницу
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    
    console.log(`Размеры страницы PDF: ширина=${width}, высота=${height}`);
    
    // Загружаем стандартный шрифт
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Выделяем данные из formData
    let lastName = '', firstName = '';
    if (formData.fullName) {
      const nameParts = formData.fullName.split(' ');
      lastName = nameParts[0] || '';
      firstName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    }
    
    // Извлекаем адресные данные
    let street = '', houseNumber = '', zipCode = '', city = '';
    if (formData.insuranceAddress) {
      street = extractStreet(formData.insuranceAddress);
      houseNumber = extractHouseNumber(formData.insuranceAddress);
      zipCode = extractZipCode(formData.insuranceAddress);
      city = extractCity(formData.insuranceAddress);
    }
    
    // Данные для заполнения
    const data = {
      lastName: lastName,
      firstName: firstName,
      birthDate: formData.birthDate || '',
      birthSurname: formData.birthSurname || '',
      birthplace: formData.hometown || '',
      street: street,
      houseNumber: houseNumber,
      zipCode: zipCode,
      city: city,
      email: formData.email || '',
      phone: formData.phone || '',
      date: formData.datum || new Date().toLocaleDateString('de-DE'),
      place: formData.ort || 'Bergheim'
    };
    
    console.log('Подготовленные данные для заполнения PDF:', data);
    
    // Параметры текста
    const fontSize = 12;
    const textOptions = {
      font: font,
      size: fontSize,
      color: rgb(0, 0, 0)
    };
    
    // КОРРЕКТИРОВАННЫЕ КООРДИНАТЫ для BIG_Vermittlervollmacht.pdf
    // Координаты определены на основе визуального анализа PDF-шаблона
    
    // Фамилия - верхняя часть формы
    if (data.lastName) {
      firstPage.drawText(data.lastName, { 
        ...textOptions, 
        x: 140, // корректировка по оси X
        y: height - 152 // корректировка по оси Y
      });
    }
    
    // Имя
    if (data.firstName) {
      firstPage.drawText(data.firstName, { 
        ...textOptions, 
        x: 140, 
        y: height - 172 
      });
    }
    
    // Дата рождения
    if (data.birthDate) {
      firstPage.drawText(data.birthDate, { 
        ...textOptions, 
        x: 140, 
        y: height - 193 
      });
    }
    
    // Фамилия при рождении (если отличается)
    if (data.birthSurname) {
      firstPage.drawText(data.birthSurname, { 
        ...textOptions, 
        x: 140, 
        y: height - 213 
      });
    }
    
    // Место рождения
    if (data.birthplace) {
      firstPage.drawText(data.birthplace, { 
        ...textOptions, 
        x: 140, 
        y: height - 235 
      });
    }
    
    // Адрес: улица и номер дома
    if (data.street) {
      const streetText = data.street + (data.houseNumber ? ` ${data.houseNumber}` : '');
      firstPage.drawText(streetText, { 
        ...textOptions, 
        x: 140, 
        y: height - 275 
      });
    }
    
    // Индекс и город
    if (data.zipCode || data.city) {
      const addressText = `${data.zipCode || ''} ${data.city || ''}`.trim();
      firstPage.drawText(addressText, { 
        ...textOptions, 
        x: 140, 
        y: height - 295 
      });
    }
    
    // Email
    if (data.email) {
      firstPage.drawText(data.email, { 
        ...textOptions, 
        x: 140, 
        y: height - 316 
      });
    }
    
    // Телефон
    if (data.phone) {
      firstPage.drawText(data.phone, { 
        ...textOptions, 
        x: 140, 
        y: height - 336 
      });
    }
    
    // Место подписания (внизу формы)
    firstPage.drawText(data.place, { 
      ...textOptions, 
      x: 150, 
      y: 135 
    });
    
    // Дата подписания
    firstPage.drawText(data.date, { 
      ...textOptions, 
      x: 400, 
      y: 135 
    });
    
    // Добавляем подпись, если она была предоставлена
    if (signatureData) {
      await addSignatureToDocument(pdfDoc, signatureData);
    }
    
    // Сохраняем изменения и получаем PDF в виде байтов
    const pdfBytes = await pdfDoc.save();
    
    console.log('PDF успешно заполнен с помощью pdf-lib');
    
    // Возвращаем буфер с PDF
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    console.error(`Ошибка при заполнении PDF с pdf-lib: ${error.message}`);
    throw error;
  }
}

/**
 * Добавляет подпись в документ
 * @param {PDFDocument} pdfDoc - PDF документ
 * @param {string} signatureData - Base64-строка с изображением подписи
 */
async function addSignatureToDocument(pdfDoc, signatureData) {
  try {
    // Удаляем префикс Data URL, если он есть
    const base64Data = signatureData.replace(/^data:image\/png;base64,/, '');
    
    // Преобразуем Base64 в Uint8Array
    const signatureBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Загружаем изображение подписи
    const signatureImage = await pdfDoc.embedPng(signatureBytes);
    
    // Получаем размеры изображения и масштабируем подпись
    const signatureDims = signatureImage.scale(0.25); // Уменьшаем масштаб для лучшего размещения
    
    // Получаем первую страницу
    const page = pdfDoc.getPages()[0];
    
    // ИСПРАВЛЕНО: Добавляем подпись в правильное место (рядом с местом для подписи)
    page.drawImage(signatureImage, {
      x: 280, // Смещение по X - правая часть страницы, где обычно ставят подпись
      y: 120,  // Положение по Y - немного выше строки с датой
      width: signatureDims.width,
      height: signatureDims.height
    });
    
    console.log('Подпись успешно добавлена в PDF');
  } catch (error) {
    console.warn(`Не удалось добавить подпись: ${error.message}`);
    // Не прерываем выполнение при ошибке с подписью
  }
}

/**
 * Извлекает улицу из адреса
 * @param {string} address - Полный адрес
 * @returns {string} - Название улицы
 */
function extractStreet(address) {
  const match = address.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
  return match ? match[1].trim() : address;
}

/**
 * Извлекает номер дома из адреса
 * @param {string} address - Полный адрес
 * @returns {string} - Номер дома
 */
function extractHouseNumber(address) {
  const match = address.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
  return match ? match[2] : '';
}

/**
 * Извлекает почтовый индекс из адреса
 * @param {string} address - Полный адрес
 * @returns {string} - Почтовый индекс
 */
function extractZipCode(address) {
  const match = address.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
  return match ? match[3] : '';
}

/**
 * Извлекает город из адреса
 * @param {string} address - Полный адрес
 * @returns {string} - Название города
 */
function extractCity(address) {
  const match = address.match(/^(.*?)(\d+[a-zA-Z]?),?\s*(\d+)\s*(.*)$/);
  return match ? match[4] : '';
}

module.exports = {
  generatePdfFromData
}; 