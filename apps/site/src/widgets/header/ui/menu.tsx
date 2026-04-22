import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  routes,
} from "@/shared";
import { Link } from "@/shared/ui/link";
import { ChevronDown } from "lucide-react";

const moreItems = [
  {
    href: routes.blog,
    title: "Блог",
    description: "Советы, идеи и\u00a0вдохновение",
  },
  {
    href: routes.gallery,
    title: "Галерея работ",
    description: "Работы нашего сообщества",
  },
  {
    href: routes.faq,
    title: "FAQ",
    description: "Ответы на\u00a0частые вопросы",
  },
];

export function Menu() {
  return (
    <ul className="flex items-center gap-8 text-stone-500">
      <li>
        <Link href={routes.catalog}>Каталог</Link>
      </li>
      <li>
        <Link href={routes.contacts}>Контакты</Link>
      </li>
      <li>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`flex items-center gap-1 data-[state=open]:text-stone-900 [&[data-state=open]_svg]:rotate-180`}
            >
              <span>Ещё</span>
              <ChevronDown size={16} className="transition-transform" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={16}
            className="w-60 border-stone-200 bg-white p-2 text-stone-900 shadow-xl shadow-stone-900/10"
          >
            <DropdownMenuLabel>Разделы ARTMATE</DropdownMenuLabel>
            <div className="grid gap-1">
              {moreItems.map((item) => (
                <DropdownMenuItem key={item.href}>
                  <Link href={item.href}>
                    <span className="block font-medium text-stone-900">{item.title}</span>
                    <span className="block text-xs text-stone-500">{item.description}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    </ul>
  );
}
