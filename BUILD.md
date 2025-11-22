# Сборка

## Требования

- Node.js 16+
- [just](https://github.com/casey/just)

## Быстрый старт

```bash
just rebuild
```

Соберет проект и создаст `vscl-faceit-finder-X.Y.Z.zip` (версия берется из `package.json`).


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
$VERSION = (Get-Content package.json | ConvertFrom-Json).version
powershell -Command "Compress-Archive -Path dist\* -DestinationPath vscl-faceit-finder-$VERSION.zip -Force"
```

**Linux/macOS:**
```bash
VERSION=$(node -p "require('./package.json').version")
cd dist && zip -r ../vscl-faceit-finder-$VERSION.zip * && cd ..
```

## Результат

После сборки в `dist/` находятся все файлы расширения, а `vscl-faceit-finder-X.Y.Z.zip` (версия из `package.json`) готов для установки в браузер.

## Релизы

Для создания релизов см. [RELEASES.md](RELEASES.md).
