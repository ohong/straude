import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImageGrid } from "@/components/app/shared/ImageGrid";

describe("ImageGrid", () => {
  it("still opens the clicked image index for the lightbox", () => {
    const onImageClick = vi.fn();

    render(
      <ImageGrid
        images={["/screenshots/one.png", "/screenshots/two.png", "/screenshots/three.png"]}
        onImageClick={onImageClick}
      />
    );

    fireEvent.click(screen.getByLabelText("View image 2"));

    expect(onImageClick).toHaveBeenCalledExactlyOnceWith(1);
  });
});
