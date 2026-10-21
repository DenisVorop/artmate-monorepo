> Исторический вариант заменён по уточнению пользователя: актуальна auth-card-image-prompt.md, иллюстрация внутри градиентной карточки.

# Фоновая иллюстрация авторизации

Дата: 21.10.2026.
Инструмент: встроенный image_gen.imagegen; прозрачный фон.
Asset: apps/site/public/images/auth/creative-corner-3d.png (1280×1280, 902187 bytes).
Источник: /Users/denis.voropayev/.codex/generated_images/01a158a3-e0fa-77a3-b976-094892f31717/exec-e18bc6ba-06ec-4fdb-84e1-d70aa1692e82.png.

## Финальный промпт

Use case: stylized-concept.
Asset type: subtle decorative 3D corner illustration for the light gray background of Artmate's email sign-in page, a Russian coloring-book and creative workshop store.
Primary request: a quiet, premium sculptural still life that adds depth around an authentication card without attracting attention away from it.
Subject: two oversized artist coloring pencils and a softly curling blank sheet of thick paper, composed as one sparse, elegant diagonal group. One pencil muted blush rose, one warm apricot. A small glimpse of very pale lavender on the paper's underside is acceptable.
Style: refined tactile 3D studio render, softly rounded edges, realistic matte colored lacquer, visible natural wood at pencil tips, fine paper texture, delicate ambient occlusion.
Composition: square image, full objects within the image with ample transparent breathing room, diagonal group concentrated in lower-right half. Suitable for being partly cropped at a webpage's bottom-right corner. No interface, no frame.
Lighting: diffuse daylight from upper left, very soft light shadows, subdued highlights, low contrast. Light, warm, airy. Off-white paper.
Color: desaturated pastel blush, peach, ivory and warm neutral shadows matching a light gray website and rose-to-orange action button. No saturated red or strong purple.
Background: genuine transparent alpha, isolate the objects with delicate soft contact shadows on transparency.
Text: none. Avoid logos, letters, numbers, people, hands, screens, globes, checkmarks, abstract glossy blobs, floating UI, harsh shadows, dramatic perspective.

## Подключение

Декоративное Image в общей AuthPageShell: нижний правый угол серого фона, 45% opacity, адаптивная ширина384/576px, без влияния на поток. Пустой alt, aria-hidden, pointer-events-none. Через штатный next/image; исходная прозрачность сохранена. Под формой на сайте AuthHost не использует эту обёртку.

Заголовок LoginStep — «Войти». Преимущества: «Следите за своими заказами», «Сохраняйте работы в мастерской», «Копите баллы в клубе Artmate». Клуб имеет отдельное вступление; эта правка его не изменяет и не записывает согласий.
