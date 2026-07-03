import { OrderScreen } from "@/app/r/_venue/order-screen";

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderScreen orderId={orderId} />;
}
