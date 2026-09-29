import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCheckoutErrors } from "@/lib/checkout-error-log";
import { CheckoutErrorsClient } from "./checkout-errors-client";

export const dynamic = "force-dynamic";

export default async function CheckoutErrorsPage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) redirect("/admin/login");

  const errors = await getCheckoutErrors();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-black text-3xl text-foreground">Checkout Errors</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {errors.length} error{errors.length !== 1 ? "s" : ""} on record · newest first · you also get an email for each one
          </p>
        </div>
      </div>
      <CheckoutErrorsClient initialErrors={errors} />
    </div>
  );
}
