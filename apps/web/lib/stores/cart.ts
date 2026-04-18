import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartLine = {
  product_id: string;
  product_name: string;
  unit_price_cents: number;
  quantity: number;
  weekly_catalog_id: string;
  producer_id: string;
};

type CartState = {
  lines: CartLine[];
  add: (line: CartLine) => void;
  update: (product_id: string, quantity: number) => void;
  remove: (product_id: string) => void;
  clear: () => void;
  totalCents: () => number;
  lineCount: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],

      add: (line: CartLine) => {
        set((state) => {
          // If switching weekly_catalog_id, clear previous lines first
          const hasOtherCatalog =
            state.lines.length > 0 &&
            state.lines[0].weekly_catalog_id !== line.weekly_catalog_id;
          if (hasOtherCatalog) {
            return { lines: [{ ...line }] };
          }

          const existing = state.lines.find((l) => l.product_id === line.product_id);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.product_id === line.product_id
                  ? { ...l, quantity: l.quantity + line.quantity }
                  : l
              ),
            };
          }
          return { lines: [...state.lines, { ...line }] };
        });
      },

      update: (product_id: string, quantity: number) => {
        if (quantity <= 0) {
          get().remove(product_id);
          return;
        }
        set((state) => ({
          lines: state.lines.map((l) =>
            l.product_id === product_id ? { ...l, quantity } : l
          ),
        }));
      },

      remove: (product_id: string) => {
        set((state) => ({
          lines: state.lines.filter((l) => l.product_id !== product_id),
        }));
      },

      clear: () => set({ lines: [] }),

      totalCents: () =>
        get().lines.reduce((sum, l) => sum + l.unit_price_cents * l.quantity, 0),

      lineCount: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),
    }),
    {
      name: 'lespaniersde-cart',
    }
  )
);
