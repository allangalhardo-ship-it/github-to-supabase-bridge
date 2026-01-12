# Instrução para Ícone do App Android

Para configurar os ícones do app Android, você precisa gerar os ícones nos seguintes tamanhos e colocá-los nas pastas apropriadas:

## Tamanhos necessários:
- `mipmap-mdpi`: 48x48 px
- `mipmap-hdpi`: 72x72 px
- `mipmap-xhdpi`: 96x96 px
- `mipmap-xxhdpi`: 144x144 px
- `mipmap-xxxhdpi`: 192x192 px

## Pastas de destino (após rodar `npx cap add android`):
```
android/app/src/main/res/mipmap-mdpi/ic_launcher.png
android/app/src/main/res/mipmap-hdpi/ic_launcher.png
android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
```

## Passos:
1. Use um gerador de ícones como https://icon.kitchen ou Android Studio
2. Exporte o logo do GastroGestor (círculo verde com chapéu de chef) em 1024x1024 
3. Gere os ícones adaptive para Android
4. Substitua os ícones nas pastas mipmap
