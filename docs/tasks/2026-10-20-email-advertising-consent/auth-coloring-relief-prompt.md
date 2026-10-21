# Оживающая раскраска — угол карточки авторизации

Дата: 21.10.2026.
Инструмент: встроенный image_gen.imagegen, transparent_background=true.
Asset: apps/site/public/images/auth/coloring-relief-3d.png,1280×1280,1048875bytes.
Оригинал: /Users/denis.voropayev/.codex/generated_images/01a158a3-e0fa-77a3-b976-094892f31717/exec-4bf47878-c1f8-4fe4-9b4f-c795d7e2f39b.png.

## Финальный промпт

Use case: stylized-concept.
Asset type: subtle transparent 3D corner illustration for a pale rose-to-peach gradient benefits card in Artmate's sign-in form.
Primary request: "A coloring page comes to life": a contour drawing transforms gradually into a colored, dimensional paper relief.
Subject: a single small ivory coloring-book sheet, seen in a gentle three-quarter view with one softly curled corner. A cohesive botanical design on the page: three simple stylized flowers and a few flowing leaves. On the left, the flowers and leaves are delicate warm-gray outlined shapes printed flat on the page. Toward the lower right, those SAME drawn shapes transition naturally into colored raised paper petals and layered leaves lifting 1–2 centimeters off the sheet, with small soft cast shadows. Clearly show the continuous flat-to-dimensional transition, not separate loose objects.
Composition: compact diagonal corner motif, concentrated in the lower-right area of a square image, ample transparent space upper left for UI text. Objects fully visible with generous margins so the asset can be gently cropped inside a card corner. Botanical relief should read at 260–300 CSS pixels.
Style: refined tactile 3D paper sculpture, thick matte paper, delicate embossed edges, minimal clean shapes, soft studio lighting. Quiet, elegant and imaginative.
Palette: ivory paper, dusty blush and pale apricot petals, muted sage leaves, subtle lilac accent. Low contrast, light pastel tones to blend into an almost-white pink gradient. No bright saturated colors.
Background: genuine transparent alpha, including soft transparent shadows. No tabletop, no card, no background rectangle, no UI.
Text: none. Coloring outlines must have NO numbers or letters.
Avoid: brushes, paint, pencils, pens, pots, ceramics, tools, easels, hands, people, logos, typography, dark ink outlines, rainbow colors, glossy plastic, clutter, a dense bouquet or a realistic garden.

## Подключение

BenefitsPanel: правый нижний угол внутри градиента, absolute, ширина320px, opacity20%/30%, без влияния на высоту и кликабельные области. Прозрачность оригинала сохранена, next/image оптимизирует выдачу. Пустой alt, aria-hidden, pointer-events-none, overflow-hidden карточки. Прежний creative-studio-3d.png с кистью/краской удалён из public. Верхняя маленькая palette-3d.png не менялась.
