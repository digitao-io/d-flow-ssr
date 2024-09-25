import { App, Component, createSSRApp, defineComponent, h, useSSRContext, VNode } from "vue";
import { ResolvedPageDetails } from "../models/page";

export function createVueApp(components: Record<string, Component>): App {
  return createSSRApp(defineComponent({
    setup() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = useSSRContext() ?? (window as any).context;

      const pageDetails = ctx.pageDetails as ResolvedPageDetails;

      function render(slots: Record<string, () => VNode[]>): VNode {
        return h(
          components[pageDetails.template],
          { config: pageDetails.config },
          slots,
        );
      };

      function renderSlots(): Record<string, () => VNode[]> {
        const result = {} as Record<string, () => VNode[]>;
        for (const [slotName, slotComponents] of Object.entries(pageDetails.slots)) {
          result[slotName] = () => slotComponents.map((component) => {
            return h(
              components[component.component],
              { config: component.config },
            );
          });
        }

        return result;
      };

      return () => render(renderSlots());
    },
  }));
}
