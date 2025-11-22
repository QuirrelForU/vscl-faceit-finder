# Сборка

## Требования

- Node.js 16+
- [just](https://github.com/casey/just)

## TLDR
Соберет проект и создаст `vscl-faceit-finder-1.1.2.zip`.
```bash
just rebuild
```


## Команды

### Основные

- `just rebuild` - полная пересборка (clean → install → build → package)
- `just build` - сборка проекта
- `just package` - сборка + создание zip-архива
- `just clean` - очистка артефактов сборки
- `just watch` - режим разработки с автопересборкой

### Вспомогательные

- `just install` - установка зависимостей

## Без just

```bash
npm install
npm run build
```

Для создания zip-архива:

**Windows:**
```powershell
powershell -Command "Compress-Archive -Path dist\* -DestinationPath vscl-faceit-finder-1.1.2.zip -Force"
```

**Linux/macOS:**
```bash
cd dist && zip -r ../vscl-faceit-finder-1.1.2.zip * && cd ..
```

## Результат

После сборки в `dist/` находятся все файлы расширения, а `vscl-faceit-finder-1.1.2.zip` готов для установки в браузер.
