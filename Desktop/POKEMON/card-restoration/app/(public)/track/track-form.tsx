"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TrackForm({ initialOrder = "" }: { initialOrder?: string }) {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim() || !email.trim()) {
      toast.error("Please enter both your order number and email.");
      return;
    }
    setLoading(true);
    router.push(
      `/orders/${orderNumber.trim().toUpperCase()}?email=${encodeURIComponent(email.trim())}`
    );
  }

  return (
    <section className="flex-1 flex items-center justify-center py-24 px-6">
      <div className="w-full max-w-md">
        <h1 className="font-serif font-medium tracking-tight text-4xl md:text-5xl text-foreground mb-3">
          Track your order.
        </h1>
        <p className="text-muted-foreground mb-10">
          Enter your order number and email to view status.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="orderNumber">Order Number</Label>
            <Input
              id="orderNumber"
              placeholder="R1042 or K5"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-base mt-2"
            disabled={loading}
          >
            {loading ? "Looking up..." : "View Order"}
          </Button>
        </form>
      </div>
    </section>
  );
}
