import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Boxes,
  ChartNoAxesColumnIncreasing,
  CircleDollarSign,
  ClipboardList,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";

import type { AuthUser } from "@/entities/session";
import { SessionMenu } from "@/features/auth";
import { AdminShell } from "@/widgets/admin-shell";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Progress,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui";

type DashboardPageProps = {
  readonly user: AuthUser;
};

type Metric = {
  readonly label: string;
  readonly value: string;
  readonly delta: string;
  readonly variant: "default" | "secondary" | "destructive" | "outline";
  readonly Icon: LucideIcon;
};

type Order = {
  readonly id: string;
  readonly customer: string;
  readonly status: string;
  readonly statusVariant: "default" | "secondary" | "destructive" | "outline";
  readonly delivery: string;
  readonly total: string;
};

type StockItem = {
  readonly name: string;
  readonly sku: string;
  readonly left: number;
  readonly capacity: number;
};

type ConversionPoint = {
  readonly day: string;
  readonly value: number;
};

const metrics: readonly Metric[] = [
  {
    label: "Выручка за сегодня",
    value: "128 450 ₽",
    delta: "+12% к среднему",
    variant: "default",
    Icon: CircleDollarSign,
  },
  {
    label: "Новые заказы",
    value: "34",
    delta: "7 требуют проверки",
    variant: "destructive",
    Icon: ClipboardList,
  },
  {
    label: "Товары в продаже",
    value: "1 248",
    delta: "18 без остатков",
    variant: "secondary",
    Icon: PackageCheck,
  },
  {
    label: "Доставка",
    value: "96%",
    delta: "в срок за 7 дней",
    variant: "outline",
    Icon: Truck,
  },
];

const orders: readonly Order[] = [
  {
    id: "#AM-1048",
    customer: "Анна Миронова",
    status: "Оплачен",
    statusVariant: "default",
    delivery: "Ozon, пункт выдачи",
    total: "4 980 ₽",
  },
  {
    id: "#AM-1047",
    customer: "Илья Соколов",
    status: "Нужна проверка",
    statusVariant: "destructive",
    delivery: "Курьер",
    total: "2 390 ₽",
  },
  {
    id: "#AM-1046",
    customer: "Мария Волкова",
    status: "Собирается",
    statusVariant: "secondary",
    delivery: "Самовывоз",
    total: "6 120 ₽",
  },
  {
    id: "#AM-1045",
    customer: "Дмитрий Орлов",
    status: "Отправлен",
    statusVariant: "outline",
    delivery: "Ozon, постамат",
    total: "1 840 ₽",
  },
];

const stockItems: readonly StockItem[] = [
  { name: "Раскраска Artmate Kids", sku: "AM-KD-041", left: 3, capacity: 40 },
  { name: "Набор маркеров Soft Brush", sku: "AM-MR-128", left: 6, capacity: 32 },
  { name: "Подарочная упаковка", sku: "AM-PK-003", left: 9, capacity: 60 },
];

const conversion: readonly ConversionPoint[] = [
  { day: "Пн", value: 52 },
  { day: "Вт", value: 64 },
  { day: "Ср", value: 58 },
  { day: "Чт", value: 72 },
  { day: "Пт", value: 69 },
  { day: "Сб", value: 81 },
  { day: "Вс", value: 76 },
];

export function DashboardPage({ user }: DashboardPageProps) {
  return (
    <AdminShell>
      <section id="overview" className="min-w-0 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant="outline">Панель управления</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Операционный обзор
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Заказ, товар или клиент" />
            </div>

            <Button type="button" variant="outline" size="icon" aria-label="Уведомления">
              <Bell aria-hidden="true" />
            </Button>

            <SessionMenu user={user} />
          </div>
        </header>

        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Ключевые показатели"
        >
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardHeader>
                <CardTitle>{metric.label}</CardTitle>
                <CardDescription>{metric.delta}</CardDescription>
                <CardAction>
                  <Badge variant={metric.variant} className="size-9 rounded-lg p-0">
                    <metric.Icon aria-hidden="true" />
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-normal">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
          <Card id="orders" className="xl:row-span-2">
            <CardHeader>
              <CardTitle>Последние заказы</CardTitle>
              <CardDescription>Продажи и статусы обработки</CardDescription>
              <CardAction>
                <Button type="button">
                  <ClipboardList data-icon="inline-start" aria-hidden="true" />
                  Открыть заказы
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Заказ</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Доставка</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.id}</TableCell>
                      <TableCell>{order.customer}</TableCell>
                      <TableCell>
                        <Badge variant={order.statusVariant}>{order.status}</Badge>
                      </TableCell>
                      <TableCell>{order.delivery}</TableCell>
                      <TableCell className="text-right font-medium">{order.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card id="products">
            <CardHeader>
              <CardTitle>Остатки</CardTitle>
              <CardDescription>Позиции, где нужен контроль склада</CardDescription>
              <CardAction>
                <Button type="button" variant="outline">
                  <Boxes data-icon="inline-start" aria-hidden="true" />
                  Инвентаризация
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              {stockItems.map((item, index) => (
                <div key={item.sku} className="grid gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.sku}</p>
                    </div>
                    <Badge variant="destructive">{item.left} шт.</Badge>
                  </div>
                  <Progress value={(item.left / item.capacity) * 100} />
                  {index < stockItems.length - 1 ? <Separator /> : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Конверсия недели</CardTitle>
              <CardDescription>Доля заказов от оформленных корзин</CardDescription>
              <CardAction>
                <Badge variant="outline" className="size-9 rounded-lg p-0">
                  <ChartNoAxesColumnIncreasing aria-hidden="true" />
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              {conversion.map((item) => (
                <div key={item.day} className="grid grid-cols-[2rem_1fr_3rem] items-center gap-3">
                  <span className="text-sm text-muted-foreground">{item.day}</span>
                  <Progress value={item.value} />
                  <Badge variant="secondary">{item.value}%</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </section>
    </AdminShell>
  );
}
