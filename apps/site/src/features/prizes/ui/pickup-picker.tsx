import { DeliveryPicker } from "@/widgets/pickup-point-picker";
import { Button } from "@/shared/ui";
import { usePickupPickerState } from "../lib/ui-state";
import type { PrizePickupSelection } from "../lib/types";

export function PrizeDelivery({
  selected,
  onSelect,
}: {
  selected?: PrizePickupSelection;
  onSelect: (_selection: PrizePickupSelection) => void;
}) {
  const state = usePickupPickerState(selected);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={state.openPicker}
        className={`h-auto min-h-24 w-full items-start justify-start rounded-xl p-4 text-left whitespace-normal ${selected ? "border-rose-300 bg-rose-50/60" : ""}`}
      >
        <span className="block w-full min-w-0 space-y-3">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <strong>Пункт выдачи Ozon</strong>
            <span className="text-emerald-700">Бесплатно</span>
          </span>
          {selected ? (
            <>
              <span className="block text-sm leading-6 font-normal">{selected.point.address}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {selected.point.workHours}
              </span>
              <span className="block text-sm underline underline-offset-4">
                Изменить пункт выдачи
              </span>
            </>
          ) : (
            <span className="block text-sm font-normal text-muted-foreground">
              Выбрать на карте
            </span>
          )}
        </span>
      </Button>
      {state.open && (
        <DeliveryPicker
          isOpen={state.open}
          onOpenChange={state.setOpen}
          drafts={state.drafts}
          onDraftChange={state.setDrafts}
          selectedCompany="ozon"
          onCompanyChange={() => {}}
          isOzonDeliveryAvailable
          canConfirm={Boolean(state.candidate)}
          isConfirming={false}
          onConfirm={() => {
            if (state.candidate) {
              onSelect(state.candidate);
              state.setOpen(false);
            }
          }}
        />
      )}
    </>
  );
}
