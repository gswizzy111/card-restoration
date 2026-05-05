"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PhotoUploader } from "./photo-uploader";
import type { Service, CardEntry } from "@/lib/types";

interface StepCardsProps {
  cards: CardEntry[];
  services: Service[];
  selectedServiceIds: string[];
  onChange: (cards: CardEntry[]) => void;
}

export function StepCards({ cards, services, selectedServiceIds, onChange }: StepCardsProps) {
  const availableServices = services.filter((s) => selectedServiceIds.includes(s.id));

  function updateCard(id: string, patch: Partial<CardEntry>) {
    onChange(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function addCard() {
    const newCard: CardEntry = {
      id: crypto.randomUUID(),
      card_name: "",
      card_set: "",
      card_year: "",
      card_number: "",
      estimated_value: "",
      notes: "",
      photo_urls: [],
      service_ids: [...selectedServiceIds],
    };
    onChange([...cards, newCard]);
  }

  function removeCard(id: string) {
    onChange(cards.filter((c) => c.id !== id));
  }

  function toggleService(cardId: string, serviceId: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const has = card.service_ids.includes(serviceId);
    updateCard(cardId, {
      service_ids: has
        ? card.service_ids.filter((s) => s !== serviceId)
        : [...card.service_ids, serviceId],
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl font-medium text-foreground mb-1">
          Tell us about your cards.
        </h2>
        <p className="text-muted-foreground">
          Add each card you&apos;re sending. You can assign different services to different cards.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {cards.map((card, i) => (
          <div key={card.id} className="border border-border rounded-lg p-5 flex flex-col gap-4 bg-card">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground">Card {i + 1}</h3>
              {cards.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCard(card.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label htmlFor={`name-${card.id}`}>Card Name *</Label>
                <Input
                  id={`name-${card.id}`}
                  placeholder="e.g. 1986 Fleer Michael Jordan"
                  value={card.card_name}
                  onChange={(e) => updateCard(card.id, { card_name: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`set-${card.id}`}>Set / Year</Label>
                <Input
                  id={`set-${card.id}`}
                  placeholder="e.g. Base Set"
                  value={card.card_set}
                  onChange={(e) => updateCard(card.id, { card_set: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`num-${card.id}`}>Card Number</Label>
                <Input
                  id={`num-${card.id}`}
                  placeholder="e.g. #57"
                  value={card.card_number}
                  onChange={(e) => updateCard(card.id, { card_number: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label htmlFor={`value-${card.id}`}>Estimated Value (USD)</Label>
                <Input
                  id={`value-${card.id}`}
                  placeholder="e.g. 500"
                  value={card.estimated_value}
                  onChange={(e) => updateCard(card.id, { estimated_value: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label htmlFor={`notes-${card.id}`}>Notes</Label>
                <Textarea
                  id={`notes-${card.id}`}
                  placeholder="Describe condition issues, areas of concern, or special instructions"
                  value={card.notes}
                  onChange={(e) => updateCard(card.id, { notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            {/* Services */}
            {availableServices.length > 1 && (
              <div className="flex flex-col gap-2">
                <Label>Services to apply</Label>
                <div className="flex flex-wrap gap-2">
                  {availableServices.map((s) => {
                    const active = card.service_ids.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleService(card.id, s.id)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          active
                            ? "bg-accent text-accent-foreground border-accent"
                            : "border-border text-muted-foreground hover:border-muted-foreground"
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Photos */}
            <div className="flex flex-col gap-1.5">
              <Label>Photos (optional)</Label>
              <PhotoUploader
                photoUrls={card.photo_urls}
                onChange={(urls) => updateCard(card.id, { photo_urls: urls })}
              />
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addCard}
        className="self-start gap-2"
      >
        <Plus className="h-4 w-4" />
        Add another card
      </Button>
    </div>
  );
}
