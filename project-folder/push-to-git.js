/**
 * Скрипт для отправки всех изменений в Git
 * Запуск: node push-to-git.js
 */

const { execSync } = require('child_process');

// Функция для выполнения команды Git и вывода результата
function runGitCommand(command) {
  console.log(`Выполнение команды: ${command}`);
  try {
    const output = execSync(command, { encoding: 'utf8' });
    console.log('Результат:');
    console.log(output);
    return output;
  } catch (error) {
    console.error(`Ошибка при выполнении команды: ${error.message}`);
    if (error.stdout) console.log(`Вывод stdout: ${error.stdout}`);
    if (error.stderr) console.error(`Вывод stderr: ${error.stderr}`);
    throw error;
  }
}

// Основная функция для отправки изменений в Git
async function pushToGit() {
  try {
    // Проверяем статус Git
    console.log('=== Проверка статуса Git ===');
    const status = runGitCommand('git status');
    
    // Добавляем все изменения
    console.log('\n=== Добавление всех изменений ===');
    runGitCommand('git add .');
    
    // Проверяем статус после добавления
    console.log('\n=== Проверка статуса после добавления ===');
    const statusAfterAdd = runGitCommand('git status');
    
    // Если есть изменения для коммита
    if (statusAfterAdd.includes('Changes to be committed')) {
      // Создаем коммит
      console.log('\n=== Создание коммита ===');
      const commitMessage = 'Обновление проекта: координаты полей PDF установлены вручную';
      runGitCommand(`git commit -m "${commitMessage}"`);
      
      // Отправляем изменения в удаленный репозиторий
      console.log('\n=== Отправка изменений в удаленный репозиторий ===');
      runGitCommand('git push');
      
      console.log('\n=== Все изменения успешно отправлены в Git ===');
    } else if (statusAfterAdd.includes('nothing to commit')) {
      console.log('\n=== Нет изменений для отправки в Git ===');
    }
    
  } catch (error) {
    console.error('Произошла ошибка при отправке изменений в Git:', error);
  }
}

// Запускаем функцию
pushToGit().catch(console.error); 