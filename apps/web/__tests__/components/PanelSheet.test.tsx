import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PanelSheet } from "@/components/app/shared/PanelSheet";

describe("PanelSheet", () => {
  it("closes on overlay click and Escape", () => {
    const onClose = vi.fn();

    render(
      <PanelSheet
        open
        onClose={onClose}
        title="Panels"
        sections={[
          { key: "you", label: "You", content: <div>Profile rail</div> },
          { key: "discover", label: "Discover", content: <div>Discovery rail</div> },
        ]}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /close panels/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
