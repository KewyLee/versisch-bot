# Описание файлов в папке public

В этом документе содержится описание файлов, находящихся в папке `public` проекта. Эти файлы отвечают за клиентскую часть приложения и доступны пользователям через веб-интерфейс.

## Основные файлы

### index.html (5.6KB, 118 строк)
Основной HTML-файл, который загружается при открытии главной страницы приложения. Содержит структуру стандартной формы для заполнения данных пользователя.

**Назначение:**
- Отображение основной формы для ввода данных
- Подключение стилей и скриптов
- Создание интерфейса для загрузки фотографии и подписи

### styles.css (3.6KB, 191 строка)
Файл стилей для основной страницы приложения.

**Назначение:**
- Определение внешнего вида элементов формы
- Стилизация кнопок, полей ввода и других элементов интерфейса
- Адаптивная верстка для различных устройств

### app.js (21KB, 550 строк)
Основной JavaScript-файл, который обрабатывает взаимодействие пользователя с формой.

**Назначение:**
- Обработка ввода данных пользователем
- Валидация полей формы
- Отправка данных на сервер
- Управление холстом для подписи
- Обработка загрузки фотографий
- Интеграция с Telegram Web App API
- Отображение уведомлений и сообщений об ошибках

## Файлы для формы доверенности

### vollmacht.html (8.2KB, 160 строк)
HTML-файл для страницы с формой доверенности BIG.

**Назначение:**
- Отображение специализированной формы для заполнения доверенности
- Структура формы с полями, специфичными для доверенности
- Подключение соответствующих стилей и скриптов

### vollmacht-styles.css (5.7KB, 310 строк)
Файл стилей для страницы с формой доверенности.

**Назначение:**
- Стилизация элементов формы доверенности
- Специфические стили для элементов, характерных для этой формы
- Адаптивная верстка для различных устройств

### vollmacht.js (14KB, 381 строка)
JavaScript-файл для обработки формы доверенности.

**Назначение:**
- Специфическая логика для формы доверенности
- Валидация полей, характерных для доверенности
- Обработка подписи и отправка данных на сервер
- Интеграция с Telegram Web App API для этой формы

## Взаимодействие между файлами

1. HTML-файлы (`index.html` и `vollmacht.html`) определяют структуру страниц и подключают соответствующие CSS и JavaScript файлы.

2. CSS-файлы (`styles.css` и `vollmacht-styles.css`) определяют внешний вид элементов на страницах.

3. JavaScript-файлы (`app.js` и `vollmacht.js`) обрабатывают взаимодействие пользователя с формами:
   - Инициализируют элементы формы
   - Обрабатывают события (клики, ввод текста и т.д.)
   - Валидируют введенные данные
   - Отправляют данные на сервер через API
   - Обрабатывают ответы сервера

4. При отправке формы данные передаются на сервер (в `index.js`), который обрабатывает их и генерирует PDF-документ с помощью модуля `pdfGenerator.js`.

## Рекомендации по модификации

При необходимости внесения изменений в клиентскую часть приложения:

1. Для изменения структуры формы - редактируйте соответствующий HTML-файл
2. Для изменения внешнего вида - редактируйте CSS-файлы
3. Для изменения логики работы - редактируйте JavaScript-файлы

При добавлении новых полей в форму необходимо:
1. Добавить HTML-элемент в соответствующий HTML-файл
2. При необходимости добавить стили в CSS-файл
3. Добавить обработку нового поля в JavaScript-файл
4. Обновить серверную часть для обработки нового поля
5. Обновить генерацию PDF для включения нового поля в документ 