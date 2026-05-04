import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImageGrid } from "@/components/app/shared/ImageGrid";

describe("ImageGrid", () => {
  it("fits feed images inside their thumbnail frame instead of cropping them", () => {
    const images = ["/screenshots/one.png", "/screenshots/two.png"];

    const { container } = render(<ImageGrid images={images} onImageClick={() => {}} />);

    expect(screen.getByLabelText("View image 1")).toHaveClass("bg-subtle");

    const renderedImages = Array.from(container.querySelectorAll("img"));
    expect(renderedImages).toHaveLength(images.length);

    for (const image of renderedImages) {
      expect(image).toHaveClass("object-contain");
      expect(image).not.toHaveClass("object-cover");
    }
  });

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
