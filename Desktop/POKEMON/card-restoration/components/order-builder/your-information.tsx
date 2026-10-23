import type { CustomerInfo } from "@/lib/types";

/** The customer's contact and address, beside the order summary on the review step. */
export function YourInformation({ customer, onEdit }: { customer: CustomerInfo; onEdit: () => void }) {
  return (
    <div className="bg-white border-2 border-border rounded-xl p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-black text-lg text-foreground">Your Information</h3>
        <button type="button" onClick={onEdit} className="text-xs text-accent hover:text-accent/80 transition-colors">
          Edit
        </button>
      </div>
      <div className="text-sm text-muted-foreground flex flex-col gap-0.5 [overflow-wrap:anywhere]">
        <p>{customer.name}</p>
        <p>{customer.email}</p>
        <p>{customer.phone}</p>
        <p>
          {customer.street1}
          {customer.street2 ? `, ${customer.street2}` : ""}
        </p>
        <p>
          {customer.city}, {customer.state} {customer.zip}
        </p>
      </div>
    </div>
  );
}
