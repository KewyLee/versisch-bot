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
 * @returns {Promise<Buffer>} - Промис с буфером заполненного PDF-документа
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
    
    // Извлекаем адресные данные из уже обработанных компонентов
    let street = '', houseNumber = '', zipCode = '', city = '';
    if (formData.addressComponents) {
      // Используем уже разобранный адрес из index.js
      street = formData.addressComponents.street || '';
      houseNumber = formData.addressComponents.houseNumber || '';
      zipCode = formData.addressComponents.zipCode || '';
      city = formData.addressComponents.city || '';
    } else if (formData.insuranceAddress) {
      // Для обратной совместимости, если addressComponents не передан
      console.log('Внимание: addressComponents не найден, используется прямой адрес');
      // Просто используем полный адрес как улицу
      street = formData.insuranceAddress || '';
    }
    
    // Параметры текста
    const fontSize = 12;
    const textOptions = {
      font: font,
      size: fontSize,
      color: rgb(0, 0, 0)
    };
    
    // ИСПОЛЬЗУЕМ ТОЧНЫЕ КООРДИНАТЫ, УКАЗАННЫЕ ПОЛЬЗОВАТЕЛЕМ
    
    // Фамилия
    if (lastName) {
      firstPage.drawText(lastName, { 
        ...textOptions, 
        x: 50, 
        y: height - 100 
      });
    }
    
    // Имя
    if (firstName) {
      firstPage.drawText(firstName, { 
        ...textOptions, 
        x: 50, 
        y: height - 120 
      });
    }
    
    // Дата рождения
    if (formData.birthDate) {
      firstPage.drawText(formData.birthDate, { 
        ...textOptions, 
        x: 50, 
        y: height - 140 
      });
    }
    
    // Улица
    if (street) {
      firstPage.drawText(street, { 
        ...textOptions, 
        x: 50, 
        y: height - 160 
      });
    }
    
    // Номер дома
    if (houseNumber) {
      firstPage.drawText(houseNumber, { 
        ...textOptions, 
        x: 200, 
        y: height - 160 
      });
    }
    
    // Индекс
    if (zipCode) {
      firstPage.drawText(zipCode, { 
        ...textOptions, 
        x: 50, 
        y: height - 180 
      });
    }
    
    // Город
    if (city) {
      firstPage.drawText(city, { 
        ...textOptions, 
        x: 150, 
        y: height - 180 
      });
    }
    
    // Текущая дата (серое поле)
    const currentDate = new Date().toLocaleDateString('de-DE');
    firstPage.drawText(currentDate, { 
      ...textOptions, 
      x: 50, 
      y: height - 240,
      color: rgb(0.5, 0.5, 0.5) // Серый цвет
    });
    
    // Добавляем подпись, если она была предоставлена
    if (signatureData) {
      await addSignatureToDocument(pdfDoc, signatureData, height);
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
 * @param {number} height - Высота страницы
 */
async function addSignatureToDocument(pdfDoc, signatureData, height) {
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
    
    // Добавляем подпись в фиолетовое поле
    page.drawImage(signatureImage, {
      x: 50,
      y: height - 220,
      width: signatureDims.width,
      height: signatureDims.height,
      color: rgb(0.5, 0, 0.5) // Фиолетовый цвет
    });
    
    console.log('Подпись успешно добавлена в PDF');
  } catch (error) {
    console.warn(`Не удалось добавить подпись: ${error.message}`);
    // Не прерываем выполнение при ошибке с подписью
  }
}

module.exports = {
  generatePdfFromData
}; 