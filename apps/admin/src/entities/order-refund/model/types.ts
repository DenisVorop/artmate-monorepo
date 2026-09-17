import type { OrderRefundsDTO } from "@/shared/actions/orders";

export type OrderRefunds = OrderRefundsDTO;
export type RefundableOrderItem = OrderRefunds["items"][number];
