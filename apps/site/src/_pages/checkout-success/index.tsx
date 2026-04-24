import { CheckoutSuccess } from "@/features/checkout";
import { confirmOrderPayment } from "@/shared/actions/orders";
import { Button, DataState } from "@/shared/ui";
import { Link } from "@/shared/ui/link";
import { routes } from "@/shared/constants";

type CheckoutSuccessPageProps = {
  orderId?: string;
};

export async function CheckoutSuccessPage({ orderId }: CheckoutSuccessPageProps) {
  if (!orderId) {
    return (
      <main className="bg-background">
        <section className="container py-10">
          <DataState
            variant="error"
            title="Не найден номер заказа"
            description="Вернитесь в корзину и попробуйте оформить заказ заново."
          />
          <div className="mt-5 flex justify-center">
            <Button asChild>
              <Link href={routes.cart}>Вернуться в корзину</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  const orderResult = await confirmOrderPayment({ orderId });

  if (orderResult.isError || !orderResult.data) {
    return (
      <main className="bg-background">
        <section className="container py-10">
          <DataState
            variant="error"
            title="Не удалось подтвердить оплату"
            description={orderResult.error?.message ?? "Проверьте ссылку или попробуйте позже."}
          />
          <div className="mt-5 flex justify-center">
            <Button asChild>
              <Link href={routes.cart}>Вернуться в корзину</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="bg-background">
      <CheckoutSuccess order={orderResult.data} />
    </main>
  );
}
